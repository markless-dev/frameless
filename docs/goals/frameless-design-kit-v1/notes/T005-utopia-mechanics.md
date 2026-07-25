# Utopia mechanics — config URL format and verified clamp formula

Gathered ahead of T005 to de-risk it, and to give T011's structural gate something exact
to check against.

## Config URL format

Both calculators encode their full configuration in query parameters, so the shareable URL
genuinely round-trips the scale. Confirmed format:

```text
https://utopia.fyi/type/calculator?c=<minVW>,<minFS>,<minRatio>,<maxVW>,<maxFS>,<maxRatio>,<stepsUp>,<stepsDown>,&s=<negMultipliers>,<posMultipliers>,<customPairs>&g=<grid>
```

Worked example from Utopia's own docs:

```text
?c=360,18,1.2,1240,20,1.25,5,2,&s=0.75|0.5|0.25,1.5|2|3|4|6,s-l&g=s,l,xl,12
```

| Segment | Meaning |
|---|---|
| `c=360,18,1.2` | min viewport 360px, min base font 18px, min scale ratio 1.2 |
| `...,1240,20,1.25` | max viewport 1240px, max base font 20px, max scale ratio 1.25 |
| `...,5,2` | 5 steps up, 2 steps down from base |
| `s=0.75\|0.5\|0.25` | space multipliers *below* base → `--space-xs`, `2xs`, `3xs` |
| `,1.5\|2\|3\|4\|6` | space multipliers *above* base → `--space-m` … `--space-3xl` |
| `,s-l` | custom one-up pair → `--space-s-l` |
| `g=s,l,xl,12` | grid config (gutter min, max, max width, columns) |

This satisfies the owner's requirement directly: the config URL is the re-tunable artifact,
not the baked CSS.

## Output shape

- Type steps: `--step--2` … `--step-5`, each a `clamp()`.
- Space steps: `--space-3xs` … `--space-3xl`.
- One-up pairs: `--space-s-m`, `--space-l-xl`, plus any custom pairs like `--space-s-l`.

## The formula — verified, not assumed

Utopia's fluid value is a straight line through (minVW, minFS) and (maxVW, maxFS), clamped
at both ends:

```text
slope     = (maxFS - minFS) / (maxVW - minVW)
intercept = minFS - slope * minVW

clamp( minFS/16 rem,  intercept/16 rem + slope*100 vw,  maxFS/16 rem )
```

Checked against Utopia's own published output for the example config above:

```text
--step-0: clamp(1.125rem, 1.0739rem + 0.2273vw, 1.25rem)
```

| Term | Computed | Published |
|---|---|---|
| min | 1.1250rem | 1.125rem |
| intercept | 1.0739rem | 1.0739rem |
| slope | 0.2273vw | 0.2273vw |
| max | 1.2500rem | 1.25rem |

Exact to 4 decimal places. **Consequence for T011:** the structural gate can recompute
every `clamp()` in the kit from the stored parameters and assert equality, rather than
trusting that the pasted CSS matches the recorded config. This closes the "Utopia clamp
pasted with no verification" failure mode named in the charter's misfire list.

Step *n* uses base font scaled by `ratio^n` at each end — min side uses `minRatio`, max
side uses `maxRatio`, which is what lets the scale get proportionally more dramatic on
large viewports.

## Implication for the display scale

The charter requires the display scale to go large — this is a sticker/poster brand, not a
docs site. That argues for a higher `maxRatio` than the 1.25 default and more `stepsUp`, so
the wordmark-scale type has somewhere to live. Final parameters are T004's call.
