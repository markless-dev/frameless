import { on, createEffect, createMemo, createSignal } from "solid-js";

function UpdateProbe(props) {
  const [count, setCount] = createSignal(0);

  return (
    <>
      <section>
        <output data-testid="count">{count()}</output>
        <button type="button" onClick={(event) => setCount(count() + 1)}>
          Increment
        </button>
      </section>
    </>
  );
}

export default UpdateProbe;
