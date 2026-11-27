import type { Html } from '@effect/ui/html';

import type { SchemaFile } from '../../../bundle';
import type { AppMessage } from '../../messages';
import { RenameInput } from './RenameInput';
import { TabActions } from './TabActions';
import type { TabsView } from './TabsView';

import styles from '../../../App.module.css';

export interface SchemaFileTabProps {
	tabsView: TabsView;
	file: SchemaFile;
	index: number;
	activeId: string;
	editing: boolean;
	hasError: boolean;
	canClose: boolean;
	draftName: string;
	renameError: string | null;
}

export function SchemaFileTab(h: Html.H<AppMessage>, props: SchemaFileTabProps) {
	const { tabsView, file, index, activeId, editing, hasError, canClose } = props;

	return h.div
		.class(styles.tabItem)
		.attr('role', 'presentation')
		.key(file.id)
		.children(
			tabsView
				.tab({
					element: h.button
						.class(styles.tab)
						.attr('data-slot', 'tabs-tab')
						.attr('data-selected', file.id === activeId ? '' : undefined),
					value: file.id,
				})
				.children(
					index === 0 ? h.span.class(styles.rootBadge).children('root') : undefined,
					h.span
						.class(`${styles.tabName} ${editing ? styles.tabNameHidden : ''}`)
						.children(file.name),
					editing
						? RenameInput(h, { value: props.draftName, error: props.renameError })
						: undefined,
					hasError ? h.span.class(styles.tabError).attr('aria-hidden', 'true') : undefined
				),
			TabActions(h, { file, editing, canClose })
		);
}
