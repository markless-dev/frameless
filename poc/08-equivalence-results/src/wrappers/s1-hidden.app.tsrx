import { RenderOnce } from '../fixtures/s1-render-once.tsrx';
import { emitTrace } from '../support/trace-bridge.ts';

export function App() @{
	<div data-harness="">
		<RenderOnce
			label="Frameless"
			multiplier={3}
			visible={false}
			onTrace={(name, payload, event) => emitTrace(name, payload, event)}
		/>
	</div>
}
