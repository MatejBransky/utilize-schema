import type { Html } from '@effect/ui/html';
import { Collapsible } from '@effect/ui-kit';

import { exampleCaseForData } from '../../../examples';
import { AppMessage } from '../../messages';
import { activeExampleOf } from '../../model';
import type { AppModel } from '../../model';
import { DataDropOverlay } from './DataDropOverlay';
import { DataEditor } from './DataEditor';
import { DataHeader } from './DataHeader';

import styles from '../../../App.module.css';

export function DataPane(h: Html.H<AppMessage>, model: AppModel, monacoTheme: string) {
	const example = activeExampleOf(model);
	const activeCase = example ? exampleCaseForData(example, model.data) : undefined;

	return Collapsible(h, {
		key: 'data',
		props: { open: !model.dataCollapsed, keepMounted: true },
		onEmit: {
			Toggled: ({ open }) => AppMessage.ToggledDataOpen({ open }),
			Settled: () => undefined,
		},
		view: (collapsible) =>
			collapsible
				.root(
					h.section
						.class(`${styles.pane} ${styles.dataPane}`)
						.attr('aria-label', 'Test data section')
						.attr('data-slot', 'collapsible')
						.attr('data-data-drop', '')
						.attr('data-collapsed', model.dataCollapsed ? '' : undefined)
				)
				.children(
					DataHeader(h, { collapsible, model, example, activeCase }),
					DataEditor(h, { collapsible, model, monacoTheme }),
					DataDropOverlay(h, { visible: model.dataDragging && !model.dataCollapsed })
				),
	});
}
