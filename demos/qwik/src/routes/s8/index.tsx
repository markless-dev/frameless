import { $, component$, useSignal } from "@qwik.dev/core";
import { AsyncBoard } from "../../emitted/AsyncBoard.jsx";

// ---------------------------------------------------------------------------
// S8's ASYNC GATE, in the lane the protocol was designed around.
//
// MEASURED: @qwik.dev/core 2.0.0-beta.38 serializes a promise by AWAITING it —
// the SSR serializer loops on `await Promise.race(this.$promises$)` until none
// are left — so a gate that was pending when the server rendered would hang
// this lane's render outright, and a timer gate would be serialized RESOLVED
// and give the client no suspension window at all. Neither is a defect: a
// pending promise with a live resolver is by construction not serializable,
// which is what resumability means.
//
// So the gate the SERVER renders with is already resolved, and the pending one
// is created on the CLIENT by the `arm` click. `armed` is what makes that
// reach the board: reading it here subscribes this component, so the click
// re-renders the route and the board is handed the new promise. The promise
// itself lives in a module-scoped box rather than in a signal, because it must
// never be a candidate for serialization.
//
// The other five lanes run the identical sequence — see `assertS8` in
// demos/react-official/three-way-contract.ts.
// ---------------------------------------------------------------------------
const s8ResolvedGate: Promise<string> = Promise.resolve("go");
const s8Gate: { pending: Promise<string>; release: () => void } = {
  pending: s8ResolvedGate,
  release: () => {},
};

export default component$(() => {
  const armed = useSignal(0);
  const ready = armed.value === 0 ? s8ResolvedGate : s8Gate.pending;
  return (
    <>
      <button
        type="button"
        data-harness="arm"
        onClick$={() => {
          s8Gate.pending = new Promise<string>((resolve) => {
            s8Gate.release = () => resolve("go");
          });
          armed.value += 1;
        }}
      >
        arm
      </button>
      <button
        type="button"
        data-harness="release"
        onClick$={() => {
          s8Gate.release();
        }}
      >
        release
      </button>
      <p data-harness="gate">{armed.value === 0 ? "open" : "held"}</p>
      <AsyncBoard ready={ready} onTrace$={$(() => {})} />
    </>
  );
});
