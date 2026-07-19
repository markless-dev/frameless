import { createSignal, For } from 'solid-js';

export function BaselineS2(props) {
  const [todos, setTodos] = createSignal(props.seed.map((todo) => ({ ...todo })));
  const [draft, setDraft] = createSignal('');
  let next = 3;
  const edit = (todo, title, event) => {
    todo.title = title;
    setTodos([...todos()]);
    props.onTrace('edit', { id: todo.id, title }, event);
  };
  return <section data-scenario="s2">
    <p data-count="complete">{todos().filter((todo) => todo.done).length}/{todos().length}</p>
    <input data-action="new" attr:value={draft()} value={draft()} onInput={(event) => setDraft(event.currentTarget.value)} />
    <button data-action="add" onClick={(event) => {
      const item = { id: `c${next++}`, title: draft(), done: false };
      setTodos((value) => [...value, item]); setDraft('');
      props.onTrace('add', { id: item.id, title: item.title }, event);
    }}>add</button>
    {todos().length === 0 ? <p data-empty="true">empty</p> : null}
    <ul><For each={todos()}>{(todo) => <li data-oracle-row-key={todo.id}>
      <input data-edit={todo.id} attr:value={todo.title} value={todo.title} onInput={(event) => edit(todo, event.currentTarget.value, event)} />
      <input type="checkbox" data-toggle={todo.id} checked={todo.done} onChange={(event) => {
        const checked = event.currentTarget.checked; todo.done = checked; setTodos([...todos()]);
        props.onTrace('toggle', { id: todo.id, checked }, event);
      }} />
      <button data-remove={todo.id} onClick={(event) => {
        setTodos(todos().filter((item) => item.id !== todo.id)); props.onTrace('remove', { id: todo.id }, event);
      }}>remove</button>
    </li>}</For></ul>
    <button data-action="reorder" onClick={(event) => {
      const order = [...todos()].reverse(); setTodos(order); props.onTrace('reorder', { order: order.map((item) => item.id) }, event);
    }}>reorder</button>
    <button data-action="clear" onClick={(event) => {
      const count = todos().length; setTodos([]); props.onTrace('clear', { count }, event);
    }}>clear</button>
  </section>;
}
