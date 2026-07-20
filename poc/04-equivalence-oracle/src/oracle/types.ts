export const ORACLE_CONTRACT_VERSION = 'frameless-equivalence-oracle/1';

export type Action =
  | { type: 'click'; target: string }
  | { type: 'input'; target: string; value: string; selection?: [number, number] }
  | { type: 'check'; target: string; checked: boolean }
  | { type: 'focus'; target: string; selection?: [number, number] };

export type CallbackRecord = {
  name: string; payload: unknown; phase: string; defaultPrevented: boolean | null; invocation: number;
};
export type SerializedNode = {
  nodeType: 'element' | 'text'; namespace?: string | null; tag?: string; attributes?: [string, string][];
  properties?: Record<string, unknown>; text?: string; children?: SerializedNode[]; nodeId?: number;
};
export type Observation = {
  phase: string; dom: SerializedNode[]; focus: null | { nodeId: number; path: string; selection: [number, number] | null };
  callbacks: CallbackRecord[]; rows: Record<string, number>; identityViolations: string[]; focusViolations: string[];
};
export type RunTrace = { contract: string; scenario: string; framework: string; observations: Observation[] };
export type Divergence = { channel: 'dom' | 'identity' | 'focus' | 'callback' | 'trace'; phase: string; path: string; left: unknown; right: unknown };
export type Verdict = { equal: true; divergences: [] } | { equal: false; divergences: Divergence[] };

export interface Adapter<H = unknown> {
  name: string;
  mount(host: HTMLElement, props: Record<string, unknown>): H | Promise<H>;
  dispatch(handle: H, action: Action): void;
  settle(handle: H): Promise<void>;
  unmount(handle: H): void | Promise<void>;
  host(handle: H): HTMLElement;
}
