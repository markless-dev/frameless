# T003 — Mitosis external adoption evidence (Scout receipt note)

Provenance: Claude general-purpose research agent with web access (crew fallback:
Codex crew workers have no web access, so per the charter's fallback clause the PM
dispatched an installed-agent scout instead; ~50 tool uses, 2026-07-19). Every factual
claim carries a source URL; opinion is labeled. PM highlights first; full report below.

## PM highlights

- **Hype-to-adoption gap is the headline number.** 13,895 GitHub stars vs ~7,600 npm
  weekly downloads and ~200 dependents. Stencil does ~1.27M/wk, Lit ~6.2M/wk — the
  cross-framework budget went to web components by 2–3 orders of magnitude.
- **Verified adopters reduce to two:** Builder.io's own SDKs and Deutsche Bahn's DB UX
  design system — and DB UX had to staff its own Mitosis contributor to keep it viable.
  The oft-repeated AWS Amplify adoption is unsupported; Amplify's RFC #3933 publicly
  chose hand-written per-framework components ("We want React components feel like
  React components").
- **Abandonment tracks Builder.io's strategy, and was never announced.** Commits
  collapsed from ~40/month to ~0 starting July 2025; sole maintainer Sami Jaber vanishes
  from the log; top 2025 "committer" is a bot; README still begs for contributors.
  Aligns with Qwik handoff (Mar 2024) and Fusion AI pivot (Nov 2025).
- **The only deep field report (Voorhoede, Sep 2024) is damning on DX:** "testing and
  debugging your Mitosis code can be a pain in the ass" — stripped console.logs, no
  output validation, no version targeting; verdict: don't build a design system on it.
- **Discourse absence is itself a finding:** 11 HN submissions, best ever 9 points /
  0 comments; no findable Reddit threads. Stars without conversation.
- **Never 1.0 in 5.5 years** — evaluators who liked the concept (SAP Fundamental
  Library, 2022) waited for polish that never came.
- **Evidence gaps flagged honestly:** no "lowest common denominator" quote found in
  the wild (only its functional equivalent); no public migration-away postmortems; no
  explicit deprecation statement from Builder.io.

Implication for T004: external evidence supports "execution + ownership failure with a
real-but-niche market", not "category impossible". The niche (teams maintaining 3+
framework targets) is small but was real enough to attract 13.9k stars; the two-sided
markless thesis must be labeled a strategic bet, not a provable claim.

---

## Full research report

# Mitosis (Builder.io) — External Adoption Evidence Report

Scope note on evidence quality: Mitosis left a surprisingly thin public discourse trail. That absence is itself a finding — for a 13.9k-star project, there is almost no HN discussion, no findable Reddit threads, and only a handful of third-party experience reports. Where evidence is thin or unverifiable I say so explicitly. Local git evidence comes from the clone at `/Users/jacksm5pro/dev/open-source/mitosis`.

## 1. Adoption numbers

