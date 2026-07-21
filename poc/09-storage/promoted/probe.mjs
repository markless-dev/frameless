// Promotion probe — emulates COMPILER OUTPUT of the zero-new-API design:
// an attach behavior (measure children -> set cell + fix DOM) that the
// compiler PROMOTED to a parse-time inline script after the element, with
// the runtime consuming the seeded result instead of re-running the work.
// Also runs the DEMOTED variant (no inline script): runtime does the same
// work at "hydration" time — correct either way; promotion buys pre-paint.
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";

const { chromium } = createRequire(import.meta.url)("playwright-core");

// The SAME authored logic, emitted twice by the "compiler": once serialized
// into the inline script (promoted), once inside the runtime (demoted path).
const measureSrc = `function countVisibleItems(node) {
  var box = node.getBoundingClientRect();
  var count = 0;
  window.__MEASURE_CALLS__ = (window.__MEASURE_CALLS__ || 0) + 1;
  for (var i = 0; i < node.children.length; i++) {
    var r = node.children[i].getBoundingClientRect();
    if (r.left >= box.left && r.right <= box.right + 1) count++;
  }
  return count;
}`;

const promotedScript = `<script>(function(){${measureSrc}
var node = document.currentScript.previousElementSibling;
var count = countVisibleItems(node);
node.setAttribute("data-items", count);
(window.__FRAMELESS_STATE__ = window.__FRAMELESS_STATE__ || {})["carousel:items"] = count;
})()</script>`;

const runtimeBody = `(function(){${measureSrc}
// Emulated runtime wake: consume the seeded cell if present, else do the
// attach work now (demoted path).
var node = document.getElementById("scroller");
var slot = window.__FRAMELESS_STATE__;
var seeded = !!(slot && "carousel:items" in slot);
var count = seeded ? slot["carousel:items"] : countVisibleItems(node);
if (!seeded) node.setAttribute("data-items", count);
window.__RESULT__ = { seeded: seeded, cellValue: count, measureCalls: window.__MEASURE_CALLS__ || 0 };
window.__READY__ = true;
})()`;
// Runtime loads as an external script with realistic latency (framework
// bundle arriving after first paint) so the demoted timing is observable.
const runtime = `<script defer src="/runtime.js"></script>`;

function page(promoted) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>promotion probe</title>
<script>
  window.__PAINTS__ = [];
  new PerformanceObserver(function (l) {
    for (const e of l.getEntries())
      window.__PAINTS__.push([e.name, e.startTime, document.getElementById("scroller") && document.getElementById("scroller").getAttribute("data-items")]);
  }).observe({ type: "paint", buffered: true });
</script>
<style>#scroller{display:flex;width:320px;overflow:hidden} #scroller span{flex:0 0 100px;height:40px;background:#ddd;margin-right:0}</style>
</head>
<body>
<div id="app">
  <div id="scroller"><span></span><span></span><span></span><span></span><span></span></div>${promoted ? promotedScript : ""}
</div>
${runtime}
</body>
</html>`;
}

const server = createServer((req, res) => {
  if (req.url.startsWith("/runtime.js")) {
    setTimeout(() => {
      res.setHeader("content-type", "text/javascript");
      res.end(runtimeBody);
    }, 120);
    return;
  }
  res.setHeader("content-type", "text/html");
  res.end(page(!req.url.includes("demoted")));
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const exec =
  process.env.CHROMIUM_EXEC ||
  execSync('find "$HOME/Library/Caches/ms-playwright" -name chrome-headless-shell -type f | sort | tail -1').toString().trim();
const browser = await chromium.launch({ executablePath: exec, headless: true });

let failed = 0;
const assert = (c, m) => { console.log(`${c ? "PASS" : "FAIL"}: ${m}`); if (!c) failed++; };

async function run(name, path) {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto(`http://127.0.0.1:${port}${path}`);
  await p.waitForFunction("window.__READY__ === true && window.__PAINTS__.length > 0");
  const r = await p.evaluate(() => ({
    result: window.__RESULT__,
    paints: window.__PAINTS__,
    attr: document.getElementById("scroller").getAttribute("data-items"),
  }));
  console.log(`\n=== ${name} ===`);
  for (const row of r.paints) console.log(JSON.stringify(row));
  console.log("result:", JSON.stringify(r.result), "final attr:", r.attr);
  await ctx.close();
  return r;
}

// 320px viewport, 100px items -> 3 fully visible
{
  const r = await run("PROMOTED (compiler emitted inline script)", "/");
  const fp = r.paints.find((x) => x[0] === "first-paint") || r.paints.find((x) => x[0] === "first-contentful-paint");
  assert(fp && fp[2] === "3", `attr correct AT first paint (fp-attr=${fp && fp[2]})`);
  assert(r.result.seeded === true, "runtime consumed seeded cell (no re-run)");
  assert(r.result.measureCalls === 1, `measurement ran exactly once, in the early script (calls=${r.result.measureCalls})`);
  assert(r.result.cellValue === 3, `cell holds measured value (${r.result.cellValue})`);
}
{
  const r = await run("DEMOTED (no promotion — attach runs at hydration)", "/demoted");
  const fp = r.paints.find((x) => x[0] === "first-paint") || r.paints.find((x) => x[0] === "first-contentful-paint");
  assert(fp && fp[2] === null, `first paint shows UNCORRECTED attr — the accepted flash (fp-attr=${fp && fp[2]})`);
  assert(r.result.seeded === false && r.result.cellValue === 3 && r.attr === "3",
    `runtime did the work itself and converged to the same state (value=${r.result.cellValue}, attr=${r.attr})`);
  assert(r.result.measureCalls === 1, `measurement still ran exactly once (calls=${r.result.measureCalls})`);
}

await browser.close();
server.close();
console.log(failed ? `\n${failed} FAILED` : "\nALL PASS: promotion = timing upgrade, demotion = same semantics later");
process.exit(failed ? 1 : 0);
