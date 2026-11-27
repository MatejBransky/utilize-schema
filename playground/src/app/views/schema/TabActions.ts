import type { Html } from '@effect/ui/html';
import { Button } from '@effect/ui-kit';

import type { SchemaFile } from '../../../bundle';
import { AppMessage } from '../../messages';
import { CheckIcon, CloseIcon, PencilIcon } from '../../icons';

import styles from '../../../App.module.css';

export function TabActions(
	h: Html.H<AppMessage>,
	{ file, editing, canClose }: { file: SchemaFile; editing: boolean; canClose: boolean }
) {
	return h.span.class(styles.tabActions).children(
		Button(h, {
			element: h.button
				.class(styles.tabIcon)
				.attr('aria-label', editing ? 'Confirm rename' : `Rename ${file.name}`)
				.attr('data-confirm-rename', ''),
			onPress: editing
				? AppMessage.ClickedConfirmRename()
				: AppMessage.ClickedRenameFile({ id: file.id }),
		})
			.attr('data-slot', 'button')
			.children(editing ? CheckIcon(h) : PencilIcon(h)),
		editing
			? undefined
			: Button(h, {
					element: h.button
						.class(styles.tabIcon)
						.attr('aria-label', `Close ${file.name}`)
						.attr('data-agent-confirm', 'Deletes this file and its schema from the playground'),
					props: { disabled: !canClose },
					onPress: AppMessage.ClickedCloseFile({ id: file.id }),
				})
					.attr('data-slot', 'button')
					.children(CloseIcon(h))
	);
}
