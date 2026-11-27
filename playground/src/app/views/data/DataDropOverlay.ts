import type { Html } from '@effect/ui/html';

import type { AppMessage } from '../../messages';

import styles from '../../../App.module.css';

export function DataDropOverlay(h: Html.H<AppMessage>, { visible }: { visible: boolean }) {
	if (!visible) {
		return undefined;
	}

	return h.div
		.class(styles.dataDropOverlay)
		.attr('role', 'group')
		.attr('aria-label', 'Drop JSON test data')
		.children(
			h.div
				.class(styles.dropTarget)
				.attr('data-active', 'true')
				.children(
					h.span.class(styles.dropKicker).children('Test data'),
					h.h2.class(styles.dropTitle).children('Drop a JSON document'),
					h.p.class(styles.dropText).children('Its content replaces the current test data.')
				)
		);
}
