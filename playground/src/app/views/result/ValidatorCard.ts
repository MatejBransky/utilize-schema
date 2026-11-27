import type { Html } from '@effect/ui/html';

import type { TargetId } from '../../../targets';
import type { AppMessage } from '../../messages';
import { failureNote, IssueList, targetLabel } from './resultHelpers';

import resultStyles from '../../../ui/ValidatorResults.module.css';

export interface ValidatorCardReport {
	ok: boolean;
	value?: string;
	issues: readonly { path: string; message: string }[];
	error?: string;
}

export function ValidatorCard(
	h: Html.H<AppMessage>,
	{ target, result }: { target: TargetId; result: ValidatorCardReport | undefined }
) {
	const status = result === undefined ? 'running' : result.ok ? 'valid' : 'invalid';

	return h.section
		.class(resultStyles.card)
		.attr('aria-label', `${targetLabel(target)} validation result`)
		.attr('data-testid', `result-${target}`)
		.attr('data-status', status)
		.children(
			result === undefined
				? h.p.class(resultStyles.note).children('Compiling the generated schema…')
				: result.ok
					? [
							h.p.class(resultStyles.note).children('Decoded value'),
							h.pre.class(resultStyles.value).children(result.value ?? ''),
						]
					: [
							h.p.class(resultStyles.note).children(failureNote(result)),
							result.error
								? h.p.class(resultStyles.message).children(result.error)
								: IssueList(h, result.issues),
						]
		);
}
