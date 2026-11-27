import { Component, Mount } from '@effect/ui';
import type { Html } from '@effect/ui/html';
import { Input } from '@effect/ui-kit';
import { Effect } from 'effect';

import { AppMessage } from '../../messages';

import styles from '../../../App.module.css';

export function RenameInput(
	h: Html.H<AppMessage>,
	{ value, error }: { value: string; error: string | null }
) {
	return Input(h, {
		props: { value },
		onUpdate: (next) => AppMessage.UpdatedDraftName({ value: next.value }),
	})
		.class(styles.tabInput)
		.attr('aria-label', 'File name')
		.attr('aria-invalid', error ? 'true' : undefined)
		.attr('title', error ?? undefined)
		.attr('data-rename-input', '')
		.onMount(FocusRename())
		.on(
			'keydown',
			({ key }) =>
				key === 'Enter'
					? AppMessage.ClickedConfirmRename()
					: key === 'Escape'
						? AppMessage.CancelledRename()
						: undefined,
			{ preventDefault: true }
		);
}

const FocusRename = Mount.make('FocusRename', {}, (node: HTMLInputElement) =>
	Effect.sync(() => {
		node.focus();
		node.select();
	}).pipe(Effect.as(Component.noop))
);
