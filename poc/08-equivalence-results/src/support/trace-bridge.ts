export type TraceHandler = (name: string, payload: unknown, event?: Event) => void;

let currentTrace: TraceHandler | null = null;

export function setTrace(handler: TraceHandler | null): void {
  currentTrace = handler;
}

export function emitTrace(name: string, payload: unknown, event?: Event): void {
  currentTrace?.(name, payload, event);
}
