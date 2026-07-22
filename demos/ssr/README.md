# SSR behavioral proof

This demo proves SSR behavior for Frameless's CLI-emitted React and Solid targets. `pnpm e2e`
checks the correct pre-activation content, clean activation with no console errors or failed
requests, post-activation scenarios, and identical behavioral outcomes across both frameworks.
React and Solid currently hydrate; the receipt contract remains activation-model-neutral through
its `activation: hydrate | resume` field. This is not a Qwik implementation and does not prove
accessibility or performance.

## Browser prerequisite

The witness lane needs a Chromium-family browser on the machine. `@async/witness` automatically
looks for system Chrome, Edge, or Chromium installations and for browsers in the Playwright cache.
To select a specific binary, set `WITNESS_BROWSER_PATH` to its path.

Run the complete lane from the repository root:

```sh
pnpm e2e
```

Witness writes its receipts under `.witness/receipts/` in this directory. The complete command also
writes `receipts/frameless-receipts.json`, whose `frameless-receipts/2` payload includes the `ssr`
entry.

## Layout

- `react-app/` and `solid-app/` consume output emitted by the Frameless CLI and provide the target
  frameworks' SSR and activation entry points.
- `*.box.ts` files are the `@async/witness` proof and calibration boxes.
- `@async/witness` is pinned to 0.7.0. See [WITNESS-PIN.md](./WITNESS-PIN.md) for the pin rationale
  and re-evaluation triggers.

The SSR lane covers the UI-kit corpus. Because witness 0.7.0 has no text-input primitive,
text-input scenario steps stay in the browser-mount lane; SSR post-activation actions are limited
to those expressible through clicks and checkboxes.
