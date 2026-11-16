import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

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

const FONT_FAMILY =
	"ui-monospace, 'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', monospace";

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
			theme,
			readOnly,
			ariaLabel,
			automaticLayout: true,
			fontFamily: FONT_FAMILY,
			fontSize: 13,
			lineHeight: 20,
			tabSize: 2,
			insertSpaces: true,
			detectIndentation: false,
			minimap: { enabled: false },
			lineNumbersMinChars: 3,
			lineDecorationsWidth: 10,
			glyphMargin: false,
			folding: true,
			scrollBeyondLastLine: false,
			renderLineHighlight: 'line',
			overviewRulerLanes: 0,
			hideCursorInOverviewRuler: true,
			guides: { indentation: false },
			stickyScroll: { enabled: false },
			contextmenu: false,
			fixedOverflowWidgets: true,
			padding: { top: 10, bottom: 10 },
			scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
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
		editorRef.current?.updateOptions({ readOnly });
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
			editor.updateOptions({ readOnly: false });
		}

		try {
			await action.run();
		} finally {
			if (wasReadOnly) {
				editor.updateOptions({ readOnly: true });
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
