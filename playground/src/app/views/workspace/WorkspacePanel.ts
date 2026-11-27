import type { Html } from '@effect/ui/html';
import type { View } from '@effect/ui';

import type { AppMessage } from '../../messages';

import styles from '../../../App.module.css';

export function WorkspacePanel(
	h: Html.H<AppMessage>,
	{
		id,
		size,
		collapsed,
		children,
	}: {
		id: string;
		size: number;
		collapsed?: boolean;
		children: View.Input<AppMessage>;
	}
) {
	return h.div
		.class(styles.workspacePanel)
		.attr('id', id)
		.attr('data-slot', 'resizable-panel')
		.attr('data-orientation', 'vertical')
		.attr('data-collapsed', collapsed ? 'true' : undefined)
		.style({
			flex: '1 1 var(--resizable-panel-size, 0px)',
			minWidth: '0',
			minHeight: '0',
			'--resizable-panel-size': `${size}%`,
		})
		.children(children);
}
