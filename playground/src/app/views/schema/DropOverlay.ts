import type { Html } from '@effect/ui/html';

import type { AppMessage } from '../../messages';

import styles from '../../../App.module.css';

export function DropOverlay(h: Html.H<AppMessage>, mode: 'add' | 'replace' | null) {
	return h.div
		.class(styles.dropOverlay)
		.attr('role', 'group')
		.attr('aria-label', 'Import JSON Schema files')
		.attr('data-testid', 'file-drop-overlay')
		.children(
			h.div
				.class(styles.dropTarget)
				.attr('data-drop-mode', 'add')
				.attr('data-active', mode === 'add' ? 'true' : undefined)
				.children(
					h.span.class(styles.dropKicker).children('Add'),
					h.h2.class(styles.dropTitle).children('Add to this workspace'),
					h.p
						.class(styles.dropText)
						.children(
							'Keep the files already open and add every dropped JSON schema as a new tab.'
						),
					h.span.class(styles.dropHint).children('Folders are loaded recursively.')
				),
			h.div
				.class(styles.dropTarget)
				.attr('data-drop-mode', 'replace')
				.attr('data-active', mode === 'replace' ? 'true' : undefined)
				.children(
					h.span.class(styles.dropKicker).children('Replace'),
					h.h2.class(styles.dropTitle).children('Start from the dropped files'),
					h.p
						.class(styles.dropText)
						.children('Close the current files and open only the dropped JSON schemas as tabs.'),
					h.span.class(styles.dropHint).children('Folders are loaded recursively.')
				)
		);
}
