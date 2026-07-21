// Shared assertion runner. Usage: node runner/run.mjs bare react vue svelte angular
// For each framework: esbuild-bundle its entry, serve a shared harness page,
// and execute the SAME four cases in real Chromium:
//   cold  -> fallback correct at first paint; exactly 1 driver read (the seed's)
//   warm  -> stored value at first paint; component shows it; exactly 1 driver read
//   write -> toggle updates UI + root attr + driver; reload proves round-trip
//   inert -> no seed, cell imported but unread: ZERO driver reads
// Evidence for the storage-tradeoff decision. POC only — nothing ratified.
import { createServer } from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execSync } from "node:child_process";

const require = createRequire(import.meta.url);
const esbuild = require("esbuild");
const { chromium } = require("playwright-core");
const { seedScriptFor } = await import("../core/seed.js");

const pocRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const seed = seedScriptFor([{ key: "theme", fallback: "light" }]);

function harness(bundleJs, { withSeed }) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"><title>storage poc</title>
<script>
  window.__PAINTS__ = [];
  new PerformanceObserver(function (list) {
    for (const e of list.getEntries())
      window.__PAINTS__.push([e.name, e.startTime, document.documentElement.getAttribute("data-theme")]);
  }).observe({ type: "paint", buffered: true });
</script>
${withSeed ? "<script>" + seed + "</script>" : ""}
<style>
  html[data-theme="dark"] body { background: #111; color: #eee; }
  body { background: #fff; color: #111; }
</style>
</head>
<body>
<div id="app"></div>
<script src="/bundle.js" defer></script>
</body>
</html>`;
}

async function bundle(fw) {
  const cfg = (await import(pathToFileURL(path.join(pocRoot, fw, "build.mjs")))).default;
  const out = await esbuild.build({
    entryPoints: [path.join(pocRoot, cfg.entryPoint)],
    bundle: true,
    write: false,
    format: "iife",
    define: { "process.env.NODE_ENV": '"development"', "ngDevMode": "false" },
    absWorkingDir: pocRoot,
    ...cfg.esbuild,
  });
  return out.outputFiles[0].text;
}

function serve(pages) {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = req.url.split("?")[0];
      if (url === "/bundle.js") {
        res.setHeader("content-type", "text/javascript");
        res.end(pages.bundle);
      } else if (url === "/noseed") {
        res.setHeader("content-type", "text/html");
        res.end(pages.noseed);
      } else {
        res.setHeader("content-type", "text/html");
        res.end(pages.seeded);
      }
    });
    server.listen(0, () => resolve(server));
  });
}

const INSTRUMENT = `
  window.__DRIVER_READS__ = 0;
  const orig = Storage.prototype.getItem;
  Storage.prototype.getItem = function (k) {
    if (k === "theme") window.__DRIVER_READS__++;
    return orig.apply(this, arguments);
  };
`;

const results = [];
function check(fw, kase, name, cond, detail) {
  results.push({ fw, kase, name, pass: !!cond, detail });
  return !!cond;
}

async function snapshot(page, { waitPaint = true } = {}) {
  if (waitPaint) await page.waitForFunction("window.__PAINTS__.length > 0");
  return page.evaluate(() => ({
    paints: window.__PAINTS__,
    reads: window.__DRIVER_READS__,
    attr: document.documentElement.getAttribute("data-theme"),
    value: document.getElementById("value") && document.getElementById("value").textContent,
    stored: (() => { try { return localStorage.getItem("theme"); } catch { return null; } })(),
  }));
}

function firstPaintAttr(s) {
  const fp = s.paints.find((p) => p[0] === "first-paint") || s.paints.find((p) => p[0] === "first-contentful-paint");
  return fp ? fp[2] : "(no paint entry)";
}

async function runFramework(browser, port, fw) {
  async function newPage(ctx) {
    const page = await ctx.newPage();
    page.on("pageerror", (e) => results.push({ fw, kase: "pageerror", name: e.message, pass: false, detail: "" }));
    return page;
  }

  // cold
  {
    const ctx = await browser.newContext();
    await ctx.addInitScript(INSTRUMENT);
    const page = await newPage(ctx);
    await page.goto(`http://127.0.0.1:${port}/`);
    await page.waitForFunction("window.__READY__ === true");
    const s = await snapshot(page);
    check(fw, "cold", "fallback at first paint", firstPaintAttr(s) === "light", `fp-attr=${firstPaintAttr(s)}`);
    check(fw, "cold", "component shows fallback", s.value === "light", `value=${s.value}`);
    check(fw, "cold", "exactly 1 driver read (seed only)", s.reads === 1, `reads=${s.reads}`);
    await ctx.close();
  }
  // warm
  {
    const ctx = await browser.newContext();
    await ctx.addInitScript(INSTRUMENT);
    await ctx.addInitScript(() => { try { localStorage.setItem("theme", "dark"); } catch {} });
    const page = await newPage(ctx);
    await page.goto(`http://127.0.0.1:${port}/`);
    await page.waitForFunction("window.__READY__ === true");
    const s = await snapshot(page);
    check(fw, "warm", "stored value at first paint (no flash)", firstPaintAttr(s) === "dark", `fp-attr=${firstPaintAttr(s)}`);
    check(fw, "warm", "component shows stored value", s.value === "dark", `value=${s.value}`);
    check(fw, "warm", "exactly 1 driver read (landing slot consumed)", s.reads === 1, `reads=${s.reads}`);
    await ctx.close();
  }
  // write + round-trip
  {
    const ctx = await browser.newContext();
    await ctx.addInitScript(INSTRUMENT);
    const page = await newPage(ctx);
    await page.goto(`http://127.0.0.1:${port}/`);
    await page.waitForFunction("window.__READY__ === true");
    await page.click("#toggle");
    const s1 = await snapshot(page);
    check(fw, "write", "component updated", s1.value === "dark", `value=${s1.value}`);
    check(fw, "write", "root attr maintained", s1.attr === "dark", `attr=${s1.attr}`);
    check(fw, "write", "driver persisted", s1.stored === "dark", `stored=${s1.stored}`);
    await page.reload();
    await page.waitForFunction("window.__READY__ === true");
    const s2 = await snapshot(page);
    check(fw, "write", "round-trip: written value at first paint after reload", firstPaintAttr(s2) === "dark", `fp-attr=${firstPaintAttr(s2)}`);
    check(fw, "write", "round-trip: component shows written value", s2.value === "dark", `value=${s2.value}`);
    await ctx.close();
  }
  // inert
  {
    const ctx = await browser.newContext();
    await ctx.addInitScript(INSTRUMENT);
    const page = await newPage(ctx);
    await page.goto(`http://127.0.0.1:${port}/noseed?inert=1`);
    await page.waitForFunction("window.__READY__ === true");
    const s = await snapshot(page, { waitPaint: false });
    check(fw, "inert", "zero driver reads (cell created, never read, no seed)", s.reads === 0, `reads=${s.reads}`);
    check(fw, "inert", "no root attr written", s.attr === null, `attr=${s.attr}`);
    await ctx.close();
  }
}

