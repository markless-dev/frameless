# Frameless composition kit demo

This five-module TSRX library is the composition counterpart to `demos/ui-kit`. One multi-input
CLI build resolves the module set and emits the same authored library as React 19 and Solid JSX.

- `frame.tsrx` owns the default-slot projection used from another module.
- `dashboard.tsrx` owns a container-scoped, two-cell shared store and method consumed by sibling
  components.
- `status.tsrx` owns one scalar shared cell so each emitter must choose its lighter idiomatic tier.
- `search.tsrx` owns a direct element handle, focus action, literal behavior, and cleanup witness.
- `page.tsrx` imports all four siblings and composes the emitted browser root.

Run `pnpm e2e` from the workspace root to build both demos, capture the React and Solid scenarios
in headless Chromium, evaluate each framework's expectations, compare cross-framework traces, and
write validated `frameless-receipts/1` receipts. Generated `dist/`, `traces/`, and `receipts/`
directories are ignored by Git.
