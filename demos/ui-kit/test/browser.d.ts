import 'vitest/browser';

declare module 'vitest/browser' {
	interface BrowserCommands {
		writeUiKitTrace(
			target: 'react' | 'solid',
			component: string,
			scenario: string,
			content: string,
		): Promise<void>;
	}
}
