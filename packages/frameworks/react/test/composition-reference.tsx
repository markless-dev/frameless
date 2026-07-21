import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useRef,
	useState,
	useSyncExternalStore,
} from 'react';

export type ReactCompositionMutant =
	| 'M-SLOT-OMIT'
	| 'M-SLOT-DUP'
	| 'M-SLOT-WRAPPER'
	| 'M-SHARED-DESYNC'
	| 'M-SHARED-STALE'
	| 'M-REF-FOCUS-OMIT'
	| 'M-ATTACH-CLEANUP-OMIT'
	| 'M-CLEANUP-EARLY-WRITE'
	| 'M-REINSTALL-OMIT'
	| 'M-CLEANUP-ORDER'
	| 'M-HANDLE-CLEAR-OMIT'
	| 'M-METHOD-ORDER'
	| 'M-SHARED-TEAR';

type StoreVariant = 'reference' | 'stale' | 'method-order' | 'tear';
type SharedStore = ReturnType<typeof createSharedStore>;
const subscribeToNothing = () => () => {};
const getNothing = () => 0;

function createSharedStore(variant: StoreVariant = 'reference') {
	let count = 0;
	let history = 'seed';
	const countListeners = new Set<() => void>();
	const historyListeners = new Set<() => void>();
	const auditListeners = new Set<() => void>();

	const notify = (cell: 'count' | 'history') => {
		for (const listener of cell === 'count' ? countListeners : historyListeners) listener();
		for (const listener of auditListeners) listener();
	};
	const commit = (changed: ReadonlySet<'count' | 'history'>) => {
		for (const cell of changed) notify(cell);
	};
	const writeHistory = (next: string, changed: Set<'count' | 'history'>) => {
		if (Object.is(history, next)) return;
		history = next;
		changed.add('history');
		if (variant === 'tear') notify('history');
	};
	const writeCount = (next: number, changed: Set<'count' | 'history'>) => {
		if (Object.is(count, next)) return;
		count = next;
		changed.add('count');
		if (variant === 'tear') notify('count');
	};

	return {
		getCount: () => count,
		getHistory: () => history,
		subscribeCount: (listener: () => void) => {
			countListeners.add(listener);
			return () => {
				countListeners.delete(listener);
			};
		},
		subscribeHistory: (listener: () => void) => {
			historyListeners.add(listener);
			return () => {
				historyListeners.delete(listener);
			};
		},
		subscribeAudit: (listener: () => void) => {
			auditListeners.add(listener);
			return () => {
				auditListeners.delete(listener);
			};
		},
		advance() {
			const changed = new Set<'count' | 'history'>();
			if (variant === 'method-order') {
				writeCount(count + 1, changed);
				writeHistory(`${history}:${count}`, changed);
			} else {
				writeHistory(`${history}:${count}`, changed);
				writeCount(count + 1, changed);
			}
			if (variant !== 'tear') commit(changed);
		},
		append() {
			const changed = new Set<'count' | 'history'>();
			writeHistory(`${history}!`, changed);
			if (variant === 'stale') return;
			if (variant !== 'tear') commit(changed);
		},
		reset() {
			count = 0;
			history = 'seed';
			commit(new Set<'count' | 'history'>(['count', 'history']));
		},
	};
}

const SharedContext = createContext<SharedStore | null>(null);

function useCompositionShared(cell: 'count'): number;
function useCompositionShared(cell: 'history'): string;
function useCompositionShared(cell: 'store'): SharedStore;
function useCompositionShared(cell: 'count' | 'history' | 'store') {
	const store = useContext(SharedContext);
	if (!store) throw new Error('Composition shared store is missing its provider');
	const snapshot = useSyncExternalStore(
		cell === 'count'
			? store.subscribeCount
			: cell === 'history'
				? store.subscribeHistory
				: subscribeToNothing,
		cell === 'count' ? store.getCount : cell === 'history' ? store.getHistory : getNothing,
		cell === 'count' ? store.getCount : cell === 'history' ? store.getHistory : getNothing,
	);
	if (cell === 'count') {
		return snapshot;
	}
	if (cell === 'history') {
		return snapshot;
	}
	return store;
}

