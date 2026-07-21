# T002 — Candidate steelman (crew scout, 2026-07-21)

# Structured receipt

## Receipt status and boundaries

- EVIDENCE — The charter defines this as exploration only; the owner ratifies any eventual design. Every design below is therefore candidate material, not a ruling.
- EVIDENCE — Frameless consumers must never be required to import markless-branded packages. (`goal.md`, Non-Negotiable Constraints.)
- EVIDENCE — Storage-access timing must remain app-controlled because consent/exemption classification belongs to the app. (`T001-banked-evidence.md`, Evidence 1.)
- EVIDENCE — Explicit execution boundaries and app-visible enablement have ecosystem precedent. (`T001-banked-evidence.md`, Evidence 2.)
- EVIDENCE — next-themes demonstrates provider-as-enablement, including CSP nonce ownership. (`T001-banked-evidence.md`, Evidence 3.)
- EVIDENCE — Markless already has script-fed resume-payload machinery; writes need notification-atomic timing; storage events do not notify the writing tab. (`T001-banked-evidence.md`, Evidence 4.)
- EVIDENCE — Making first-paint behavior an invisible consequence of a declaration conflicts with the recorded declaration-inertness concern. (`T001-banked-evidence.md`, Evidence 5.)

## Surviving candidate 1 — Inert declaration plus provider/boot-boundary enablement

### Surface

- CANDIDATE — A library declares capability without accessing storage:

```ts
// Markless-authored library
import { storage } from '@markless/storage';
export const theme = storage('theme', 'light');
```

```ts
// Frameless-authored library
import { storage } from '@frameless/authoring';
export const theme = storage('theme', 'light');
```

- CANDIDATE — The app visibly enables behavior at its root:

```tsx
// Markless app
<StorageRoot
  driver={localStorageDriver()}
  seed="before-first-paint"
  nonce={cspNonce}
>
  <App />
</StorageRoot>
```

```tsx
// React/Solid app consuming Frameless output
<GeneratedStorageRoot
  seed="before-first-paint"
  nonce={cspNonce}
>
  <App />
</GeneratedStorageRoot>
```

### Per-mode behavior

- CANDIDATE — In Markless, `storage()` contributes a static graph record but performs no I/O until `StorageRoot` installs a driver. The root asks the generated early storage chunk to read first-paint keys before the owning render chunks execute; values land through the native resume-payload channel. Interaction-only cells remain in their owning lazy chunks.
- EVIDENCE — Script-fed resume state is native to the pinned Markless runtime through `resumeFromPayloadScripts`. (`T001-banked-evidence.md`, Evidence 4.)
- CANDIDATE — In Frameless, the facade call becomes a target-agnostic graph record. React and Solid emitters generate the framework store, write-through code, and a target-owned `GeneratedStorageRoot`; no Markless runtime or Markless-branded import remains in published output.
- CANDIDATE — The consuming Frameless app must render the generated root in the framework-prescribed root/head position. That visible line is the page-level opt-in.

### Cross-cutting axes

- CANDIDATE — Key identity is explicit and package-qualified by compilation: `<declaring-package>:<authored-key>`. An explicit fully-qualified escape hatch can be represented separately, for example `{ key: 'shared.theme', namespace: false }`, instead of overloading punctuation.
- INFERENCE — Explicit keys avoid rename-orphaning; package qualification prevents unrelated libraries both using `theme` from colliding. Applications intentionally sharing state need an explicit shared namespace.
- CANDIDATE — Package home is `@markless/storage` for native Markless and a Frameless authoring facade for compiled libraries. The facade is recognized as the same semantic record source, either by accepted-import-source registration or deterministic compiler aliasing.
- INFERENCE — The facade adds packaging, type-reexport, source-recognition, and version-skew costs; deterministic rewriting is simpler initially but is a privileged compiler special case.
- CANDIDATE — Enablement belongs to the app root on both platforms. A library cannot force `before-first-paint` merely by declaring a cell.
- CANDIDATE — A synchronous driver reads before child initialization and writes in the store’s post-transaction phase.
- EVIDENCE — The banked transaction contract requires authored-order synchronous writes and one post-method notification. (`T001-banked-evidence.md`, Evidence 4.)
- CANDIDATE — An asynchronous driver exposes one of two app-selected boot policies: `await-before-render`, which delays the first frame, or `fallback-then-patch`, which renders the authored initial and patches when SQLite answers. Writes are ordered in a driver queue and surface failures through an app-owned error hook.
- INFERENCE — An async driver cannot honestly promise both immediate first paint and no boot delay unless the app supplies a previously serialized synchronous seed.
- CANDIDATE — Consent timing is controlled by whether and when the app renders/configures `StorageRoot`. CSP nonce/hash policy is passed by the app; native targets have no browser CSP step.

