import { computed, state } from '@markless/core';

// THE THIRD APPLICATION IN THIS CORPUS, and the one the board expected to
// REFUSE. It is the Codex clone Patrick named: a SIDEBAR of conversations, a
// CHAT THREAD, a STREAMING assistant response, a RIGHT DETAIL PANE WITH TABS
// and a BOTTOM DETAIL PANE WITH TABS - and the stream keeps landing while the
// app is navigated, which is the one behaviour he called out by name.
//
// IT IS AUTHORED ONCE AND ATTEMPTED IN ALL SIX LANES. What it can and cannot
// express was MEASURED on this module, not inherited:
//
//   ANGULAR - USED TO REFUSE AT EMIT, exactly as S11 did and for the same
//   reason. Every Identifier in a transplanted body must resolve to lexical
//   scope, a function parameter, a `@for` variable, or a declared component
//   member, and `Promise` was none of those. `frameless-app-fidelity-v1` T007
//   admitted exactly two names - `Promise` and `setTimeout` - to that same
//   resolver, so generated/S12.ts and the angular /codex route both exist now.
//   THE THROW ITSELF WAS KEPT: `Date`, `JSON`, `Math`, `console`, `fetch`,
//   `localStorage`, `document` and `window` are still refused by name. That
//   lane's `test/unbuilt-scenarios.ts` used to record this module's refusal and
//   is now EMPTY - which is why the suites over it assert `toEqual([])` rather
//   than iterating, since an empty iteration asserts nothing.
//
//   VUE - EMITTED, PASSED ITS OWN GATE, AND THREW IN THE BROWSER, again exactly
//   as S11 did: the emitter inlines handlers into TEMPLATE EXPRESSIONS and
//   Vue's template compiler prefixes every identifier outside GLOBALS_ALLOWED
//   with `_ctx.`, a list carrying Date and JSON but NOT Promise or setTimeout.
//   `_ctx.Promise is not a constructor`. Its SYNCHRONOUS axes - thread
//   navigation, both tab pairs, the draft binding - all worked; only the stream
//   was lost, which is EMITS-BUT-MISBEHAVES, the third verdict T001 established.
//   REPAIRED BY BOUND `<script setup>` SHIM CONSTS rather than by touching
//   upstream's list, which has no hook and was never needed - see S11's header
//   for why the `.bind(globalThis)` is load-bearing. The streamed answer was then
//   DRIVEN in a browser and observed GROWING across three distinct readings.
//
// THE FOURTEEN CONSTRAINTS BELOW ARE MEASURED. (1)-(13) are S11's, re-inherited
// because the same lanes still enforce them; (14) is this module's own and was
// measured ON THIS SOURCE.
//
// (1) NO SEED PROPS - IR-8 has no lowering for `TSArrayType`. Threads and
//     messages are seeded IN the component, exactly as S10 and S11 do, so all
//     five shipped lanes start from byte-identical data.
//
// (2) THE THREAD FILTER IS A `hidden` BINDING ON THE ROW, not a repeat over a
//     filtered view. Repeating over a `computed` is refused by Solid ("Array
//     state state:messages has unconsumed keyed identity semantics"), so the
//     repeat stays over `messages`, every message keeps its key across a thread
//     switch, and one conditional EXPRESSION decides `hidden`. That is also
//     what makes STREAMING-WHILE-NAVIGATING observable: the chunks keep landing
//     on a row that is merely hidden, and switching back reveals the finished
//     answer rather than a torn-down subtree.
//
// (3) EVERY CLICKABLE IS A `<button type="button">`. Svelte's emitted-form gate
//     refuses a bare `<span>` with a click handler
//     (`a11y_no_static_element_interactions`) and a `<label>` without a control
//     (`a11y_label_has_associated_control`).
//
// (4) NO TWO-WORD DOM EVENT IS AUTHORABLE AT ALL (DEFECTS.md 15). Every emitter
//     lowercases the whole event name, so `onKeyDown` prints `onKeydown` and
//     react-dom NEVER FIRES it. THIS APP LOSES ITS REFERENCE'S PRIMARY
//     INTERACTION: there is NO Enter-to-send, no Escape, no Tab pane focus and
//     no shortcut of any kind. The composer ships the SEND BUTTON, which is a
//     plain click and IS spellable. Nothing here fakes the keyboard.
//
// (5) NO STATE WRITE SITS INSIDE AN `if`, AND NO `await` SITS INSIDE A LOOP.
//     DEFECTS.md 8.1: the react emitter lowers only TOP-LEVEL handler
//     statements, so a write nested in an `if` is NEITHER LOWERED NOR REFUSED.
//     Every conditional here is a conditional EXPRESSION and every write is
//     top-level and unconditional. THIS IS ALSO WHY THE STREAM HAS A FIXED
//     UNROLLED CHUNK COUNT OF THREE: a variable-length stream is a write inside
//     a loop body around an await, which is unauthorable in EVERY lane.
//
// (6) EVERY STRING CELL IS A `''`-SENTINEL, never `state(null)`. `s7`'s
//     `lock = state(null)` is a LIVE qwik TS2322 in this repo's own `pnpm
//     check`: the initializer pins the inferred cell type to `null`.
//
// (7) NO TOP-LEVEL SIDE-EFFECT CALL in the component body - it emits
//     `useRef(null)` in the react lane and costs a type error.
//
// (8) NO TEMPLATE TEXT NODE HAS WHITESPACE EDGES. Every space beside an
//     interpolation is carried by the DATA (`' message in this thread'`),
//     because Angular's `escapeText` throws on template text whose own edges
//     are whitespace and the Vue gate's `condense-stable-text` rejects the
//     emitted result for the same shape.
//
// (9) THE AWAITED VALUE IS NEVER CONSUMED. `new Promise((settle) => ...)` with
//     no type argument infers `Promise<unknown>`, and `pnpm check` typechecks
//     the react, solid and qwik emitted output; consuming it costs one new
//     error per typechecking lane (react TS2345, solid TS2769, qwik TS2322) and
//     `pnpm check` would RISE. The promise here is a pure LATENCY - the
//     "artificial delay" the owner accepted - and every value written after an
//     `await` comes from a `const` captured BEFORE it.
//
// (10) THE POST-`await` WRITES ARE CHAINED THROUGH `const`s - `opened` ->
//     `chunk1` -> `chunk2` -> `chunk3` - rather than re-reading `messages`.
//     THAT IS THE ONE SHAPE WHERE ALL FOUR STREAMING LANES AGREE BY
//     CONSTRUCTION. S11 measured the divergence: react keeps const-SSA form and
//     resumes from the PRE-SUSPENSION const while solid, qwik and svelte resume
//     against the LIVE cell. A stream that re-read the cell between chunks would
//     therefore be a different app in react than in the other three, and the
//     cross-lane comparison this corpus exists for would be comparing two
//     designs. Chaining the consts makes the four lanes emit the same behaviour
//     without touching an emitter.
//
// (11) `onTrace(...)` IS THE LAST STATEMENT IN EVERY HANDLER THAT CALLS IT, and
//     `event.preventDefault()` is the FIRST statement in the submit handler,
//     before any `await`. The qwik emitter refuses otherwise: "Qwik v1 rejects
//     synchronous actions after an awaited callback".
//
// (12) TIMESTAMPS ARE LITERAL STRINGS. `Date` is a global, and the angular lane
//     cannot name one inside a transplanted body; the vue lane's template
//     compiler allows `Date` but not `Promise`, so a clock would have moved the
//     refusal around without removing it. A chat needs stamps to LOOK right, not
//     to be live, so they are data.
//
// (13) THE SEND BUTTON IS `disabled` WHILE THE STREAM RUNS OR THE DRAFT IS
//     BLANK, through a computed. That is the only submit path - a textarea does
//     not submit its form on Enter and there is no keyboard event to bind - so
//     the guard is total rather than advisory. The handler ALSO guards every
//     write with a conditional expression, because a disabled control is a UI
//     fact and constraint (5) is a lowering fact.
//
// (14) THE COMPOSER IS THE CORPUS'S FIRST `value`-BOUND `<textarea>`, AND THAT
//     WAS UNMEASURED BEFORE THIS MODULE. S7 ships a textarea, but it binds
//     `data-notes` and NOT `value`, so no lane had ever been asked to print a
//     value binding on that tag. Measured here in all six: five emit it, the
//     react lane rewrites `onInput` to `onChange` and `event.currentTarget` to
//     `event.target` - which is also why react's controlled-field warning does
//     not fire - and the vue gate accepts it as a worked-example-12a domain
//     instance. It is the FIRST v-model-shaped instance in the corpus that is
//     not an `<input>`.
export function CodexClone({ onTrace }: {
	onTrace: (name: string, detail: Record<string, unknown>, event: unknown) => void;
}) @{
	let threads = state([
		{ id: 'c1', title: 'Emit six lanes from one source', stamp: '2m ago' },
		{ id: 'c2', title: 'Measure the async door', stamp: '1h ago' },
		{ id: 'c3', title: 'Style the composer shell', stamp: 'Yesterday' },
	]);
	let messages = state([
		{
			id: 'm1',
			thread: 'c1',
			role: 'user',
			text: 'What does the corpus prove?',
			stamp: '09:41',
			live: false,
		},
		{
			id: 'm2',
			thread: 'c1',
			role: 'assistant',
			text: 'One authored source, emitted six ways, compared byte for byte.',
			stamp: '09:41',
			live: false,
		},
	]);
	let openThread = state('c1');
	let openTitle = state('Emit six lanes from one source');
	let draft = state('');
	let nextMessage = state(3);
	let nextThread = state(4);
	let status = state('idle');
	let rightTab = state('details');
	let bottomTab = state('terminal');

	const visible = computed(
		() => messages.filter((message) => message.thread === openThread).length,
	);
	const visibleLabel = computed(() =>
		messages.filter((message) => message.thread === openThread).length === 1
			? ' message in this thread'
			: ' messages in this thread',
	);
	const turns = computed(
		() =>
			messages.filter(
				(message) => message.thread === openThread && message.role === 'user',
			).length,
	);
	const turnsLabel = computed(() =>
		messages.filter((message) => message.thread === openThread && message.role === 'user')
			.length === 1
			? ' turn on the record'
			: ' turns on the record',
	);
	const streaming = computed(() => status === 'streaming');
	const blocked = computed(() => status === 'streaming' || draft.trim() === '');

	<section class="codex" data-app="codex-clone">
		<aside class="rail" data-rail="sidebar">
			<div class="brand" data-rail="brand">
				<span class="brand-mark">F</span>
				<span class="brand-name">Frameless Codex</span>
			</div>
			<button
				type="button"
				class="new-chat"
				data-action="new-chat"
				onClick={(event) => {
					const id = `c${nextThread}`;
					threads = threads.concat({ id, title: 'New conversation', stamp: 'now' });
					nextThread = nextThread + 1;
					openThread = id;
					openTitle = 'New conversation';
					onTrace('new-chat', { id }, event);
				}}
			>New chat</button>
			<p class="rail-label" data-rail="label">Chats</p>
			<ul class="rail-list" data-rail="list">
				@for (const thread of threads; key thread.id) {
					<li class="rail-row">
						<button
							type="button"
							class={openThread === thread.id ? 'rail-item selected' : 'rail-item'}
							data-thread={thread.id}
							onClick={(event) => {
								openThread = thread.id;
								openTitle = thread.title;
								onTrace('open', { id: thread.id }, event);
							}}
						>{thread.title}</button>
					</li>
				}
			</ul>
		</aside>
		<main class="thread" data-thread="main">
			<header class="thread-head">
				<h2 class="thread-title" data-thread="title">{openTitle}</h2>
				<p class="thread-meta" data-thread="meta"><strong>{visible}</strong>{visibleLabel}</p>
			</header>
			@if (visible === 0) {
				<div class="empty" data-thread="empty">
					<h3 class="empty-heading">Where should we begin?</h3>
					<p class="empty-note">Ask anything. The answer arrives in three chunks.</p>
				</div>
			} @else {
			}
			<ol class="messages" data-thread="list">
				@for (const message of messages; key message.id) {
					<li
						class={message.role === 'user' ? 'message message-user' : 'message message-assistant'}
						data-message={message.id}
						hidden={message.thread !== openThread}
					>
						<p class="message-role" data-role={message.id}>{message.role}</p>
						<p class="message-text" data-text={message.id}>{message.text}</p>
						<p class="message-stamp" data-stamp={message.id}>{message.stamp}</p>
						<span class="message-caret" data-caret={message.id} hidden={!message.live}>typing</span>
					</li>
				}
			</ol>
			<form
				class="composer"
				data-action="send"
				onClick={(event) => onTrace('press', { area: 'composer' }, event)}
				onSubmit={async (event) => {
					event.preventDefault();
					const text = draft.trim();
					const home = openThread;
					const askId = `m${nextMessage}`;
					const replyId = `m${nextMessage + 1}`;
					const asked = messages.concat({
						id: askId,
						thread: home,
						role: 'user',
						text,
						stamp: '09:42',
						live: false,
					});
					const opened = asked.concat({
						id: replyId,
						thread: home,
						role: 'assistant',
						text: '',
						stamp: '09:42',
						live: true,
					});
					messages = text === '' ? messages : opened;
					nextMessage = text === '' ? nextMessage : nextMessage + 2;
					draft = '';
					status = text === '' ? status : 'streaming';
					await new Promise((settle) => {
						setTimeout(() => settle(true), 400);
					});
					const chunk1 = opened.map((entry) =>
						entry.id === replyId
							? {
									id: entry.id,
									thread: entry.thread,
									role: entry.role,
									text: 'Reading the twelve-scenario corpus',
									stamp: entry.stamp,
									live: true,
								}
							: entry,
					);
					messages = text === '' ? messages : chunk1;
					await new Promise((settle) => {
						setTimeout(() => settle(true), 400);
					});
					const chunk2 = chunk1.map((entry) =>
						entry.id === replyId
							? {
									id: entry.id,
									thread: entry.thread,
									role: entry.role,
									text: 'Reading the twelve-scenario corpus, then emitting all six lanes',
									stamp: entry.stamp,
									live: true,
								}
							: entry,
					);
					messages = text === '' ? messages : chunk2;
					await new Promise((settle) => {
						setTimeout(() => settle(true), 400);
					});
					const chunk3 = chunk2.map((entry) =>
						entry.id === replyId
							? {
									id: entry.id,
									thread: entry.thread,
									role: entry.role,
									text: 'Reading the twelve-scenario corpus, then emitting all six lanes from one authored source.',
									stamp: entry.stamp,
									live: false,
								}
							: entry,
					);
					messages = text === '' ? messages : chunk3;
					status = 'idle';
					onTrace('send', { id: replyId, text, thread: home }, event);
				}}
			>
				<textarea
					class="composer-input"
					placeholder="Ask anything"
					data-action="draft"
					value={draft}
					onInput={(event) => draft = event.currentTarget.value}
				/>
				<div class="composer-actions">
					<p class="composer-status" data-stream="status">{status}</p>
					<button
						type="submit"
						class="send"
						data-action="send-go"
						disabled={blocked}
					>Send</button>
				</div>
			</form>
		</main>
		<aside class="pane pane-right" data-pane="right">
			<div class="tabs" data-tabs="right">
				<button
					type="button"
					class={rightTab === 'details' ? 'tab selected' : 'tab'}
					data-tab="right-details"
					onClick={(event) => {
						rightTab = 'details';
						onTrace('right-tab', { tab: 'details' }, event);
					}}
				>Details</button>
				<button
					type="button"
					class={rightTab === 'files' ? 'tab selected' : 'tab'}
					data-tab="right-files"
					onClick={(event) => {
						rightTab = 'files';
						onTrace('right-tab', { tab: 'files' }, event);
					}}
				>Files</button>
			</div>
			<div class="pane-body" data-panel="right-details" hidden={rightTab !== 'details'}>
				<p class="pane-row" data-detail="turns"><strong>{turns}</strong>{turnsLabel}</p>
				<p class="pane-row" data-detail="title">{openTitle}</p>
				<p class="pane-row" data-detail="model">gpt-frameless-12</p>
			</div>
			<div class="pane-body" data-panel="right-files" hidden={rightTab !== 'files'}>
				<p class="pane-row" data-file="fixture">s12-codex-clone.tsrx</p>
				<p class="pane-row" data-file="theme">shadcn-theme/default.css</p>
				<p class="pane-row" data-file="note">T006-codex-clone.md</p>
			</div>
		</aside>
		<section class="pane pane-bottom" data-pane="bottom">
			<div class="tabs" data-tabs="bottom">
				<button
					type="button"
					class={bottomTab === 'terminal' ? 'tab selected' : 'tab'}
					data-tab="bottom-terminal"
					onClick={(event) => {
						bottomTab = 'terminal';
						onTrace('bottom-tab', { tab: 'terminal' }, event);
					}}
				>Terminal</button>
				<button
					type="button"
					class={bottomTab === 'diff' ? 'tab selected' : 'tab'}
					data-tab="bottom-diff"
					onClick={(event) => {
						bottomTab = 'diff';
						onTrace('bottom-tab', { tab: 'diff' }, event);
					}}
				>Diff</button>
			</div>
			<div class="pane-body" data-panel="bottom-terminal" hidden={bottomTab !== 'terminal'}>
				<p class="term-row" data-term="cmd">pnpm regenerate --lane all</p>
				<p class="term-row" data-term="state">{status}</p>
				<p class="term-row" data-term="live" hidden={!streaming}>chunk in flight</p>
			</div>
			<div class="pane-body" data-panel="bottom-diff" hidden={bottomTab !== 'diff'}>
				<p class="diff-row diff-add" data-diff="add">+ three unrolled chunks</p>
				<p class="diff-row diff-del" data-diff="del">- one variable-length loop</p>
			</div>
		</section>
	</section>
}
