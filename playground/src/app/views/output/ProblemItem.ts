import type { Html } from '@effect/ui/html';
import { Button } from '@effect/ui-kit';

import type { Problem } from '../../../bundle';
import { AppMessage } from '../../messages';

import styles from '../../../App.module.css';

export function ProblemItem(
	h: Html.H<AppMessage>,
	{ problem, fileName }: { problem: Problem; fileName: string }
) {
	return Button(h, {
		element: h.button
			.class(styles.problem)
			.key(
				`${problem.fileId ?? ''}|${problem.severity}|${problem.line ?? ''}|${problem.column ?? ''}|${problem.message}`
			),
		onPress: AppMessage.SelectedProblem({
			fileId: problem.fileId ?? null,
			line: problem.line ?? null,
			column: problem.column ?? null,
		}),
	})
		.attr('data-slot', 'button')
		.children(
			h.span.class(styles.severity).children(problem.severity === 'error' ? 'Error' : 'Warning'),
			h.span.class(styles.problemFile).children(fileName),
			h.span
				.class(styles.problemMessage)
				.children(
					`${problem.message}${
						problem.line
							? ` (line ${problem.line}${problem.column ? `, col ${problem.column}` : ''})`
							: ''
					}`
				)
		);
}
