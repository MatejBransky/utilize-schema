import type { Html } from '@effect/ui/html';

import type { AppMessage } from '../../messages';
import type { AppModel } from '../../model';
import type { ExampleCase } from '../../../examples';
import { ValidatorResults } from './ValidatorResults';

import styles from '../../../App.module.css';

export function ResultPane(
	h: Html.H<AppMessage>,
	model: AppModel,
	activeCase: ExampleCase | undefined
) {
	return h.section.class(styles.pane).children(
		h.div
			.class(`${styles.outputHeader} ${styles.sectionHeader}`)
			.children(
				h.h2.class(styles.heading).children('Generated validator results'),
				h.span
					.class(styles.muted)
					.children(activeCase ? `Expected: ${activeCase.expect}` : 'Custom test data')
			),
		h.div
			.class(styles.resultBody)
			.attr('id', 'validator-results-panel')
			.attr('hidden', model.dataCollapsed ? '' : undefined)
			.children(ValidatorResults(h, model))
	);
}
