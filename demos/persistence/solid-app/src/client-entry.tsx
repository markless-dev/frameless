/** @jsxImportSource solid-js */
import { render } from 'solid-js/web';
import { KeyedTodo } from './PersistedApp.jsx';

const root = document.querySelector('#root');
if (!(root instanceof HTMLElement)) throw new Error('Solid persistence root is missing.');

render(() => <KeyedTodo seed={[]} onTrace={() => undefined} />, root);
document.documentElement.setAttribute('data-framework-activated', 'solid');