### Sharpest argument against

- EVIDENCE — Provider enablement has direct production precedent in next-themes. (`T001-banked-evidence.md`, Evidence 3.)
- CANDIDATE — The best-informed criticism is that a provider is framework ceremony wrapped around a graph-level capability. It creates ordering and placement rules, can collide with React’s treatment of rendered scripts, and makes a compile-time fact look dynamically nestable even though there should normally be one page-wide seed phase. It may also suggest that a component subtree can safely control storage already needed before that provider rendered.

### Failure modes

- CANDIDATE — If a library expects no flash but the app omits the root or selects runtime-only seeding, the authored fallback appears first. The compiler should diagnose a first-paint read without matching enablement.
- CANDIDATE — If the app gates consent but the library reads during mount, the declaration returns its fallback without touching storage until the root enables the driver; enabling later patches the cell and cannot retroactively provide a no-flash first paint.
- CANDIDATE — Two libraries using `theme` remain distinct through package namespaces. Collision still occurs if both deliberately request the same explicit shared namespace with incompatible value schemas.

## Surviving candidate 2 — Inert declaration plus build configuration and explicit seed artifact

### Surface

```ts
// CANDIDATE — Library surface in the applicable authoring package/facade.
export const theme = storage('theme', 'light');
```

```ts
// CANDIDATE — Markless application build configuration.
export default defineMarklessConfig({
  storage: storagePlugin({ driver: 'web-local', seed: 'first-paint' }),
});
```

```ts
// CANDIDATE — Frameless application build configuration.
export default defineFramelessConfig({
  storage: { driver: 'web-local', emitSeed: true },
});
```

```html
<!-- CANDIDATE — Explicit application-owned inclusion when injection is not used. -->
<script src="/assets/frameless-storage-seed.js" nonce="…"></script>
```

### Per-mode behavior

- CANDIDATE — Markless compilation records storage cells, partitions first-paint reads into an early chunk, and emits a boot artifact that fills the resume payload before normal progressive chunks execute. The native runtime driver handles subsequent reads and writes.
- CANDIDATE — Frameless emitters generate a consolidated read-and-seed artifact plus React/Solid stores. The application’s build owns emission, HTML placement, and CSP attributes; generated framework code synchronously consumes the landing slot before its first render.
- CANDIDATE — Libraries publish only semantic records through their source; they do not publish executable page-level seed scripts.

### Cross-cutting axes

- CANDIDATE — Keys are explicit and qualified with compiler-known package provenance. Shared cross-library keys require an app-declared alias map, which also provides a place to detect incompatible defaults or schemas.
- CANDIDATE — Markless authors use `@markless/storage`; Frameless authors use the native facade. Both are recognized as producers of the same spec-shaped graph record, and emitters never depend on either runtime implementation.
- INFERENCE — A truly spec-shared record needs versioning and compatibility rules; otherwise the facade is nominally separate while still being coupled to Markless internals.
- CANDIDATE — The app author writes the enabling build line and, where required, the HTML include. Libraries cannot enable the feature transitively.
- CANDIDATE — Sync drivers seed during the blocking artifact and write after committed store transactions. Async drivers cannot run in a normal blocking browser seed; their configuration must choose an app boot barrier, an app-supplied synchronous snapshot, or fallback-then-patch.
- CANDIDATE — Consent is controlled by omitting the artifact, conditionally loading it after consent, or choosing a non-reading driver. CSP hashes can be emitted in build receipts for stable content; nonce attachment remains owned by the app template.

### Sharpest argument against

- CANDIDATE — The strongest criticism is integration fragility: correctness depends on config and HTML outside the authored library, so copying a component does not copy its behavior. A build flag can also be less visible than a provider at the page root. Static pre-paint inclusion is a poor fit for consent that changes at runtime, and a generated artifact adds deployment/cache ordering risks.
- EVIDENCE — Invisible boundary changes run against the explicit-boundary pattern; therefore a CLI silently injecting the artifact would weaken this candidate. (`T001-banked-evidence.md`, Evidence 2.)

