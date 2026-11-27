import type { Html } from '@effect/ui/html';
import { RadioGroup } from '@effect/ui-kit';

import type { Example } from '../../../examples';
import { AppMessage } from '../../messages';

import styles from '../../../App.module.css';

export function ExampleCases(
	h: Html.H<AppMessage>,
	{ example, activeCase }: { example: Example; activeCase: string | undefined }
) {
	return RadioGroup(h, {
		key: 'cases',
		props: {
			value: activeCase ?? null,
			items: example.cases.map((item) => ({ value: item.value })),
		},
		onEmit: {
			Picked: ({ value }) =>
				typeof value === 'string' ? AppMessage.PickedTestCase({ value }) : undefined,
		},
		view: (group) =>
			group
				.root(
					h.div
						.class(styles.cases)
						.attr('aria-label', 'Example test data')
						.attr('data-slot', 'segmented-control')
						.attr('role', 'radiogroup')
						.attr('aria-orientation', 'horizontal')
				)
				.children(
					h.span.class(styles.caseIndicator).attr('aria-hidden', 'true'),
					example.cases.map((item) =>
						group
							.radio({
								element: h.button
									.class(styles.case)
									.attr('data-expect', item.expect)
									.attr('data-slot', 'segmented-control-item')
									.style({
										background: activeCase === item.value ? 'var(--ui-foreground)' : undefined,
									}),
								value: item.value,
							})
							.children(item.label)
					)
				),
	});
}
