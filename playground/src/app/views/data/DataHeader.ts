import type { Html } from '@effect/ui/html';
import { Button } from '@effect/ui-kit';

import type { Example, ExampleCase } from '../../../examples';
import { AppMessage } from '../../messages';
import type { AppModel } from '../../model';
import { ChevronDownIcon } from '../../icons';
import type { CollapsibleView } from './CollapsibleView';
import { ExampleCases } from './ExampleCases';

import styles from '../../../App.module.css';

export function DataHeader(
	h: Html.H<AppMessage>,
	{
		collapsible,
		model,
		example,
		activeCase,
	}: {
		collapsible: CollapsibleView;
		model: AppModel;
		example: Example | undefined;
		activeCase: ExampleCase | undefined;
	}
) {
	return h.div
		.class(`${styles.outputHeader} ${styles.sectionHeader}`)
		.attr('id', 'test-data-header')
		.children(
			collapsible
				.trigger(
					h.button
						.class(styles.sectionToggle)
						.attr('data-slot', 'collapsible-trigger')
						.attr('data-closed', model.dataCollapsed ? '' : undefined)
				)
				.children(h.span.class(styles.heading).children('Test data'), ChevronDownIcon(h)),
			h.div.class(styles.outputActions).children(
				example ? ExampleCases(h, { example, activeCase: activeCase?.value }) : undefined,
				Button(h, {
					element: h.button.class(styles.statusButton),
					onPress: AppMessage.ClickedFormatEditor({ editorId: 'data' }),
				})
					.attr('data-slot', 'button')
					.children('Format data')
			)
		);
}