### Failure modes

- CANDIDATE — Library/app disagreement over no-flash produces a missing-artifact diagnostic; without enforcement it produces fallback-first rendering.
- CANDIDATE — Consent-gated apps cannot both defer storage access and promise a stored-value first paint on the initial visit. The build must expose that incompatibility rather than silently reading.
- CANDIDATE — Package qualification prevents accidental key collisions, while an app alias map can create deliberate collisions; the compiler should reject conflicting defaults or record types where statically visible.

## Surviving candidate 3 — Plain persisted reactive cell only in v1

### Surface

```ts
// CANDIDATE — Markless library.
import { storage } from '@markless/storage';
export const theme = storage('theme', 'light');
```

```ts
// CANDIDATE — Frameless library.
import { storage } from '@frameless/authoring';
export const theme = storage('theme', 'light');
```

```ts
// CANDIDATE — App installs the runtime capability; no seed feature exists in v1.
installStorageDriver(localStorageDriver());
```

### Per-mode behavior

- CANDIDATE — Markless wakes the owning progressive chunk when the value is first read. With localStorage, that chunk synchronously reads before producing its portion of the render; no separate payload seed is promised.
- CANDIDATE — Frameless emitters generate an ordinary React external store or Solid signal whose initializer asks the installed driver. In a client-only mount, localStorage may be read before the framework commits; SSR/hydration and delayed driver installation receive the authored fallback and may patch later.
- CANDIDATE — The consuming app installs a target-native driver but has no head artifact or provider seed responsibility.

### Cross-cutting axes

- CANDIDATE — Explicit, package-qualified keys are used; shared namespaces are opt-in.
- CANDIDATE — The package/facade split is identical to candidates 1–2, with target-agnostic records and no Markless runtime in Frameless output.
- CANDIDATE — The app’s visible enablement line is driver installation. It controls runtime storage access but offers no first-paint seed contract.
- CANDIDATE — Sync drivers return the stored value during cell initialization and receive notification-atomic writes. Async drivers return a fallback/readiness state immediately, patch later, and serialize queued writes; an app that needs an async value before rendering must await driver initialization outside this primitive.
- CANDIDATE — Consent ownership sits at driver installation. CSP is irrelevant because v1 emits no inline seed script.

### Sharpest argument against

- CANDIDATE — The strongest criticism is that this postpones the hard part named by the task. Theme and preferences needed immediately are precisely where fallback-then-patch is visible or hydration-sensitive. Shipping a plain cell may establish compatibility expectations that make a later first-paint feature harder to add cleanly.
- INFERENCE — This candidate is conceptually honest and inert but does not by itself satisfy a no-flash requirement.

### Failure modes

- CANDIDATE — A library expecting no-flash has no enforceable contract; documentation is the only warning unless the compiler flags first-paint use.
- CANDIDATE — A consent-gated app gets safe fallback behavior before installation, but a library that treats the fallback as a persisted answer may perform incorrect mount-time work.
- CANDIDATE — Namespacing handles accidental collisions; deliberately shared keys can still disagree on schema, fallback, or write policy.

## Surviving candidate 4 — Runtime persisted cell with a compiler-provided upgrade

### Surface

```ts
// CANDIDATE — Same source in either branded authoring surface.
export const theme = storage('theme', 'light');
```

```ts
// CANDIDATE — Frameless app accepts the compiled upgrade visibly.
export default defineFramelessConfig({
  upgrades: { storageFirstPaint: 'enabled' },
});
```

### Per-mode behavior

- CANDIDATE — The portable semantic meaning is only “a persisted reactive cell with fallback.” Markless runtime execution remains truthful without compilation: the owning chunk reads its configured driver when awakened. A Markless compiler may schedule that chunk early, but no-first-paint correctness is not intrinsic to `storage()`.
- CANDIDATE — Frameless compilation upgrades render-reachable cells by emitting the seed artifact and landing-slot reads. Interaction-only cells remain lazy. React/Solid output contains only target-native code.
- CANDIDATE — The consuming Frameless app must enable/include the upgrade so consent and CSP remain app-owned; otherwise the compiler emits plain runtime persistence and a warning for first-paint reads.

