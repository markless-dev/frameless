import { KeyedTodo } from '../fixtures/s2-keyed-todo.tsrx';
import { emitTrace } from '../support/trace-bridge.ts';

export function App() @{
	<KeyedTodo
		seed={[
			{ id: 'a', title: 'Alpha', done: false },
			{ id: 'b', title: 'Beta', done: false },
		]}
		onTrace={(name, payload, event) => emitTrace(name, payload, event)}
	/>
}
