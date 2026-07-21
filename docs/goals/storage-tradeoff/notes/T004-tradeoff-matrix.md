# T004 — Tradeoff matrix + owner decision menu (Judge, 2026-07-20)

STATUS: Everything below is CANDIDATE material and menu preparation. Nothing is ratified. Only the owner decides.

Citation codes (matrix only): E1–E5 = T001 evidence; P1–P5 = T003 executed probes; S1–S8 = T002 candidate sections 1–8; INF = inference by this Judge.

## Part 1 — Tradeoff matrix

Surviving candidates (from T002, none re-killed here):
C1 inert declaration + provider/root enablement · C2 inert declaration + build-config/explicit-artifact enablement · C3 plain persisted cell only in v1 · C4 persisted cell + compiler-provided pre-paint upgrade · C5 module-scope restriction · C6 manifest/file convention · C7 declaration directive + separate app permission · C8 app-owned cell, libraries receive a capability.

### Decisive probe results that move scores (executed, not inferred)

- P1: markless payload seed channel is VIABLE with no core change (`graph.read(theme-cell)=dark-from-early-script`, value in graph before runtime start). Removes the "needs core surgery" objection from C1/C2/C4/C5/C6/C7. Browser chunk-ordering remains unproven (P1: UNPROVABLE-WITHOUT-BROWSER).
- P2+P3: fallback-then-patch is universally sound — React 19 StrictMode-safe seed-first commit; consent-gated late enablement reads/notifies exactly once (`driverReads:1, notifyCalls:1`); Solid signal and store both clean. This makes C3 fully correct (not merely "acceptable"), and makes every candidate's consent-denied downgrade path safe.
- P3: NO candidate needs pre-paint storage access for reactive correctness; pre-paint buys only no-flash first paint. This is direct executed support for C4's "upgrade, not semantic" framing and for C3's honesty — it converts E5's inertness objection from "storage() promises what no runtime can keep" into "storage() promises only what the runtime keeps; no-flash is an explicitly enabled artifact."
- P4: consolidated seed script ~0.006ms @1 key, ~0.094ms @50 (Node V8, rough budget). Perf objections to consolidated artifacts are weak at device-state scale.
- P5: the `@frameless/authoring` facade is REJECTED on today's pin (`MARKLESS_FRAMEWORK_IMPORT_REQUIRED`). Import-rewrite is the only frameless-side mechanism today; accepted-import-source registration is a markless-side change (fixing board). This gates "cost TODAY" for C1–C7 and C8's app-authored line equally.

### Per-mode ideal-ness (separate columns; asymmetries stated, never averaged)

| Candidate | Markless ideal-ness | Frameless ideal-ness | Asymmetry, stated |
|---|---|---|---|
| C1 provider/root | GOOD — payload channel native (P1); root render exists; but provider is framework ceremony around a graph capability, fake-nestable (S1) | STRONG — exact next-themes shape React devs run in production (E3); generated root is a natural emitter artifact; React 19 rendered-script warning is known friction (E3) | More idiomatic in compiled React/Solid than in native markless; frameless is the stronger mode |
| C2 build-config/artifact | STRONG — markless build already owns payload emission; boot artifact fits progressive model (P1, S2) | MIXED — behavior lives in config + head script; copying a component doesn't copy its behavior; deploy/cache ordering risk (S2) | Home turf for markless, ceremony for React apps; markless is the stronger mode |
| C3 plain cell v1 | MIXED — correct (P2/P3) but the motivating case (immediate theme) flashes (S3) | MIXED — same; SSR/hydration path unprobed (T003 limits) | Symmetric: equally honest, equally weak on the product promise, both modes |
| C4 compiled upgrade | MIXED→GOOD — runtime meaning stays truthful; markless build CAN seed early via P1, but the semantic doesn't promise it; uncompiled native use may flash (S4) | STRONG — compiled targets get no-flash as a guarantee; P3 proved the upgrade framing is technically honest | The asymmetry IS the candidate: identical source observably stronger under frameless compilation (S4, E5) — must be surfaced to users, not hidden |
| C5 module-scope | MIXED — shared() precedent makes it feel native; forbids per-instance/factory cells (S5) | MIXED — same restriction; solves analyzability, not semantics (S5) | Roughly symmetric; not a standalone design — a restriction layered on C1/C2/C4 (S5, INF) |
| C6 manifest | MIXED — router-style precedent tolerable but excessive for a preference cell (S6) | WEAK — generated imports, editing/testing friction, transitive discovery unprobed (S6, T003 limits) | Frameless is the weaker mode: indirection lands hardest on React/Solid consumers |
| C7 directive | MIXED — markless owns its compiler so parsing is feasible; two controls to learn (S7) | WEAK — custom directive in code compiled to React looks language-level but is tool-specific; tooling unprobed (S7, T003 limits) | Frameless is the weaker mode |
| C8 app-owned cell | MIXED — perfect consent story, but every app wires every cell; libraries can't ship self-contained persistence (S8) | MIXED — same; neutral cross-framework cell type unprobed (T003 limits) | Symmetric: strongest on principle rows, weakest on ergonomics, in both modes equally |