### Cross-cutting axes

- CANDIDATE — Keys are explicit, package-qualified, and target-independent.
- CANDIDATE — Markless uses its runtime package; Frameless uses its facade and graph-record contract. The “upgrade” belongs to the Frameless compiler, not the Markless package.
- CANDIDATE — Markless enablement is driver installation; Frameless has both driver selection and an app-visible upgrade flag/artifact.
- CANDIDATE — Sync drivers can participate in the compiled seed. Async drivers require a precomputed snapshot, boot barrier, or documented fallback patch; compilation cannot turn asynchronous SQLite into a synchronous read.
- CANDIDATE — Consent and CSP stay at the upgrade flag/artifact seam. Automatic unconditional injection would contradict this strongest version.

### Sharpest argument against

- CANDIDATE — The strongest criticism is semantic asymmetry: identical source has materially stronger first-paint behavior under Frameless compilation than under direct Markless runtime use. Calling that an optimization may be misleading when users can observe a flash. It also risks making correctness depend on whether a compiler recognized a render-read edge.
- EVIDENCE — The banked inertness analysis identifies exactly this tension between runtime meaning and artifact-provided guarantees. (`T001-banked-evidence.md`, Evidence 5.)

### Failure modes

- CANDIDATE — A library tested only under the compiled upgrade may flash when consumed natively without early scheduling.
- CANDIDATE — A consent-gated app disables the upgrade; mount reads receive fallback and may patch after consent.
- CANDIDATE — Cross-library key conflicts are controlled by package qualification, but independently compiled artifacts must agree on qualification and landing-slot ownership.

## Surviving candidate 5 — Module-scope-restricted storage declarations

### Surface

```ts
// CANDIDATE — Legal.
import { storage } from '@frameless/authoring';
export const theme = storage('theme', 'light');

// CANDIDATE — Compile error: storage() may not appear in a component/factory.
function Card() {
  const localPreference = storage('density', 'comfortable');
}
```

```ts
// CANDIDATE — App-owned runtime/build enablement.
configureDeviceStorage({ driver: localStorageDriver(), seed: 'first-paint' });
```

### Per-mode behavior

- CANDIDATE — Markless treats each module-scope declaration as a static graph resource. After app configuration, first-paint resources can be placed in an early chunk and fed into resume payloads; other resources load with their reading chunks.
- CANDIDATE — Frameless recognizes module-scope calls through the facade, emits stable graph records, and lowers them into React/Solid stores and an app-enabled seed artifact.
- CANDIDATE — The app must configure the driver/seed policy; module scope makes the declaration statically discoverable but does not itself grant storage consent.

### Cross-cutting axes

- CANDIDATE — Keys remain explicit and package-qualified. Module identity may contribute diagnostic identity but should not be the persisted key because file moves would orphan preferences.
- CANDIDATE — Package separation uses the same facade/spec-record mechanism. Restricting scope simplifies accepted-import tracking but constrains ordinary component encapsulation.
- CANDIDATE — Enablement is an app config/root line on both platforms; the module declaration stays inert until that line runs.
- CANDIDATE — Sync/async and write behavior match candidate 1: synchronous pre-read where possible; otherwise boot barrier, synchronous snapshot, or fallback patch; ordered writes after state transactions.
- CANDIDATE — Consent and CSP remain app configuration concerns. Module loading alone must not touch storage.

### Sharpest argument against

- CANDIDATE — The strongest criticism is that scope restriction solves analyzability, not product semantics. It forbids per-instance persisted cells, factory-generated preferences, and dependency-injected stores even where keys are explicit. If the compiler already tracks semantic calls, module scope may be unnecessary ceremony that still needs a separate enablement design.

### Failure modes

- CANDIDATE — A library can declare first-paint intent while an app enables only runtime persistence; the compiler must warn rather than infer permission.
- CANDIDATE — Consent gating returns fallback until configuration, with the same mount-time disagreement risk as other inert candidates.
- CANDIDATE — Package qualification prevents ordinary collisions; duplicate declarations of the same key inside one package need a compile error or an explicitly shared-cell rule.

## Surviving candidate 6 — Build-facing storage manifest/file convention

### Surface

