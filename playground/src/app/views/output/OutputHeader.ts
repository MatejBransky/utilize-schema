import type { Html } from '@effect/ui/html';
import { Button } from '@effect/ui-kit';

import { AppMessage } from '../../messages';

import styles from '../../../App.module.css';

export function OutputHeader(
	h: Html.H<AppMessage>,
	{ busy, code, copied }: { busy: boolean; code: string; copied: boolean }
) {
	return h.div.class(styles.outputHeader).children(
		h.h2.class(styles.heading).children('Generated TypeScript'),
		h.div.class(styles.outputActions).children(
			busy ? h.span.class(styles.muted).children('Generating…') : undefined,
			Button(h, {
				props: { disabled: !code || busy },
				onPress: AppMessage.ClickedCopyCode(),
			})
				.attr('data-slot', 'button')
				.children(copied ? 'Copied' : 'Copy code')
		)
	);
}