### Constraint rows × candidates

**Declaration-inertness principle (E5)** — C1 PASS (inert until root renders). C2 PASS (inert until config/artifact). C3 PASS (nothing page-level exists). C4 TENSION — semantically inert, but identical source behaves observably stronger when compiled; P3 makes the framing honest, the observability concern remains. C5 PASS + statically discoverable. C6 PASS (manifests don't execute). C7 PASS (directive declares, never acts). C8 PASS by construction.

**Consent/storage-access ownership (E1)** — C1 PASS (root render/config timing is the app's). C2 PARTIAL (static pre-paint include fits runtime-changing consent poorly; post-consent load forfeits first-visit no-flash). C3 PASS (driver install is the gate). C4 PASS only while the upgrade flag/artifact stays app-owned; auto-injection would break it. C5 PASS. C6 PASS (manifest activation + driver choice). C7 PASS (the consent-granting directive variant was killed in T002 for this row). C8 PASS by construction.

**Explicit-boundary pattern (E2)** — C1 PASS (visible root component; production precedent). C2 PARTIAL (build flag less visible than a page-root component; explicit HTML include is visible; silent CLI injection would fail outright). C3 PASS trivially. C4 PARTIAL (flag visible in config, invisible at declaration site). C5 PARTIAL (aids discoverability, not behavior visibility). C6 PASS (explicit but far from usage site). C7 PASS (most literal match, with E2-scope caveat). C8 PASS (everything is app code).

**No-markless-import for frameless consumers (constraint + P5)** — C1–C7: via facade — but P5 EXECUTED: facade rejected today; import-rewrite now; accepted-import-source is a markless-side (fixing-board) change. Identical gate for all seven. C6 alternative: neutral schema package (lower branding coupling, new public compat surface). C8 STRONGEST here — libraries import nothing storage-branded; only the app-authored line hits P5; the neutral cell type it needs is unprobed.

**Device-state-not-data scope** — all eight fit as designed. INF: C6 and C8 have the most natural drift paths toward data-sync ambitions; would need charter policing.

**Driver sync/async posture** — C1: sync pre-read; async = app-selected await-before-render or fallback-then-patch (patch proven, P2/P3). C2: sync seeds in blocking artifact; async cannot run in a blocking seed — barrier/snapshot/patch. C3: sync at init; async readiness/fallback. C4: sync participates in compiled seed; compilation cannot make async synchronous. C5: as C1. C6: manifests can state first-paint vs interaction without executing code — a genuine advantage of this row only; same async menu. C7: compiler should reject unqualified first-paint promises on async-only targets. C8: app awaits before supplying the capability, or exposes readiness the library must tolerate.

**Key identity/namespacing** — C1–C5, C7: explicit key + package qualification + shared-namespace escape; key stability across renames/aliases/multiple versions unprobed for ALL. C6: manifest-identity qualification + app remap; duplicate-key merge must be identical-or-fail. C8: app owns every key — no library collisions; app can still self-conflict.

**Implementation cost TODAY vs post-fixing-board (P5-gated)** — C1 moderate (rewrite + store/root emitters + generated payload-merge; P1 proved the channel). C2 moderate-high (+ build plugin + artifact + placement + deploy ordering). C3 LOWEST (rewrite + plain store emission; P2 executed the exact pattern). C4 moderate (+ render-reachability analysis, unprobed). C5 adds a compile restriction to its base. C6 HIGH (transitive manifest discovery unprobed + codegen plumbing). C7 HIGH (directive tooling unprobed). C8 low mechanically, highest ecosystem-ergonomics cost.

### Why the menu headlines four options, not eight (Judge composition judgment, not a kill)

C5 is an add-on restriction available under any headlined option. C6 and C7 are NOT killed — they score weakest in the frameless column with the largest unprobed tooling costs, so they are promotable alternates. The owner may promote either.

## Part 2 — Decision menu

(Delivered to the owner by the PM at T005 — four options: 1 provider/root switch; 2 build-config + explicit include; 3 plain persisted cell now, no-flash later; 4 app-owned cells, libraries receive capability. Plus promotable alternates C6/C7 and the module-scope add-on. RECOMMENDATION: Option 1 with Option 3's meaning as the stated contract — storage() means "persisted cell that may briefly show its fallback"; the app-root switch upgrades to no-flash; Option 3 alone as safe staging. Subordinate to the owner's choice.)

## Part 3 — Misfire self-check

Nothing herein is ratified. Risky-reading spots: (1) the recommendation pairs C1 with C4's semantic framing — Judge synthesis, not a prior candidate; (2) headlining 4 of 8 is composition judgment; (3) PASS/FAILS cells are scores against owner-stated constraints incl. unratified leanings; (4) T002's kills are scout reasoning, unratified; (5) "P3 makes the upgrade framing honest" is an executed-evidence feasibility claim, not an adoption.