```ts
// CANDIDATE — storage.manifest.ts, owned by a library or app.
import { defineDeviceState } from '@frameless/authoring/storage-manifest';

export default defineDeviceState({
  theme: { key: 'theme', initial: 'light', neededAt: 'first-paint' },
  draft: { key: 'compose.draft', initial: '', neededAt: 'interaction' },
});
```

```ts
// CANDIDATE — Component code imports generated/runtime cells.
import { theme } from './storage.generated';
```

```ts
// CANDIDATE — App chooses which manifests and driver policy are active.
export default defineFramelessConfig({
  storageManifests: ['app', '@acme/ui/storage'],
  storageDriver: 'web-local',
});
```

### Per-mode behavior

- CANDIDATE — Markless’s build tool reads selected manifests, creates graph resources, schedules first-paint entries into the boot/resume payload, and exposes ordinary reactive cells to progressive chunks.
- CANDIDATE — Frameless CLI reads the same logical manifest shape through its own facade/spec package, emits target-native stores plus a consolidated seed artifact, and strips manifest/runtime helpers from React/Solid output.
- CANDIDATE — The consuming app explicitly lists or accepts manifests; dependency installation alone does not authorize storage access.

### Cross-cutting axes

- CANDIDATE — Manifest entry names are diagnostic handles; persisted keys remain explicit and are qualified by the manifest package identity. Apps can explicitly remap a library key into a shared namespace.
- CANDIDATE — A neutral manifest schema package or duplicated branded facades can prevent Frameless imports from mentioning Markless. A neutral shared specification lowers branding coupling but creates another public compatibility surface.
- CANDIDATE — The visible enablement line is the app’s manifest list and driver policy. Generated HTML inclusion remains app-owned when required.
- CANDIDATE — Manifests can state first-paint versus interaction needs without executing code. Sync drivers seed directly; async drivers still require a boot barrier/snapshot or fallback patch. Writes are handled by generated target stores.
- CANDIDATE — Consent is controlled by manifest activation and driver choice. CSP hash/nonce handling belongs to the app build/template.

### Sharpest argument against

- CANDIDATE — The strongest criticism is indirection: state ownership moves away from the component that uses it, generated imports complicate editing and testing, and package managers/build tools must reliably discover transitive manifests. The file becomes a second source of truth for types, defaults, and usage. Router-style conventions may be tolerable for routes but excessive for a preference cell.

### Failure modes

- CANDIDATE — If an app omits a library manifest, generated cells need a defined unavailable/fallback form and the build should report that first-paint behavior was not activated.
- CANDIDATE — Consent-gated apps can activate the manifest later, but the original first paint necessarily used fallback.
- CANDIDATE — Two manifests with the same package-qualified key must either merge only when definitions are identical or fail compilation; silent last-writer behavior is unsafe.

## Surviving candidate 7 — Explicit declaration directive/marker

### Surface

```ts
// CANDIDATE — The directive marks this module as declaring device-state effects.
'use device-storage';

import { storage } from '@frameless/authoring';
export const theme = storage('theme', 'light', { neededAt: 'first-paint' });
```

```ts
// CANDIDATE — App permission remains separate.
allowDeviceStorage({ driver: 'web-local', prepaint: true });
```

### Per-mode behavior

- CANDIDATE — Markless treats marked module-scope calls as eligible for graph extraction and progressive early-chunk placement. Without app permission, they remain fallback cells and perform no I/O.
- CANDIDATE — Frameless recognizes the directive and facade calls, records needed-at metadata, and emits React/Solid seed/store code only under app permission. No Markless runtime ships.
- CANDIDATE — The directive is written by the library author to expose intent; the enablement line is written by the app author to authorize actual page-level behavior.

### Cross-cutting axes

- CANDIDATE — Keys are explicit and package-qualified; the directive affects execution classification, not identity.
- CANDIDATE — Each branded authoring surface can parse the same reserved directive into a shared graph-record shape. This avoids a Markless import but consumes syntax-like namespace and requires tooling support.
- CANDIDATE — Library intent and app permission are deliberately two separate visible boundaries.
- CANDIDATE — Sync drivers satisfy first-paint reads when permission is active. Async drivers must downgrade to a fallback patch, use a snapshot, or hold app boot; the compiler should reject an unqualified first-paint promise for a known async-only target.
- CANDIDATE — The app permission line owns consent. Its seed integration owns nonce/hash choice; the directive cannot override either.

