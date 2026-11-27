import type { Html } from '@effect/ui/html';
import { Button } from '@effect/ui-kit';

import type { Problem } from '../../../bundle';
import { AppMessage } from '../../messages';
import type { AppModel } from '../../model';
import { fileHasError } from '../../../problems';
import { PlusIcon } from '../../icons';
import { SchemaFileTab } from './SchemaFileTab';
import type { TabsView } from './TabsView';

import styles from '../../../App.module.css';

export function SchemaFileTabs(
	h: Html.H<AppMessage>,
	model: AppModel,
	problems: Problem[],
	tabsView: TabsView
) {
	return h.div.class(styles.tabBar).children(
		tabsView
			.list(
				h.div
					.class(styles.tabList)
					.attr('aria-label', 'Schema files')
					.attr('data-testid', 'file-tabs')
					.attr('data-slot', 'tabs-list')
			)
			.children(
				model.files.map((file, index) =>
					SchemaFileTab(h, {
						tabsView,
						file,
						index,
						activeId: model.activeId,
						editing: model.editingId === file.id,
						hasError: fileHasError(file.id, problems),
						canClose: model.files.length > 1,
						draftName: model.draftName,
						renameError: model.renameError,
					})
				)
			),
		Button(h, {
			element: h.button.class(styles.addTab).attr('aria-label', 'Add file'),
			onPress: AppMessage.ClickedAddFile(),
		})
			.attr('data-slot', 'button')
			.children(PlusIcon(h)),
		model.renameError
			? h.span.class(styles.renameError).attr('role', 'alert').children(model.renameError)
			: undefined
	);
}
