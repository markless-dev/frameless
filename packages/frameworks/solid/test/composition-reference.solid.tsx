import {
	type Accessor,
	batch,
	createContext,
	createEffect,
	createSignal,
	type JSX,
	onCleanup,
	onMount,
	untrack,
	useContext,
} from 'solid-js';

declare module 'solid-js' {
	namespace JSX {
		interface Directives {
			cleanupWitness: string;
		}
	}
}

export type SolidCompositionMutant =
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

function createSharedStore(variant: StoreVariant = 'reference') {
	const [count, setCount] = createSignal(0);
	const [history, setHistory] = createSignal('seed');
	let historyValue = 'seed';
	const auditListeners = new Set<() => void>();
	const notifyAudit = () => {
		for (const listener of auditListeners) listener();
	};
	const writeHistory = (next: string) => {
		historyValue = next;
		setHistory(next);
		if (variant === 'tear') notifyAudit();
	};
	const writeCount = (next: number) => {
		setCount(next);
		if (variant === 'tear') notifyAudit();
	};

	return {
		count,
		history,
		subscribeAudit(listener: () => void) {
			auditListeners.add(listener);
			return () => {
				auditListeners.delete(listener);
			};
		},
		advance() {
			batch(() => {
				if (variant === 'method-order') {
					writeCount(count() + 1);
					writeHistory(`${historyValue}:${count()}`);
				} else {
					writeHistory(`${historyValue}:${count()}`);
					writeCount(count() + 1);
				}
			});
			if (variant !== 'tear') notifyAudit();
		},
		append() {
			historyValue = `${historyValue}!`;
			if (variant === 'stale') return;
			setHistory(historyValue);
			notifyAudit();
		},
		reset() {
			historyValue = 'seed';
			batch(() => {
				setHistory('seed');
				setCount(0);
			});
			notifyAudit();
		},
	};
}

const SharedContext = createContext<SharedStore>();

function useCompositionShared() {
	const store = useContext(SharedContext);
	if (!store) throw new Error('Composition shared store is missing its provider');
	return store;
}

function SharedProvider(props: { children: JSX.Element; variant?: StoreVariant }) {
	const store = createSharedStore(props.variant);
	return <SharedContext.Provider value={store}>{props.children}</SharedContext.Provider>;
}

function Frame(props: { children: JSX.Element }) {
	return <section data-frame>{props.children}</section>;
}

function SlotPage(props: { variant?: 'reference' | 'omit' | 'duplicate' | 'wrapper' }) {
	return (
		<Frame>
			{props.variant !== 'omit' &&
				(props.variant === 'wrapper' ? (
					<div>
						<strong data-projected-node>Projected composition</strong>
					</div>
				) : (
					<strong data-projected-node>Projected composition</strong>
				))}
			{props.variant === 'duplicate' && (
				<strong data-projected-node>Projected composition</strong>
			)}
		</Frame>
	);
}

function Incrementer() {
	const store = useCompositionShared();
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
	const store = useCompositionShared();
	return <output data-shared-reader>{`${store.history()}|${store.count()}`}</output>;
}