### Sharpest argument against

- CANDIDATE — The strongest criticism is that the directive announces a boundary but does not perform the necessary app authorization, so users now learn two controls. If it did authorize storage by itself, a library could impose consent and CSP behavior on its host. A custom directive may also look language-level while being understood only by selected build tools.
- EVIDENCE — Explicit boundary syntax has ecosystem precedent, but that evidence does not establish this particular directive or its semantics. (`T001-banked-evidence.md`, Evidence 2.)

### Failure modes

- CANDIDATE — A library marks first-paint intent while the app denies prepaint access; the build reports the mismatch and uses fallback semantics.
- CANDIDATE — Consent granted after mount patches the cell but cannot restore the missed first paint.
- CANDIDATE — Directives do not prevent key collisions; package qualification and conflicting-definition diagnostics remain necessary.

## Surviving candidate 8 — App owns the persisted cell; libraries receive a capability

### Surface

```ts
// CANDIDATE — Library owns no storage declaration.
export interface ThemeCell {
  value: 'light' | 'dark';
  set(value: 'light' | 'dark'): void;
}

export function ThemeShell(props: { theme: ThemeCell }) {
  return <main data-theme={props.theme.value}>{props.children}</main>;
}
```

```ts
// CANDIDATE — Markless app owns storage identity and policy.
import { storage } from '@markless/storage';
const theme = storage('app.theme', 'light');
render(<ThemeShell theme={theme} />);
```

```ts
// CANDIDATE — Frameless app owns the equivalent declaration.
import { storage } from '@frameless/authoring';
const theme = storage('app.theme', 'light');
render(<ThemeShell theme={theme} />);
```

### Per-mode behavior

- CANDIDATE — Markless sees an app-owned record and can place its read in the chunk/payload phase implied by actual app use. The library receives only a reactive capability.
- CANDIDATE — Frameless emitters lower the app-owned record into React/Solid stores and seed artifacts. The library’s compiled component has no persistence-specific runtime dependency.
- CANDIDATE — The app performs driver installation and seed enablement because it owns the declaration.

### Cross-cutting axes

- CANDIDATE — The app explicitly owns keys, namespace, migration-by-key-change, and any intentional sharing between libraries. Library packages contribute no storage keys to collide.
- CANDIDATE — Markless and Frameless each expose their native branded authoring surface; library interfaces are neutral structural types. A shared neutral `Cell` type may be needed to prevent nominal package coupling.
- CANDIDATE — The app writes every visible enablement line and can choose different policies for different integrations.
- CANDIDATE — Sync localStorage can seed before render. Async SQLite can be awaited by the app before supplying the capability or represented as fallback-then-patch; the library must tolerate the cell’s readiness contract. Writes flow through the supplied capability and its driver queue.
- CANDIDATE — Consent and CSP are naturally app-owned because no library code can touch storage without the supplied capability.

### Sharpest argument against

- CANDIDATE — The strongest criticism is loss of library encapsulation and portability. Every app must wire cells, choose keys/defaults, and possibly reproduce adapters before a component works. A library cannot ship a self-contained persisted draft or guarantee no-flash behavior, and subtle requirements migrate into prose or complex prop types.

### Failure modes

- CANDIDATE — A library wanting no-flash cannot enforce it; it must declare a capability requirement and tolerate fallback or reject a non-ready cell explicitly.
- CANDIDATE — Consent-gated apps can withhold or delay the capability, but libraries that assume immediate readiness may malfunction unless readiness is part of the type/contract.
- CANDIDATE — Two libraries collide only if the app deliberately supplies cells backed by the same key. That centralizes responsibility but does not protect against incompatible schemas chosen by the app.

## Cross-candidate enforcement extension — compiler warning/error middle ground

- CANDIDATE — This is an enforcement layer, not a standalone semantic candidate: when a stored cell reaches first paint but the app has not enabled a compatible seed path, the compiler reports the library declaration, consuming render path, target driver, and resulting fallback/flash behavior.
- CANDIDATE — Warning mode preserves incremental adoption; error mode can be selected by applications promising no-flash behavior.
- CANDIDATE — A known async driver combined with an unconditional first-paint guarantee should report that the app must choose boot blocking, a synchronous snapshot, or fallback-then-patch.
- INFERENCE — This layer materially strengthens candidates 1, 2, 5, 6, and 7 by turning library/app disagreement into a visible build receipt rather than silent behavior.

