import { Mount } from '@effect/ui';
import { Effect, Queue, Schema, Stream } from 'effect';

import { createEditorOptions } from '../monaco/options';
import { monaco, preloadEffectTypes } from '../monaco/setup';

export interface EditorHandle {
	format(): void;
	focusAt(line: number, column: number): void;
	getValue(): string;
}

const handles = new Map<string, EditorHandle>();

export function editorHandle(id: string): EditorHandle | undefined {
	return handles.get(id);
}

const EditorEvent = Schema.Union([
	Schema.Struct({
		type: Schema.Literal('changed'),
		editorId: Schema.String,
		value: Schema.String,
	}),
	Schema.Struct({
		type: Schema.Literal('cursor'),
		editorId: Schema.String,
		line: Schema.Number,
		column: Schema.Number,
	}),
	Schema.Struct({
		type: Schema.Literal('focused'),
		editorId: Schema.String,
	}),
]);

export type EditorEvent = typeof EditorEvent.Type;

const EditorArgsFields = {
	editorId: Schema.String,
	value: Schema.String,
	language: Schema.String,
	theme: Schema.String,
	readOnly: Schema.Boolean,
	path: Schema.optional(Schema.String),
	resolveEffectTypes: Schema.Boolean,
	ariaLabel: Schema.optional(Schema.String),
	testId: Schema.optional(Schema.String),
	focusRequest: Schema.Number,
	focusLine: Schema.Number,
	focusColumn: Schema.Number,
};

type EditorArgs = Schema.Struct<typeof EditorArgsFields>['Type'];

interface Host {
	apply(next: EditorArgs): void;
	dispose(): void;
}

function syncInputMode(host: HTMLElement | null, readOnly: boolean) {
	if (!host) {
		return;
	}

	for (const element of host.querySelectorAll<HTMLElement>('textarea, .native-edit-context')) {
		if (readOnly) {
			// `domReadOnly` covers the textarea that older browsers use, while
			// `inputmode="none"` asks browsers using EditContext to keep the
			// on-screen keyboard down. Neither blocks focus, selection or scrolling.
			element.setAttribute('inputmode', 'none');
		} else {
			element.removeAttribute('inputmode');
		}
	}
}

interface VirtualKeyboardNavigator extends Navigator {
	virtualKeyboard?: { hide(): void };
}

/**
 * Hands the host node to Monaco and reports its edits and cursor moves. The
 * editor lives as long as the element, and follows the args it is given.
 */
export const AttachEditor = Mount.makeStream(
	'AttachEditor',
	{ args: EditorArgsFields },
	(node: HTMLElement, args, changes) =>
		Stream.callback<EditorEvent>((queue) =>
			Effect.acquireRelease(
				Effect.sync(() => createHost(node, args, (event) => Queue.offerUnsafe(queue, event))),
				(host) => Effect.sync(() => host.dispose())
			).pipe(
				Effect.tap((host) =>
					Effect.forkScoped(
						Stream.runForEach(changes, (next) => Effect.sync(() => host.apply(next)))
					)
				)
			)
		)
);

function createHost(
	node: HTMLElement,
	args: EditorArgs,
	offer: (event: EditorEvent) => void
): Host {
	const model = monaco.editor.createModel(
		args.value,
		args.language,
		args.path ? monaco.Uri.parse(args.path) : undefined
	);
	const editor = monaco.editor.create(node, {
		model,
		...createEditorOptions({
			readOnly: args.readOnly,
			theme: args.theme,
			ariaLabel: args.ariaLabel,
		}),
	});

	let lastFocusRequest = args.focusRequest;
	let readOnly = args.readOnly;

	node.dataset.value = args.value;
	if (args.testId !== undefined) {
		node.dataset.testid = args.testId;
	}

	syncInputMode(editor.getDomNode(), readOnly);

	const contentSubscription = editor.onDidChangeModelContent(() => {
		const value = editor.getValue();

		node.dataset.value = value;
		offer({
			type: 'changed',
			editorId: args.editorId,
			value,
		});
	});
	const cursorSubscription = editor.onDidChangeCursorPosition((event) => {
		offer({
			type: 'cursor',
			editorId: args.editorId,
			line: event.position.lineNumber,
			column: event.position.column,
		});
	});

	// Some browsers (Chromium with EditContext) ignore `inputmode="none"` and
	// still open the on-screen keyboard when a read-only editor is focused.
	// Hide it without taking focus away, so the code stays selectable.
	const onFocusIn = () => {
		if (readOnly) {
			(navigator as VirtualKeyboardNavigator).virtualKeyboard?.hide();
		}
	};

	node.addEventListener('focusin', onFocusIn);

	const position = editor.getPosition();

	if (position) {
		offer({
			type: 'cursor',
			editorId: args.editorId,
			line: position.lineNumber,
			column: position.column,
		});
	}

	if (args.focusRequest > 0) {
		const nextPosition = {
			lineNumber: Math.max(1, args.focusLine),
			column: Math.max(1, args.focusColumn),
		};

		editor.setPosition(nextPosition);
		editor.revealPositionInCenter(nextPosition);
		editor.focus();
		offer({ type: 'focused', editorId: args.editorId });
	}

	if (args.resolveEffectTypes) {
		void preloadEffectTypes();
	}

	async function formatDocument() {
		const action = editor.getAction('editor.action.formatDocument');

		if (!action) {
			return;
		}

		const wasReadOnly = editor.getOption(monaco.editor.EditorOption.readOnly);

		// The built-in format action is disabled in read-only editors, so unlock
		// the editor for the duration of the format request.
		if (wasReadOnly) {
			editor.updateOptions({ readOnly: false, domReadOnly: false });
		}

		try {
			await action.run();
		} finally {
			if (wasReadOnly) {
				editor.updateOptions({ readOnly: true, domReadOnly: true });
			}
		}
	}

	handles.set(args.editorId, {
		format() {
			void formatDocument();
		},
		focusAt(line, column) {
			const next = {
				lineNumber: Math.max(1, line),
				column: Math.max(1, column),
			};

			editor.setPosition(next);
			editor.revealPositionInCenter(next);
			editor.focus();
		},
		getValue() {
			return editor.getValue();
		},
	});

	return {
		apply(next) {
			if (next.value !== model.getValue()) {
				const cursor = editor.getPosition();

				model.setValue(next.value);

				if (cursor) {
					editor.setPosition(cursor);
				}
			}

			node.dataset.value = next.value;
			readOnly = next.readOnly;
			editor.updateOptions({
				readOnly: next.readOnly,
				domReadOnly: next.readOnly,
				ariaLabel: next.ariaLabel,
			});
			syncInputMode(editor.getDomNode(), next.readOnly);
			monaco.editor.setTheme(next.theme);

			if (next.resolveEffectTypes) {
				void preloadEffectTypes();
			}

			if (next.focusRequest !== lastFocusRequest) {
				lastFocusRequest = next.focusRequest;
				const nextPosition = {
					lineNumber: Math.max(1, next.focusLine),
					column: Math.max(1, next.focusColumn),
				};

				editor.setPosition(nextPosition);
				editor.revealPositionInCenter(nextPosition);
				editor.focus();
				offer({ type: 'focused', editorId: next.editorId });
			}
		},
		dispose() {
			contentSubscription.dispose();
			cursorSubscription.dispose();
			node.removeEventListener('focusin', onFocusIn);
			editor.dispose();
			model.dispose();
			handles.delete(args.editorId);
		},
	};
}
