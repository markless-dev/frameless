import { useState } from 'react';

export function BaselineS3({ initial, onTrace }) {
  const [text, setText] = useState(initial);
  const [checked, setChecked] = useState(false);
  const [writes, setWrites] = useState(0);
  const submit = (event) => {
    event.preventDefault();
    setWrites(1);
    setWrites(2);
    onTrace('submit', { text, checked, writes: 2 }, event.nativeEvent);
  };
  return <form data-scenario="s3" onClick={(event) => {
    if (event.target.dataset.action === 'submit') onTrace('bubble', { source: 'form' }, event.nativeEvent);
  }}>
    <input data-action="text" value={text} onInput={(event) => {
      setText(event.currentTarget.value);
      onTrace('text', { value: event.currentTarget.value }, event.nativeEvent);
    }} />
    <input type="checkbox" data-action="checked" checked={checked} onChange={(event) => {
      setChecked(event.currentTarget.checked);
      onTrace('checked', { checked: event.currentTarget.checked }, event.nativeEvent);
    }} />
    <button type="button" data-action="submit" onClick={submit}>submit</button>
    <output data-writes="true">{writes}</output>
    <span data-callback-marker="present" />
  </form>;
}
