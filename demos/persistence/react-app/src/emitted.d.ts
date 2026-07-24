declare module '*.jsx' {
	export function KeyedTodo(props: {
		seed: Array<{ id: string; title: string; done: boolean }>;
		onTrace: (...args: unknown[]) => void;
	}): never;
}