const args = process.argv.slice(2);
const buildOnly = args.includes("--build-only");
const frameworks = args.filter((a) => a !== "--build-only");
if (frameworks.length === 0) {
  console.error("usage: node runner/run.mjs [--build-only] <framework...>");
  process.exit(2);
}

if (buildOnly) {
  // Sandbox-friendly verification: prove the adapter bundles (imports resolve,
  // plugins wired) without needing a browser.
  for (const fw of frameworks) {
    const js = await bundle(fw);
    console.log(`BUILD-ONLY ${fw}: OK (${(js.length / 1024).toFixed(0)}kb)`);
  }
  process.exit(0);
}

const execPath =
  process.env.CHROMIUM_EXEC ||
  execSync(
    'find "$HOME/Library/Caches/ms-playwright" -name chrome-headless-shell -type f | sort | tail -1'
  ).toString().trim();
const browser = await chromium.launch({ executablePath: execPath, headless: true });

for (const fw of frameworks) {
  const bundleJs = await bundle(fw);
  const server = await serve({
    bundle: bundleJs,
    seeded: harness(bundleJs, { withSeed: true }),
    noseed: harness(bundleJs, { withSeed: false }),
  });
  await runFramework(browser, server.address().port, fw);
  server.close();
}
await browser.close();

// Report
let failed = 0;
let current = "";
for (const r of results) {
  if (r.fw !== current) {
    current = r.fw;
    console.log(`\n=== ${r.fw} ===`);
  }
  if (!r.pass) failed++;
  console.log(`  ${r.pass ? "PASS" : "FAIL"} [${r.kase}] ${r.name}${r.detail ? ` (${r.detail})` : ""}`);
}
const byFw = {};
for (const r of results) byFw[r.fw] = (r.fw in byFw ? byFw[r.fw] : true) && r.pass;
console.log("\nSUMMARY: " + Object.entries(byFw).map(([f, ok]) => `${f}=${ok ? "GREEN" : "RED"}`).join(" "));
process.exit(failed ? 1 : 0);
