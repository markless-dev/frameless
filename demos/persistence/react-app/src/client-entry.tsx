import { createRoot } from 'react-dom/client';
import { KeyedTodo } from './PersistedApp.jsx';

const root = document.querySelector('#root');
if (!(root instanceof HTMLElement)) throw new Error('React persistence root is missing.');

createRoot(root).render(<KeyedTodo seed={[]} onTrace={() => undefined} />);
document.documentElement.setAttribute('data-framework-activated', 'react');
