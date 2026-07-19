import { EventForm } from '../fixtures/s3-event-form.tsrx';
import { emitTrace } from '../support/trace-bridge.ts';

export function App() @{
	<EventForm
		initial="seed"
		onTrace={(name, payload, event) => emitTrace(name, payload, event)}
	/>
}
