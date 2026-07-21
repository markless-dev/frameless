import { batch, createContext, createSignal, type JSX, onCleanup, useContext } from 'solid-js';

declare module 'solid-js' {
	namespace JSX {
		interface Directives {
			cleanupWitness: boolean;
		}
	}
}

export type SolidCompositionMutant =
	| 'M-SLOT-OMIT'
	| 'M-SLOT-DUP'
	| 'M-SHARED-DESYNC'
	| 'M-SHARED-STALE'
	| 'M-REF-FOCUS-OMIT'
	| 'M-ATTACH-CLEANUP-OMIT'
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

function SlotPage(props: { variant?: 'reference' | 'omit' | 'duplicate' }) {
	return (
		<Frame>
			{props.variant !== 'omit' && <strong data-projected-node>Projected composition</strong>}
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

function FocusField(props: { input: (node: HTMLInputElement | undefined) => void }) {
	return (
		<input
			data-focus-target
			ref={(node) => {
				props.input(node);
				onCleanup(() => props.input(undefined));
			}}
		/>
	);
}

function FocusPage(props: { omitFocus?: boolean }) {
	let input: HTMLInputElement | undefined;
	return (
		<>
			<FocusField input={(node) => (input = node)} />
			<button
				data-action="focus-composed"
				onClick={() => {
					if (!props.omitFocus) input?.focus();
				}}
			>
				Focus
			</button>
		</>
	);
}

function CleanupPage(props: { omitCleanup?: boolean }) {
	// eslint-disable-next-line no-unused-vars -- Solid resolves this identifier from use:cleanupWitness.
	const cleanupWitness = (node: HTMLDivElement) => {
		const witness = document.createElement('output');
		witness.dataset.compositionCleanup = '';
		witness.textContent = 'attached';
		document.body.append(witness);
		node.dataset.attached = 'true';
		onCleanup(() => {
			if (!props.omitCleanup) witness.textContent = 'cleaned';
		});
	};
	return <div data-cleanup-host use:cleanupWitness={true} />;
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
		case 'M-SHARED-DESYNC':
			return () => <SharedPage variant="desync" />;
		case 'M-SHARED-STALE':
			return () => <SharedPage variant="stale" />;
		case 'M-REF-FOCUS-OMIT':
			return () => <FocusPage omitFocus />;
		case 'M-ATTACH-CLEANUP-OMIT':
			return () => <CleanupPage omitCleanup />;
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
