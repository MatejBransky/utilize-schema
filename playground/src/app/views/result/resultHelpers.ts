import type { Html } from '@effect/ui/html';

import type { TargetId } from '../../../targets';
import { targets } from '../../../targets';
import type { AppMessage } from '../../messages';

import resultStyles from '../../../ui/ValidatorResults.module.css';

export function failureNote(result: { issues: readonly unknown[]; error?: string }): string {
	if (result.error) {
		return 'The validator could not run';
	}

	if (result.issues.length > 0) {
		return `${result.issues.length} ${result.issues.length === 1 ? 'issue' : 'issues'}`;
	}

	return 'The validator rejected the data.';
}

export function IssueList(
	h: Html.H<AppMessage>,
	issues: readonly { path: string; message: string }[]
) {
	return h.ul.class(resultStyles.issues).children(
		issues.map((issue) =>
			h.li
				.class(resultStyles.issue)
				.key(JSON.stringify([issue.path, issue.message]))
				.children(
					h.code.class(resultStyles.path).children(issue.path),
					h.span.class(resultStyles.issueMessage).children(issue.message)
				)
		)
	);
}

export function targetLabel(target: TargetId): string {
	return targets.find((item) => item.value === target)?.label ?? target;
}