function SharedAudit() {
	const store = useCompositionShared();
	let observed = false;
	const attachAudit = (node: HTMLOutputElement) => {
		const unsubscribe = store.subscribeAudit(() => {
			if (observed) return;
			observed = true;
			node.textContent = `${store.history()}|${store.count()}`;
		});
		onCleanup(unsubscribe);
	};
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

function SharedPage(props: { variant?: StoreVariant | 'desync' }) {
	if (props.variant === 'desync') {
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
		<SharedProvider variant={props.variant}>
			<SharedParticipants />
		</SharedProvider>
	);
}

function FocusField(props: {
	input: (node: HTMLInputElement | undefined) => void;
	omitClear?: boolean;
}) {
	return (
		<input
			data-focus-target
			ref={(node) => {
				onMount(() => {
					props.input(node);
					onCleanup(() => {
						if (!props.omitClear) props.input(undefined);
					});
				});
			}}
		/>
	);
}

function FocusPage(props: { omitFocus?: boolean; omitClear?: boolean }) {
	let input: HTMLInputElement | undefined;
	let localState: HTMLOutputElement | undefined;
	let externalWitness: HTMLElement | undefined;
	const setInput = (node: HTMLInputElement | undefined) => {
		input = node;
		if (node) {
			localState = node.parentElement?.querySelector('[data-handle-state]') ?? undefined;
			if (!externalWitness) {
				externalWitness = document.createElement('section');
				externalWitness.dataset.handleWitness = '';
				externalWitness.innerHTML = '<output data-handle-state></output>';
				document.body.append(externalWitness);
			}
		}
		const state = node ? 'set' : 'cleared';
		if (localState) localState.textContent = state;
		const externalState = externalWitness?.querySelector('[data-handle-state]');
		if (externalState) externalState.textContent = state;
	};
	return (
		<section data-handle-witness>
			<output data-handle-state />
			<FocusField input={setInput} omitClear={props.omitClear} />
			<button
				data-action="focus-composed"
				onClick={() => {
					if (!props.omitFocus) input?.focus();
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

function CleanupPage(props: { variant?: CleanupVariant }) {
	const variant = props.variant ?? 'reference';
	const [behaviorInput, setBehaviorInput] = createSignal('one');
	const events: string[] = [];
	let externalWitness: HTMLElement | undefined;
	// eslint-disable-next-line no-unused-vars -- Solid resolves this identifier from use:cleanupWitness.
	const cleanupWitness = (node: HTMLElement, input: Accessor<string>) => {
		externalWitness = document.createElement('section');
		externalWitness.dataset.compositionWitness = '';
		externalWitness.innerHTML =
			'<output data-composition-cleanup></output><output data-behavior-log></output>';
		document.body.append(externalWitness);
		const sync = (selector: string, text: string) => {
			const local = node.querySelector(selector);
			const external = externalWitness?.querySelector(selector);
			if (local) local.textContent = text;
			if (external) external.textContent = text;
		};
		const syncLog = () => sync('[data-behavior-log]', events.join('|'));
		const install = (value: string) => {
			sync('[data-composition-cleanup]', variant === 'early-write' ? 'cleaned' : 'attached');
			events.push(`install:A:${value}`, `install:B:${value}`);
			syncLog();
			onCleanup(() => {
				if (variant === 'omit-cleanup') return;
				const cleanupOrder = variant === 'cleanup-order' ? ['A', 'B'] : ['B', 'A'];
				for (const behavior of cleanupOrder) events.push(`cleanup:${behavior}:${value}`);
				syncLog();
				sync('[data-composition-cleanup]', 'cleaned');
			});
		};
		if (variant === 'reinstall-omit') {
			install(untrack(input));
			return;
		}
		createEffect(() => install(input()));
	};
	return (
		<section data-composition-witness use:cleanupWitness={behaviorInput()}>
			<output data-composition-cleanup />
			<output data-behavior-log />
			<button data-action="change-behavior-input" onClick={() => setBehaviorInput('two')}>
				Change behavior input
			</button>
		</section>
	);
}

export const solidCompositionReferences: Record<string, () => JSX.Element> = {
	'C1-slot-rendering': SlotPage,
	'C2-shared-propagation': SharedPage,
	'C3-ref-driven-focus': FocusPage,
	'C4-attach-cleanup': CleanupPage,
};

export function makeSolidCompositionMutant(mutant: SolidCompositionMutant): () => JSX.Element {
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

function ScopeControls(props: { label: string }) {
	const store = useCompositionShared();
	return (
		<>
			<button data-scope-increment={props.label} onClick={store.advance}>
				Increment
			</button>
			<output data-scope-value={props.label}>{store.count()}</output>
		</>
	);
}

export function SolidContainerScopeReference() {
	return (
		<SharedProvider>
			<ScopeControls label="container" />
		</SharedProvider>
	);
}

const pageStore = createSharedStore();

export function resetSolidPageScopeReference() {
	pageStore.reset();
}

export function SolidPageScopeReference() {
	return (
		<SharedContext.Provider value={pageStore}>
			<ScopeControls label="page" />
		</SharedContext.Provider>
	);
}

type SolidPropsValue = ReturnType<typeof createSolidPropsValue>;

function createSolidPropsValue() {
	const [value] = createSignal(5);
	return { value };
}

const SolidPropsValueContext = createContext<SolidPropsValue>();

function useSolidPropsValue() {
	const value = useContext(SolidPropsValueContext);
	if (!value) throw new Error('useSolidPropsValue is missing its provider');
	return value;
}

export function SolidPropsValueProvider(props: { children: JSX.Element }) {
	const value = createSolidPropsValue();
	return (
		<SolidPropsValueContext.Provider value={value}>
			{props.children}
		</SolidPropsValueContext.Provider>
	);
}

export function SolidPropsTierReference() {
	const shared = useSolidPropsValue();
	return <output data-tier-props>{shared.value()}</output>;
}

export function SolidScalarContextTierReference() {
	return (
		<>
			<output data-tier-scalar="left">6</output>
			<output data-tier-scalar="right">6</output>
		</>
	);
}

export function SolidObjectContextTierReference() {
	return (
		<>
			<output data-tier-object="first">7|seven</output>
			<output data-tier-object="second">7|seven</output>
		</>
	);
}

const [pageTierCount, setPageTierCount] = createSignal(0);

export function resetSolidPageTierReference() {
	setPageTierCount(0);
}

export function SolidPageStoreTierReference() {
	return (
		<>
			<button
				data-action="increment-page-tier"
				onClick={() => setPageTierCount(pageTierCount() + 1)}
			>
				Increment
			</button>
			<output data-tier-page>{pageTierCount()}</output>
		</>
	);
}
