import { useStore } from '@builder.io/mitosis';

export default function Collision() {
  const state = useStore({
    foo: 'outer value',
    doSomething() {
      const foo = state.foo;
      console.log(foo);
    },
  });

  return <button onClick={() => state.doSomething()}>Trigger</button>;
}
