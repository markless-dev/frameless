export type TraceHandler = (name: string, payload: unknown, event?: Event) => void;

let currentTrace: TraceHandler | null = null;

export function registerTrace(handler: TraceHandler): () => void {
  currentTrace = handler;
  return () => {
    if (currentTrace === handler) currentTrace = null;
  };
}

export function emitTrace(name: string, payload: unknown, event?: Event): void {
  currentTrace?.(name, payload, event);
}
