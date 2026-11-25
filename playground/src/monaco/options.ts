// oxlint-disable-next-line import/no-namespace -- monaco-editor only exposes a namespace
import type * as monaco from 'monaco-editor';

const FONT_FAMILY =
	"ui-monospace, 'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', monospace";

export interface EditorOptionsInput {
	readOnly: boolean;
	theme: string;
	ariaLabel?: string;
}

export function createEditorOptions({
	readOnly,
	theme,
	ariaLabel,
}: EditorOptionsInput): monaco.editor.IStandaloneEditorConstructionOptions {
	return {
		theme,
		readOnly,
		// Keep the DOM textarea read-only too, so touching a read-only editor
		// never puts mobile browsers into text input mode.
		domReadOnly: readOnly,
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
	};
}
