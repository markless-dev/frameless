import { useRef, useState } from 'react';

export function BaselineS2({ seed, onTrace }) {
  const [todos, setTodos] = useState(() => structuredClone(seed));
  const [draft, setDraft] = useState('');
  const next = useRef(3);
  const complete = todos.filter((todo) => todo.done).length;
  const edit = (id, title, event) => {
    setTodos((old) => old.map((todo) => todo.id === id ? { ...todo, title } : todo));
    onTrace('edit', { id, title }, event);
  };
  return <section data-scenario="s2">
    <p data-count="complete">{complete}/{todos.length}</p>
    <input data-action="new" value={draft} onInput={(event) => setDraft(event.currentTarget.value)} />
    <button data-action="add" onClick={(event) => {
      const item = { id: `c${next.current++}`, title: draft, done: false };
      setTodos((value) => [...value, item]);
      setDraft('');
      onTrace('add', { id: item.id, title: item.title }, event.nativeEvent);
    }}>add</button>
    {todos.length === 0 ? <p data-empty="true">empty</p> : null}
    <ul>{todos.map((todo) => <li key={todo.id} data-oracle-row-key={todo.id}>
      <input data-edit={todo.id} value={todo.title} onInput={(event) => edit(todo.id, event.currentTarget.value, event.nativeEvent)} />
      <input type="checkbox" data-toggle={todo.id} checked={todo.done} onChange={(event) => {
        const checked = event.currentTarget.checked;
        setTodos((value) => value.map((item) => item.id === todo.id ? { ...item, done: checked } : item));
        onTrace('toggle', { id: todo.id, checked }, event.nativeEvent);
      }} />
      <button data-remove={todo.id} onClick={(event) => {
        setTodos((value) => value.filter((item) => item.id !== todo.id));
        onTrace('remove', { id: todo.id }, event.nativeEvent);
      }}>remove</button>
    </li>)}</ul>
    <button data-action="reorder" onClick={(event) => {
      setTodos((value) => [...value].reverse());
      onTrace('reorder', { order: [...todos].reverse().map((todo) => todo.id) }, event.nativeEvent);
    }}>reorder</button>
    <button data-action="clear" onClick={(event) => {
      setTodos([]);
      onTrace('clear', { count: todos.length }, event.nativeEvent);
    }}>clear</button>
  </section>;
}
