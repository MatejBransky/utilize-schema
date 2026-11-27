import type { Html } from '@effect/ui/html';
import { Button } from '@effect/ui-kit';

import type { SchemaFile } from '../../../bundle';
import { AppMessage } from '../../messages';

import styles from '../../../App.module.css';

export function SchemaStatusBar(
	h: Html.H<AppMessage>,
	{
		active,
		cursorLine,
		cursorColumn,
	}: { active: SchemaFile; cursorLine: number; cursorColumn: number }
) {
	return h.div.class(styles.statusBar).children(
		h.span(active.name),
		h.span(`Ln ${cursorLine}, Col ${cursorColumn}`),
		h.span.class(styles.statusActions).children(
			h.span(`${active.content.length} chars`),
			Button(h, {
				element: h.button.class(styles.statusButton),
				onPress: AppMessage.ClickedFormatEditor({ editorId: 'schema' }),
			})
				.attr('data-slot', 'button')
				.children('Format schema')
		)
	);
}
