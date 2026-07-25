# Fonts — licensing

**Que Grotesque is a purchased, commercially licensed typeface. It is not open source, and
nothing in this kit grants you a licence to it.**

Read this before you copy, zip, publish, or deploy anything in this folder.

## What is here

Four static WOFF2 subsets, self-hosted:

| File | Weight | Bytes |
|---|---|---|
| `QueGrotesque-Regular.woff2` | 400 | 25,216 |
| `QueGrotesque-Medium.woff2` | 500 | 24,820 |
| `QueGrotesque-Bold.woff2` | 700 | 23,000 |
| `QueGrotesque-Black.woff2` | 900 | 20,184 |

Measured coverage and metrics: [`quegrotesque.json`](./quegrotesque.json).

## Provenance, read out of the binaries

These values were read from the files' `name` table, not from memory:

| Field | Value |
|---|---|
| Foundry | TypeBerka — Font Studio |
| Designer | Hazzhim Rhurfata |
| Copyright | © 2024 Que Grotesque Font. All rights reserved. |
| Trademark | Que Grotesque is a trademark of TypeBerka. |
| Version | 1.000 |
| Licence URL | https://typeberka.com/license |

## The rules

1. **WOFF2 only.** No OTF, no TTF, no variable source may ever be committed anywhere under
   `brand/`. A repo-wide scan confirmed none exists today; keep it that way. The subsets are
   web-delivery artefacts. A desktop source is the thing a licence actually restricts, and
   committing one turns a licensed font into a redistributed one.
2. **Self-hosted, single origin.** These files are served from the origin they were licensed
   for. They may not be re-uploaded, mirrored, put on a CDN, hotlinked, bundled into an npm
   package, attached to a downloadable template, or served from another origin.
3. **Not redistributable.** Handing someone this folder hands them the font. If you share the
   kit outside the licensed scope, **remove the four WOFF2 files first.** The `@font-face`
   blocks, the metrics in `quegrotesque.json` and the fallback stack are enough for the kit to
   function without them — the type will render in the fallback rather than fail.
4. **No embedding into applications or documents** beyond what the purchased licence tier
   allows.

## Licence tier

**Professional.** Purchased and confirmed by the owner.

The OS/2 `fsType` field in all four files is `0`, which in the OpenType spec means
"installable embedding" — no embedding restriction bit is set. **That is not a licence grant.**
`fsType` describes what the binary permits technically; the EULA above describes what you are
allowed to do. Where they differ, the EULA governs.

## Attribution

Que Grotesque is licensed to Frameless. The WOFF2 files in this kit are self-hosted subsets and
may not be redistributed, re-uploaded, or served from another origin.

That sentence is also carried by the `footer-marks` component, so it ships with the product
rather than living only in this file.
