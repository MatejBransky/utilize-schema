import { Component, Mount } from '@effect/ui';
import type { Html } from '@effect/ui/html';

import type { AppMessage } from '../../messages';
import type { AppModel } from '../../model';
import { AttachEditor } from '../../monaco';

import editorStyles from '../../../monaco/MonacoEditor.module.css';

export function CodeEditor(
	h: Html.H<AppMessage>,
	{ model, monacoTheme }: { model: AppModel; monacoTheme: string }
) {
	return h.div
		.class(editorStyles.host)
		.attr('data-testid', 'generated-code')
		.onMount(
			AttachEditor({
				editorId: 'code',
				value: model.code || '// Generated code will appear here',
				language: 'typescript',
				theme: monacoTheme,
				readOnly: true,
				path: 'file:///playground/generated.ts',
				resolveEffectTypes: model.target === 'effect',
				ariaLabel: 'Generated TypeScript',
				focusRequest: 0,
				focusLine: 1,
				focusColumn: 1,
			}).pipe(Mount.map(() => Component.noop))
		);
}
