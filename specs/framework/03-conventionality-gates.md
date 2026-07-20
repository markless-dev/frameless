# Conventionality gates

A target's idiom dossier precedes its emitter and gate. Each dossier ruling names an
IR construct, chosen framework idiom, evidence, applicability threshold, and an
overturn condition. The target emitter implements those rulings.

Every enforceable gate policy must contain a stable `dossierRef` that resolves to
the exact dossier ruling it enforces. A gate failure reports the policy id,
`dossierRef`, file/location when available, and remediation. Policies without a
resolving dossier reference are invalid; dossier rulings that claim enforcement but
have no gate policy are invalid.

Verification is layered: compiler IR contracts, emitter goldens and freshness,
dossier-derived conventionality gates, browser equivalence, then fresh-checkout
end-to-end proof. A later layer cannot substitute for a missing earlier layer.
