# Agent guidance

Agent rules for this repo are generated from `.ruler/` by Ruler. Edit the source
here and run `pnpm rules` to sync `AGENTS.md`; never edit the generated file alone.

The task packet or active goal card defines scope. Stay inside its named files and
preserve unrelated work. If a required decision is missing, stop rather than
improvise.

Treat `specs/framework/` as the normative product contract and `specs/state.md` as a
progress ledger only. Keep `poc/**` out of every workspace and root tool lane; it is
read-only evidence unless a task explicitly owns a POC.

The compiler owns enriched IR only. It must not import oracle, DOM, React, Solid,
Vite, filesystem, gate, or dossier types. Protocol and configuration facts are
imported from their owning package rather than restated.

Merging, pushing, or closing a goal requires explicit owner direction for that
specific change set.
