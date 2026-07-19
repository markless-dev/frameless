import { onUpdate, useStore } from '@builder.io/mitosis';

export interface UpdateProbeProps {
  onProbe?: (event: 'update') => void;
}

export default function UpdateProbe(props: UpdateProbeProps) {
  const state = useStore({
    count: 0,
  });

  onUpdate(() => {
    props.onProbe?.('update');
  });

  return (
    <section>
      <output data-testid="count">{state.count}</output>
      <button type="button" onClick={() => (state.count = state.count + 1)}>
        Increment
      </button>
    </section>
  );
}
