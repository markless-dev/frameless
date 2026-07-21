import 'vitest/browser';

declare module 'vitest/browser' {
	interface BrowserCommands {
		writeCompositionKitTrace(target: string, scenario: string, content: string): Promise<void>;
	}
}
