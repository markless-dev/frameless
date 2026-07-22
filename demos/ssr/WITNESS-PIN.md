# `@async/witness` 0.7.0 pin

This package pins `@async/witness` exactly at 0.7.0 because that release has proven SSR usage in
Markless and satisfies Frameless's Vite 8 peer dependency. Re-evaluate the pin when any of these
conditions occurs:

1. A required assertion cannot be expressed by witness 0.7.0. Treat that as product feedback and
   a blocked SSR lane, rather than working around the missing primitive here.
2. A release with an obtainable changelog changes the receipt schema, preview/build pipeline, or
   multi-preview support. Read those changes before adopting the release.
3. Witness's Vite peer range moves away from its current `^8.0.0` range or Frameless's Vite pin no
   longer satisfies it.
4. Witness adds explicit multi-preview-per-run support.
5. If the later two-previews-one-run probe fails on 0.7.0, evaluate 0.8.0 against repository
   sources—not the silent registry release—before choosing a two-root fallback.
