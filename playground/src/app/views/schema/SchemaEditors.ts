import { Mount } from '@effect/ui';
import type { Html } from '@effect/ui/html';

import type { SchemaFile } from '../../../bundle';
import type { AppMessage } from '../../messages';
import { AttachEditor } from '../../monaco';
import { editorMessage } from '../messages';

import editorStyles from '../../../monaco/MonacoEditor.module.css';
import styles from '../../../App.module.css';

export function SchemaEditors(
	h: Html.H<AppMessage>,
	{
		active,
		monacoTheme,
		focusRequest,
		focusLine,
		focusColumn,
	}: {
		active: SchemaFile;
		monacoTheme: string;
		focusRequest: number;
		focusLine: number;
		focusColumn: number;
	}
) {
	return h.div.class(styles.editorFill).children(
		h.div
			.class(editorStyles.host)
			.attr('data-testid', 'schema-editor')
			.onMount(
				AttachEditor({
					editorId: 'schema',
					value: active.content,
					language: 'json',
					theme: monacoTheme,
					readOnly: false,
					resolveEffectTypes: false,
					ariaLabel: `${active.name} schema`,
					focusRequest,
					focusLine,
					focusColumn,
				}).pipe(Mount.map((event) => editorMessage(event, active.id)))
			)
	);
}