## Killed or subsumed candidates

- CANDIDATE — `state(initial, { persist: … })` is killed as a separate candidate because it is surface syntax for the same semantic record, driver, seed, and consent choices as `storage(key, initial)`; it can remain a syntax alternative only if ergonomics are separately tested.
- CANDIDATE — Derived-key default is killed as a separate candidate because it changes identity policy, not the delivery architecture; it is also safely represented as an option within any surviving candidate and carries rename/file-move orphaning risk.
- CANDIDATE — “Explicit include” and “build option” are merged into candidate 2 because their strongest honest form is one build-owned enablement contract: configuration emits the artifact and the app either explicitly includes it or authorizes controlled injection.
- CANDIDATE — A provider that silently auto-installs merely because a library imports `storage()` is killed because it ceases to be app-level enablement and recreates the declaration-inertness and consent problem.
- CANDIDATE — A directive that itself grants storage permission is killed; it lets a library choose application consent timing. The surviving directive only declares library intent.
- CANDIDATE — Compiler warnings are subsumed as an enforcement layer because warnings alone neither store state nor define who performs I/O.
- CANDIDATE — A neutral specification package is not a separate behavioral candidate; it is one possible mechanism for satisfying the branding constraint within several candidates.
- CANDIDATE — `neededAt` as explicit options versus compiler-derived reachability is not a separate delivery candidate. It is an analysis-policy choice that can be probed within every seed-capable design.

## Unknowns requiring probes for T003

- INFERENCE — The exact `resumeFromPayloadScripts` input shape, execution phase, precedence rules, and whether it can be populated by an early storage chunk without modifying core require a pinned-source/runtime probe.
- INFERENCE — Progressive-chunk placement needs a probe showing whether first-paint storage code can execute early without pulling unrelated library/runtime code into the boot path.
- INFERENCE — The current compiler’s ability to recognize semantic calls from a Frameless facade or neutral accepted-import source has not been established here.
- INFERENCE — The graph record needs a probed ownership identity: package name, export identity, source path, and behavior under bundler deduplication or package aliases.
- INFERENCE — No evidence read here establishes whether package-qualified keys remain stable across package renames, forks, monorepo workspace aliases, or multiple installed versions.
- INFERENCE — React and Solid probes are needed for seed consumption before initial render, SSR hydration behavior, external-store snapshot rules, Strict Mode, and duplicate library instances.
- EVIDENCE — React 19 friction around component-rendered scripts is banked, but the applicable generated-root integration and safe placement still require a probe. (`T001-banked-evidence.md`, Evidence 3.)
- INFERENCE — CSP probes are needed for stable inline hashes, per-request nonces, external seed files, and whether generated script content remains byte-stable across deployment rewriting.
- INFERENCE — A browser probe should measure consolidated blocking-script cost by key count/value size and establish a budget or demotion rule.
- INFERENCE — SQLite/native work needs an actual driver contract: initialization lifecycle, cancellation, read consistency, queued-write ordering, transaction failure, process restart, and synchronous snapshot availability.
- INFERENCE — Consent-gated enablement needs a behavioral probe for enabling a driver after mount, including whether cells reread once, subscribe, or remain on fallback.
- INFERENCE — Cross-tab behavior needs probes for same-document writes, other-tab events, sessionStorage limitations, malformed values, private/disabled storage, and multiple generated bundles.
- INFERENCE — Manifest discovery requires probes across transitive dependencies, tree-shaking, package exports, monorepos, duplicate package versions, and opt-out behavior.
- INFERENCE — The directive candidate requires parser/tooling probes to determine legal placement, preservation through transforms, diagnostics outside supported compilers, and collision with existing directive semantics.
- INFERENCE — Needed-at derivation requires a graph probe covering reexports, conditional rendering, callbacks passed across packages, dynamic component selection, and reads hidden behind helper functions.
- INFERENCE — The value contract remains unresolved: JSON-only values, schema/version handling, corrupt-value fallback, and whether two declarations sharing a key must prove compatible.
- INFERENCE — The app-owned-cell inversion needs type probes showing whether one neutral cell capability can preserve reactive behavior across Markless, generated React, and generated Solid without importing a branded runtime type.