function SharedProvider({ children, variant }: { children: ReactNode; variant?: StoreVariant }) {
	const [store] = useState(() => createSharedStore(variant));
	return <SharedContext value={store}>{children}</SharedContext>;
}

function Frame({ children }: { children: ReactNode }) {
	return <section data-frame>{children}</section>;
}

function SlotPage({
	variant = 'reference',
}: {
	variant?: 'reference' | 'omit' | 'duplicate' | 'wrapper';
}) {
	const projected = <strong data-projected-node>Projected composition</strong>;
	return (
		<Frame>
			{variant !== 'omit' && (variant === 'wrapper' ? <div>{projected}</div> : projected)}
			{variant === 'duplicate' && projected}
		</Frame>
	);
}

function Incrementer() {
	const store = useCompositionShared('store');
	return (
		<>
			<button data-action="advance-shared" onClick={store.advance}>
				Advance
			</button>
			<button data-action="append-shared" onClick={store.append}>
				Append
			</button>
		</>
	);
}

function Reader() {
	const history = useCompositionShared('history');
	const count = useCompositionShared('count');
	return <output data-shared-reader>{`${history}|${count}`}</output>;
}

function SharedAudit() {
	const store = useCompositionShared('store');
	const attachAudit = useCallback(
		(node: HTMLOutputElement) => {
			let observed = false;
			return store.subscribeAudit(() => {
				if (observed) return;
				observed = true;
				node.textContent = `${store.getHistory()}|${store.getCount()}`;
			});
		},
		[store],
	);
	return (
		<output data-shared-audit ref={attachAudit}>
			pending
		</output>
	);
}

function SharedParticipants() {
	return (
		<>
			<Incrementer />
			<Reader />
			<SharedAudit />
		</>
	);
}

function SharedPage({ variant = 'reference' }: { variant?: StoreVariant | 'desync' }) {
	if (variant === 'desync') {
		return (
			<>
				<SharedProvider>
					<Incrementer />
				</SharedProvider>
				<SharedProvider>
					<Reader />
					<SharedAudit />
				</SharedProvider>
			</>
		);
	}
	return (
		<SharedProvider variant={variant}>
			<SharedParticipants />
		</SharedProvider>
	);
}

function FocusField({
	input,
	omitClear = false,
}: {
	input: (node: HTMLInputElement | undefined) => void;
	omitClear?: boolean;
}) {
	return (
		<input
			data-focus-target
			ref={(node) => {
				input(node);
				return () => {
					if (!omitClear) input(undefined);
				};
			}}
		/>
	);
}

function FocusPage({
	omitFocus = false,
	omitClear = false,
}: {
	omitFocus?: boolean;
	omitClear?: boolean;
}) {
	const input = useRef<HTMLInputElement>(null);
	const localState = useRef<HTMLOutputElement | null>(null);
	const externalWitness = useRef<HTMLElement | null>(null);
	const setInput = (node: HTMLInputElement | undefined) => {
		input.current = node ?? null;
		if (node) {
			localState.current = node.parentElement?.querySelector('[data-handle-state]') ?? null;
			if (!externalWitness.current) {
				const witness = document.createElement('section');
				witness.dataset.handleWitness = '';
				witness.innerHTML = '<output data-handle-state></output>';
				document.body.append(witness);
				externalWitness.current = witness;
			}
		}
		const state = node ? 'set' : 'cleared';
		if (localState.current) localState.current.textContent = state;
		const externalState = externalWitness.current?.querySelector('[data-handle-state]');
		if (externalState) externalState.textContent = state;
	};
	return (
		<section data-handle-witness>
			<output data-handle-state />
			<FocusField input={setInput} omitClear={omitClear} />
			<button
				data-action="focus-composed"
				onClick={() => {
					if (!omitFocus && input.current !== null) input.current.focus();
				}}
			>
				Focus
			</button>
		</section>
	);
}

type CleanupVariant =
	| 'reference'
	| 'omit-cleanup'
	| 'early-write'
	| 'reinstall-omit'
	| 'cleanup-order';

