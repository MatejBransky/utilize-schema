import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

import { createEditorOptions } from './options';
import { monaco, preloadEffectTypes } from './setup';

import styles from './MonacoEditor.module.css';

export interface MonacoEditorHandle {
	format(): void;
	focus(): void;
	focusAt(line: number, column: number): void;
	getValue(): string;
}

interface MonacoEditorProps {
	value: string;
	language: string;
	theme: string;
	path?: string;
	readOnly?: boolean;
	/** Registers the Effect Schema declarations with the TypeScript worker. */
	resolveEffectTypes?: boolean;
	ariaLabel?: string;
	testId?: string;
	onChange?: (value: string) => void;
	onCursorChange?: (line: number, column: number) => void;
}

export const MonacoEditor = forwardRef<MonacoEditorHandle, MonacoEditorProps>(function MonacoEditor(
	{
		value,
		language,
		theme,
		path,
		readOnly = false,
		resolveEffectTypes: loadEffectTypes = false,
		ariaLabel,
		testId,
		onChange,
		onCursorChange,
	},
	ref
) {
	const hostRef = useRef<HTMLDivElement>(null);
	const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
	const callbacks = useRef({ onChange, onCursorChange });

	callbacks.current = { onChange, onCursorChange };

	useEffect(() => {
		if (loadEffectTypes) {
			void preloadEffectTypes();
		}
	}, [loadEffectTypes]);

	useEffect(() => {
		const host = hostRef.current;

		if (!host) {
			return undefined;
		}

		const model = monaco.editor.createModel(
			value,
			language,
			path ? monaco.Uri.parse(path) : undefined
		);
		const editor = monaco.editor.create(host, {
			model,
			...createEditorOptions({ readOnly, theme, ariaLabel }),
		});

		editorRef.current = editor;

		const contentSubscription = editor.onDidChangeModelContent(() => {
			callbacks.current.onChange?.(editor.getValue());
		});
		const cursorSubscription = editor.onDidChangeCursorPosition((event) => {
			callbacks.current.onCursorChange?.(event.position.lineNumber, event.position.column);
		});

		const position = editor.getPosition();

		if (position) {
			callbacks.current.onCursorChange?.(position.lineNumber, position.column);
		}

		return () => {
			contentSubscription.dispose();
			cursorSubscription.dispose();
			editor.dispose();
			model.dispose();
			editorRef.current = null;
		};
		// The editor is created once per mount; switching files remounts it via `key`.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		const editor = editorRef.current;

		if (!editor) {
			return;
		}

		const model = editor.getModel();

		if (!model || model.getValue() === value) {
			return;
		}

		const position = editor.getPosition();

		model.setValue(value);

		if (position) {
			editor.setPosition(position);
		}
	}, [value]);

	useEffect(() => {
		const editor = editorRef.current;

		if (!editor) {
			return;
		}

		editor.updateOptions({ readOnly, domReadOnly: readOnly });
	}, [readOnly]);

	useEffect(() => {
		const host = hostRef.current;
		const touchDevice =
			navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches;

		if (!host || !readOnly || !touchDevice) {
			return;
		}

		// A tap focuses the edit surface even when the editor is read-only, which
		// opens the on-screen keyboard on mobile. Keep the read-only editor out of
		// text input mode; its code can still be copied with the Copy button.
		const onFocusIn = (event: FocusEvent) => {
			if (event.target instanceof HTMLElement && host.contains(event.target)) {
				event.target.blur();
			}
		};

		host.addEventListener('focusin', onFocusIn);

		return () => host.removeEventListener('focusin', onFocusIn);
	}, [readOnly]);

	useEffect(() => {
		monaco.editor.setTheme(theme);
	}, [theme]);

	async function formatDocument() {
		const editor = editorRef.current;
		const action = editor?.getAction('editor.action.formatDocument');

		if (!editor || !action) {
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

	useImperativeHandle(
		ref,
		() => ({
			format() {
				void formatDocument();
			},
			focus() {
				editorRef.current?.focus();
			},
			focusAt(line, column) {
				const editor = editorRef.current;

				if (!editor) {
					return;
				}

				const position = {
					lineNumber: Math.max(1, line),
					column: Math.max(1, column),
				};

				editor.setPosition(position);
				editor.revealPositionInCenter(position);
				editor.focus();
			},
			getValue() {
				return editorRef.current?.getValue() ?? '';
			},
		}),
		[]
	);

	return <div ref={hostRef} className={styles.host} data-testid={testId} />;
});
