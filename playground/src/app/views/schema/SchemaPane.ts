import type { Html } from '@effect/ui/html';
import { Tabs } from '@effect/ui-kit';

import type { Problem, SchemaFile } from '../../../bundle';
import { AppMessage } from '../../messages';
import type { AppModel } from '../../model';
import { DropOverlay } from './DropOverlay';
import { SchemaEditors } from './SchemaEditors';
import { SchemaFileTabs } from './SchemaFileTabs';
import { SchemaStatusBar } from './SchemaStatusBar';

import styles from '../../../App.module.css';

export function SchemaPane(
	h: Html.H<AppMessage>,
	model: AppModel,
	active: SchemaFile,
	problems: Problem[],
	monacoTheme: string
) {
	const tabs = model.files.map((file) => ({ value: file.id }));

	return h.section.class(`${styles.pane} ${styles.schemaPane}`).children(
		Tabs(h, {
			key: 'files',
			props: { value: model.activeId, tabs, orientation: 'horizontal' },
			onEmit: {
				Selected: ({ value }) => AppMessage.SelectedFile({ id: value }),
			},
			view: (tabsView) =>
				tabsView
					.root(
						h.div
							.class(styles.tabs)
							.attr('data-slot', 'tabs')
							.attr('data-orientation', 'horizontal')
					)
					.children(
						SchemaFileTabs(h, model, problems, tabsView),
						tabsView
							.panel({
								element: h.div.class(styles.editorPanel).attr('data-slot', 'tabs-panel'),
								value: model.activeId,
							})
							?.children(
								SchemaEditors(h, {
									active,
									monacoTheme,
									focusRequest: model.focusRequest,
									focusLine: model.focusLine,
									focusColumn: model.focusColumn,
								})
							),
						SchemaStatusBar(h, {
							active,
							cursorLine: model.cursorLine,
							cursorColumn: model.cursorColumn,
						})
					),
		}),
		model.fileDragging && !model.dataDragging ? DropOverlay(h, model.fileDragMode) : undefined
	);
}