function CleanupPage({ variant = 'reference' }: { variant?: CleanupVariant }) {
	const [behaviorInput, setBehaviorInput] = useState('one');
	const events = useRef<string[]>([]);
	const externalWitness = useRef<HTMLElement | null>(null);
	const attachCleanupWitness = useCallback(
		(node: HTMLElement) => {
			if (!externalWitness.current) {
				const witness = document.createElement('section');
				witness.dataset.compositionWitness = '';
				witness.innerHTML =
					'<output data-composition-cleanup></output><output data-behavior-log></output>';
				document.body.append(witness);
				externalWitness.current = witness;
			}
			const sync = (selector: string, text: string) => {
				const local = node.querySelector(selector);
				const external = externalWitness.current?.querySelector(selector);
				if (local) local.textContent = text;
				if (external) external.textContent = text;
			};
			const syncLog = () => sync('[data-behavior-log]', events.current.join('|'));
			sync('[data-composition-cleanup]', variant === 'early-write' ? 'cleaned' : 'attached');
			events.current.push(`install:A:${behaviorInput}`, `install:B:${behaviorInput}`);
			syncLog();
			return () => {
				if (variant === 'omit-cleanup') return;
				const cleanupOrder = variant === 'cleanup-order' ? ['A', 'B'] : ['B', 'A'];
				for (const behavior of cleanupOrder) {
					events.current.push(`cleanup:${behavior}:${behaviorInput}`);
				}
				syncLog();
				sync('[data-composition-cleanup]', 'cleaned');
			};
		},
		[variant === 'reinstall-omit' ? null : behaviorInput, variant],
	);
	return (
		<section data-composition-witness ref={attachCleanupWitness}>
			<output data-composition-cleanup />
			<output data-behavior-log />
			<button data-action="change-behavior-input" onClick={() => setBehaviorInput('two')}>
				Change behavior input
			</button>
		</section>
	);
}

export const reactCompositionReferences: Record<string, () => ReactNode> = {
	'C1-slot-rendering': SlotPage,
	'C2-shared-propagation': SharedPage,
	'C3-ref-driven-focus': FocusPage,
	'C4-attach-cleanup': CleanupPage,
};

export function makeReactCompositionMutant(mutant: ReactCompositionMutant): () => ReactNode {
	switch (mutant) {
		case 'M-SLOT-OMIT':
			return () => <SlotPage variant="omit" />;
		case 'M-SLOT-DUP':
			return () => <SlotPage variant="duplicate" />;
		case 'M-SLOT-WRAPPER':
			return () => <SlotPage variant="wrapper" />;
		case 'M-SHARED-DESYNC':
			return () => <SharedPage variant="desync" />;
		case 'M-SHARED-STALE':
			return () => <SharedPage variant="stale" />;
		case 'M-REF-FOCUS-OMIT':
			return () => <FocusPage omitFocus />;
		case 'M-ATTACH-CLEANUP-OMIT':
			return () => <CleanupPage variant="omit-cleanup" />;
		case 'M-CLEANUP-EARLY-WRITE':
			return () => <CleanupPage variant="early-write" />;
		case 'M-REINSTALL-OMIT':
			return () => <CleanupPage variant="reinstall-omit" />;
		case 'M-CLEANUP-ORDER':
			return () => <CleanupPage variant="cleanup-order" />;
		case 'M-HANDLE-CLEAR-OMIT':
			return () => <FocusPage omitClear />;
		case 'M-METHOD-ORDER':
			return () => <SharedPage variant="method-order" />;
		case 'M-SHARED-TEAR':
			return () => <SharedPage variant="tear" />;
	}
}

function ScopeControls({ label }: { label: string }) {
	const count = useCompositionShared('count');
	const store = useCompositionShared('store');
	return (
		<>
			<button data-scope-increment={label} onClick={store.advance}>
				Increment
			</button>
			<output data-scope-value={label}>{count}</output>
		</>
	);
}

export function ReactContainerScopeReference() {
	return (
		<SharedProvider>
			<ScopeControls label="container" />
		</SharedProvider>
	);
}

const pageStore = createSharedStore();

export function resetReactPageScopeReference() {
	pageStore.reset();
}

export function ReactPageScopeReference() {
	return (
		<SharedContext value={pageStore}>
			<ScopeControls label="page" />
		</SharedContext>
	);
}
