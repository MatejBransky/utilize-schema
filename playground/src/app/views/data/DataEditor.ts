import { Mount } from '@effect/ui';
import type { Html } from '@effect/ui/html';

import type { AppMessage } from '../../messages';
import type { AppModel } from '../../model';
import { AttachEditor } from '../../monaco';
import type { CollapsibleView } from './CollapsibleView';
import { dataEditorMessage } from '../messages';

import editorStyles from '../../../monaco/MonacoEditor.module.css';
import styles from '../../../App.module.css';

export function DataEditor(
	h: Html.H<AppMessage>,
	{
		collapsible,
		model,
		monacoTheme,
	}: { collapsible: CollapsibleView; model: AppModel; monacoTheme: string }
) {
	return collapsible
		.panel(
			h.div
				.class(styles.editorFill)
				.attr('id', 'test-data-editor')
				.attr('data-slot', 'collapsible-panel')
		)
		?.children(
			h.div
				.class(editorStyles.host)
				.attr('data-testid', 'data-editor')
				.onMount(
					AttachEditor({
						editorId: 'data',
						value: model.data,
						language: 'json',
						theme: monacoTheme,
						readOnly: false,
						resolveEffectTypes: false,
						ariaLabel: 'Test data JSON',
						focusRequest: 0,
						focusLine: 1,
						focusColumn: 1,
					}).pipe(Mount.map((event) => dataEditorMessage(event)))
				)
		);
}