**Facts (verified):**
- **GitHub**: 13,895 stars, 635 forks, 93 watchers, 176 open issues; repo created 2020-11-06; last push 2026-06-05 ([GitHub API](https://api.github.com/repos/BuilderIO/mitosis), [repo](https://github.com/BuilderIO/mitosis)).
- **npm weekly downloads** ([npm downloads API](https://api.npmjs.org/downloads/point/last-week/@builder.io/mitosis)): `@builder.io/mitosis` ~7,600/week (Jul 12–18, 2026); `@builder.io/mitosis-cli` 2,455 same week. Third-party trackers agree on order of magnitude: [npmtrends](https://npmtrends.com/@builder.io/mitosis) ~5.3k, [Snyk](https://snyk.io/advisor/npm-package/@builder.io/mitosis) ~4.6k.
- **Download trend** (npm API range queries, aggregated): ~1,400–1,600/wk through 2022 → ~2,800/wk mid-2023 → ~5,000–7,600/wk 2023-Q3 through 2024 → **peak ~Q2 2025 (~155k/quarter ≈ ~12k/wk)** → dip to ~5,800/wk Q4 2025 → ~7,600/wk now. Notably, downloads kept climbing even after development stalled (see §2) — consistent with CI builds of a few committed adopters, not new-user growth.
- **Comparison to the incumbents** (same week, same API): `@stencil/core` 1,272,659/wk; `lit` 6,217,524/wk. Mitosis runs at **~0.6% of Stencil's volume and ~0.1% of Lit's**, despite a comparable-or-larger star count.
- **Dependents**: GitHub's dependents page shows on the order of ~193 repos / 17 packages ([dependents page](https://github.com/BuilderIO/mitosis/network/dependents) — caveat: the page fetch resolved to one package of the monorepo and the summarizer output looked noisy; treat as "low hundreds at most," not a precise figure).

**Interpretation (labeled opinion):** the stars-to-usage ratio is a classic hype signature. Lit has ~1.4x the stars of Mitosis but ~800x the downloads. Mitosis was widely bookmarked ("write once, run everywhere" is an irresistible pitch) and rarely installed.

## 2. Timeline

**Facts (verified, local git + web):**
- **2020-11-05**: first commit; **2020-11-13**: "Show HN: JSX Lite" — 9 points, 0 comments ([HN 25083130](https://news.ycombinator.com/item?id=25083130)).
- **2021-07-28**: renamed JSX-Lite → Mitosis (local git: commit `rename`, PR #114 "mitosis-rename").
- **2022**: relaunch push — Builder.io's ["A Quick Guide to Mitosis"](https://www.builder.io/blog/mitosis-a-quick-guide), Sami Jaber's React Day Berlin 2022 talk ["It's Time to De-Fragment the Web"](https://gitnation.com/contents/its-time-to-de-fragment-the-web), [InfoWorld coverage Dec 2022](https://www.infoworld.com/article/2337352/intro-to-mitosis-the-universal-reactive-transformer.html), [Nick Taylor interview Oct 2022](https://www.nickyt.co/blog/build-framework-agnostic-components-with-mitosis/).
- **Commit activity by year** (local `git log`): heavy 2020–2022 (peaks: 203 commits Nov 2020; ~60/mo mid-2022); moderate 2023–2024; **collapse from July 2025** — Jul 2025: 2 commits, Aug: 0, Sep: 1, Oct–Dec 2025: 0, Jan 2026: 2, Feb–May 2026: 0, Jun 2026: 6 (mostly release/CI-fix commits by a bot and one-off contributors).
- **Maintainer succession** (local `git shortlog`): 2021 dominated by CEO Steve Sewell (418 commits); 2022–2024 dominated by Sami Jaber (223/114/145 commits) — Builder.io's SDK lead and self-described core maintainer ([sessionize profile](https://sessionize.com/sami-jaber)). **In 2025 the top "committer" is `builderio-bot` (48), Jaber is absent from the top-4 entirely.**
- **Never reached 1.0**: version went `0.0.142` (Jan 2024) → renumbered `0.x` line → `0.13.2` (2026-06-05) — 5.5+ years in 0.x (local git tags).
- **HN momentum: there never was any.** Eleven submissions from 2020–2026; the best ever did 9 points/0 comments (2020); everything since scored 1–4 points ([Algolia HN search](https://hn.algolia.com/api/v1/search?query=mitosis&tags=story)).
- README today still reads "*We are actively looking for folks interested in becoming contributors*" (local `README.MD` line 34).

## 3. Community discourse

**Fact: discourse volume is anomalously low.** No substantive HN thread exists (max 9 points across 11 submissions). WebSearch surfaced no Reddit threads at all across multiple query formulations; direct Reddit API fetch was blocked, so I cannot prove absence, but nothing indexed surfaced. This is itself evidence: the project generated stars, not conversation.

**Criticism themes with sources:**

- **Debugging generated code** — the strongest documented theme. Voorhoede (Dutch agency) design-system experience report, Sep 16, 2024: "*Testing and debugging your Mitosis code can be a pain in the ass*" — console.log statements are stripped by the compiler with no config to keep them; the compiler "*doesn't check if those files are valid or have syntax errors*" ([voorhoede.nl](https://www.voorhoede.nl/en/blog/write-components-once-run-everywhere-with-mitosis-a-beautiful-dream-or-reality/)).
- **Restrictive authoring subset / learning curve** — Voorhoede: "*JSX lite is something that, although a subset of JSX, required quite some getting used to*"; LogRocket and Better Programming guides likewise note the static-JSX subset, "strict coding rules," and breakage of common React patterns ([LogRocket](https://blog.logrocket.com/creating-reusable-components-mitosis-builder-io/), [Better Programming](https://betterprogramming.pub/write-components-once-compile-to-every-framework-with-mitosis-9330411d21e4)).
- **Loss of control over output** — Voorhoede: "*you do not have much control over versioning*"; generated code is not what devs "would write differently"; no way to target specific framework versions.
- **"Not ready" verdicts even from fans** — SAP Fundamental Library evaluation (Giorgi Cheishvili, Oct 19, 2022) compared separate implementations vs. web components (Stencil/Lit) vs. Mitosis, chose Mitosis for a PoC but conceded "*working with Mitosis for this moment (September of 2022) was not the best development experience*" ([medium.com/fundamental-library](https://medium.com/fundamental-library/exploring-cross-framework-development-2bdcb26fe6a)). I found no evidence the PoC (`fundamental-mitosis`) ever shipped to production.
- **"Lowest common denominator" arguments**: I could **not** find this phrase used against Mitosis in any indexed source — evidence gap, do not cite it as documented community sentiment. The functionally equivalent criticism (restrictive subset, LCD-of-frameworks authoring model) is documented above.
- **"Why not web components"**: I found the argument mostly running the *other* direction — Mitosis's own docs attack web components (no native SSR, no React context integration; local `packages/docs/.../overview/index.mdx`), and Jaber's talks explain why Builder rejected WC for their SDKs ([nickyt.co](https://www.nickyt.co/blog/build-framework-agnostic-components-with-mitosis/)). Explicit public "just use WC" rebuttals aimed at Mitosis: not found.

**Verdict quotes (sentiment, sourced):** Voorhoede's bottom line — recommends **against** Mitosis as a design system's foundation; at best "a starting point tool" for generating boilerplate you then hand-maintain per framework.

## 4. Who actually used it

**Verified adopters:**
- **Builder.io's own gen-2 SDKs** — the flagship and original motivation; e.g. [`@builder.io/sdk-qwik` is "generated by Mitosis"](https://www.npmjs.com/package/@builder.io/sdk-qwik), source in [BuilderIO/builder packages/sdks](https://github.com/BuilderIO/builder/tree/main/packages/sdks/output/qwik).
- **Deutsche Bahn DB UX Design System** ([db-ux-design-system/core-web](https://github.com/db-ux-design-system/core-web)) — the only significant verified external adopter, cited in Mitosis's own README/docs as *the* example. Still active on Mitosis as of v5.0.1 (Jul 17, 2026). Notably, DB UX's Nicolas Merget became a top Mitosis contributor in 2024–2025 (local git) — i.e., the adopter had to co-maintain the tool.
- **AWS Amplify UI: NOT verified — likely false as commonly repeated.** No source connects Amplify UI to Mitosis, and Amplify's own primitives RFC explicitly chose hand-written per-framework components: "*We want React components feel like React components, and Vue components feel like Vue components*" ([RFC #3933](https://github.com/aws-amplify/amplify-ui/issues/3933)) — a public rejection of the code-gen philosophy by exactly the kind of team Mitosis targeted.
- **Ionic: no adoption evidence** — Ionic built and kept Stencil. One suggestive fact: ex-Ionic engineer Liam DeBeasi appears with 18 Mitosis commits in 2025 (local git), i.e. as a Builder.io hire, not as Ionic adoption.
- **Public postmortems / migration-away stories: none found.** No "we dropped Mitosis" write-up exists in indexed sources. The pattern is quieter: evaluations that praised the idea and then didn't adopt (Voorhoede, Fundamental Library).

## 5. Competitive context

**Facts:** Stencil (1.27M wk downloads) and Lit (6.2M) demonstrate that the cross-framework component market overwhelmingly chose the standards-based web-components path, not per-framework transpilation. Mitosis's differentiation was explicitly anti-WC — compile to *native* framework code to get SSR, context integration, and idiomatic feel (Mitosis docs; [Jaber interview](https://www.nickyt.co/blog/build-framework-agnostic-components-with-mitosis/): "*Web Components was not really an approach that we were able to use, given that we wanted our components to be able to call our users' components and vice versa*").

**Analysis (opinion, grounded in the above):** the third-party evaluations that exist (SAP Fundamental Library, Voorhoede) treated Mitosis as a category-correct idea with failing execution ("will be the best way to go... once algorithms for transpilation are polished" — Cheishvili 2022; still unpolished per Voorhoede 2024). No prominent published analysis argues the *category* is inherently doomed; but the revealed preference of design-system teams (Amplify's hand-written per-framework choice, the WC ecosystem's download volumes) is the strongest argument that the market didn't want a transpiler regardless.

## 6. Builder.io's strategic shifts

**Facts:**
- 2021–2023: Builder.io's open-source energy went heavily to **Qwik** (beta 2022, [v1.0 May 2023](https://www.builder.io/blog/qwik-v1)) — Miško Hevery even appears in Mitosis's 2021–2022 committer logs before Qwik consumed his time (local git).
- **Mar 26, 2024**: Builder.io hands Qwik to community governance ([Qwik's Next Leap](https://www.builder.io/blog/qwik-next-leap)) — the start of Builder shedding open-source stewardship generally.
- **Nov 14, 2025**: Builder.io launches **Fusion 1.0**, repositioning as an AI product-development-agent company ([builder.io/blog/fusion](https://www.builder.io/blog/fusion), [PR Newswire](https://www.prnewswire.com/news-releases/builderio-launches-fusion-1-0--the-first-ai-agent-for-product-design-and-code-302615215.html)).
- The Mitosis commit collapse (July 2025 onward, per local git) lines up with this AI pivot; the sole maintainer's 2025 disappearance from the log, and a README begging for contributors, complete the picture. **Caveat**: I found no public statement by Builder.io or Jaber explicitly deprioritizing Mitosis — the abandonment is visible only in the commit record, not announced.

---

## Ranked external failure causes

1. **Single-vendor internal tool, orphaned by the vendor's pivot.** Mitosis existed to build Builder.io's own multi-framework SDKs; when Builder's strategy moved to Qwik (2022–23), then community-offloaded Qwik (Mar 2024), then went all-in on AI/Fusion (Nov 2025), Mitosis's commit rate went from ~40/mo to ~0 within months. Sources: local git activity log; [Qwik's Next Leap](https://www.builder.io/blog/qwik-next-leap); [Fusion launch](https://www.builder.io/blog/fusion).

2. **Bus factor of one.** Effectively a single maintainer (Sami Jaber) carried 2022–2024; his 2025 drop-off left a bot as the top "committer" and a README pleading for contributors. External adopter DB UX had to staff its own contributor (Nicolas Merget) to keep the tool viable. Sources: local `git shortlog` by year; `README.MD` contributor plea; [Jaber profile](https://sessionize.com/sami-jaber).

3. **Debugging-generated-code DX was disqualifying for its target users.** The one detailed design-system field report concluded "testing and debugging your Mitosis code can be a pain in the ass" (stripped console.logs, no output validation, unclear error sources) and recommended against production use — precisely the audience the tool was for. Source: [Voorhoede report, Sep 2024](https://www.voorhoede.nl/en/blog/write-components-once-run-everywhere-with-mitosis-a-beautiful-dream-or-reality/).

4. **Restrictive authoring model (the de-facto lowest-common-denominator tax).** The static JSX subset, strict rules, and non-idiomatic generated output meant users lost control over versioning and code quality in every target framework at once. Sources: [Voorhoede](https://www.voorhoede.nl/en/blog/write-components-once-run-everywhere-with-mitosis-a-beautiful-dream-or-reality/); [Fundamental Library eval](https://medium.com/fundamental-library/exploring-cross-framework-development-2bdcb26fe6a); [LogRocket](https://blog.logrocket.com/creating-reusable-components-mitosis-builder-io/).

5. **The market's cross-framework budget was already spent on web components.** Stencil (~1.27M wk) and Lit (~6.2M wk) out-download Mitosis (~7.6k wk) by 2–3 orders of magnitude; teams wanting one-codebase components chose the standards path despite its SSR/context warts. Sources: npm downloads API (all three, week of Jul 12–18, 2026).

6. **Hype-to-adoption gap: a bookmark, not a dependency.** 13.9k stars against ~7.6k weekly downloads and ~200 GitHub dependents; eleven HN submissions never cracked 10 points; no findable Reddit discourse. Interest never converted because the tool only pays off for the rare team maintaining 3+ framework targets. Sources: [GitHub API](https://api.github.com/repos/BuilderIO/mitosis); [Algolia HN](https://hn.algolia.com/api/v1/search?query=mitosis&tags=story); npm API.

7. **Perpetual 0.x signaled "not production-ready" for five-plus years.** From 0.0.142 (Jan 2024) to 0.13.2 (Jun 2026) with no 1.0, evaluators who loved the concept ("best way to go... once polished") kept waiting for maturity that never came before maintenance stopped. Sources: local git tags; [Fundamental Library eval](https://medium.com/fundamental-library/exploring-cross-framework-development-2bdcb26fe6a).

8. **The flagship reference customers never materialized beyond two.** Verified production adoption reduces to Builder's own SDKs and Deutsche Bahn; the oft-implied AWS Amplify adoption is unsupported, and Amplify's public RFC chose hand-written per-framework components instead ("We want React components feel like React components") — the target market publicly modeling the alternative. Sources: [Mitosis docs overview](https://mitosis.builder.io/docs/overview/); [db-ux core-web](https://github.com/db-ux-design-system/core-web); [Amplify RFC #3933](https://github.com/aws-amplify/amplify-ui/issues/3933).
