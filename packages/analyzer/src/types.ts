/// <reference lib="dom" />

export const ANALYZER_CONTRACT_VERSION = 'frameless-analyzer/1' as const;

export type Action =
	| { type: 'click'; target: string }
	| { type: 'input'; target: string; value: string; selection?: [number, number] }
	| { type: 'check'; target: string; checked: boolean }
	| { type: 'focus'; target: string; selection?: [number, number] };

export type CallbackRecord = {
	name: string;
	payload: unknown;
	phase: string;
	defaultPrevented: boolean | null;
	invocation: number;
};

export type SerializedNode = {
	nodeType: 'element' | 'text';
	namespace?: string | null;
	tag?: string;
	attributes?: [string, string][];
	properties?: Record<string, unknown>;
	text?: string;
	children?: SerializedNode[];
	nodeId?: number;
};

export type Observation = {
	phase: string;
	dom: SerializedNode[];
	focus: null | { nodeId: number; path: string; selection: [number, number] | null };
	callbacks: CallbackRecord[];
	rows: Record<string, number>;
	identityViolations: string[];
	focusViolations: string[];
};

export type RunTrace = {
	contract: typeof ANALYZER_CONTRACT_VERSION;
	scenario: string;
	framework: string;
	observations: Observation[];
};

export type Divergence = {
	channel: 'dom' | 'identity' | 'focus' | 'callback' | 'trace';
	phase: string;
	path: string;
	left: unknown;
	right: unknown;
};

export type Verdict =
	| { equal: true; divergences: [] }
	| { equal: false; divergences: Divergence[] };

/**
 * Framework-neutral lifecycle contract.
 *
 * `runScenario` awaits dispatch before recording `action:n:after`. This makes the
 * after phase the first observation after a framework's event transaction. The
 * microtask and quiescence phases remain additional, ordered scheduler observations.
 */
export interface Adapter<Handle = unknown> {
	name: string;
	mount(host: HTMLElement, props: Record<string, unknown>): Handle | Promise<Handle>;
	dispatch(handle: Handle, action: Action): void | Promise<void>;
	settle(handle: Handle): Promise<void>;
	unmount(handle: Handle): void | Promise<void>;
	host(handle: Handle): HTMLElement;
}
