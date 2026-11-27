import type { Html } from '@effect/ui/html';
import { Collapsible } from '@effect/ui-kit';

import type { Problem } from '../../../bundle';
import { AppMessage } from '../../messages';
import type { AppModel } from '../../model';
import { ChevronDownIcon } from '../../icons';
import { ProblemList } from './ProblemList';

import styles from '../../../App.module.css';

export function ProblemsSection(h: Html.H<AppMessage>, model: AppModel, problems: Problem[]) {
	const errorCount = problems.filter((problem) => problem.severity === 'error').length;
	const warningCount = problems.length - errorCount;

	return Collapsible(h, {
		key: 'problems',
		props: { open: !model.problemsCollapsed, keepMounted: true },
		onEmit: {
			Toggled: ({ open }) => AppMessage.ToggledProblems({ open }),
			Settled: () => undefined,
		},
		view: (collapsible) =>
			collapsible
				.root(
					h.div
						.class(styles.problems)
						.attr('aria-label', 'Validation section')
						.attr('data-testid', 'problems')
						.attr('data-slot', 'collapsible')
				)
				.children(
					collapsible
						.trigger(
							h.button
								.class(styles.problemsHeader)
								.attr('data-slot', 'collapsible-trigger')
								.attr('data-closed', model.problemsCollapsed ? '' : undefined)
						)
						.children(
							h.span
								.class(styles.problemsTitle)
								.children(h.span.class(styles.heading).children('Validation'), ChevronDownIcon(h)),
							h.span
								.class(styles.counts)
								.attr('data-severity', errorCount > 0 ? 'error' : 'ok')
								.children(`${errorCount} errors, ${warningCount} warnings`)
						),
					collapsible
						.panel(
							h.div
								.class(styles.problemsBody)
								.attr('id', 'validation-problems')
								.attr('data-slot', 'collapsible-panel')
						)
						?.children(ProblemList(h, problems, model.files))
				),
	});
}
