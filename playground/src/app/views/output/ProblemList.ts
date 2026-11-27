import type { Html } from '@effect/ui/html';
import { ScrollArea } from '@effect/ui-kit';

import type { Problem, SchemaFile } from '../../../bundle';
import type { AppMessage } from '../../messages';
import { ProblemItem } from './ProblemItem';

import styles from '../../../App.module.css';

export function ProblemList(
	h: Html.H<AppMessage>,
	problems: Problem[],
	files: readonly SchemaFile[]
) {
	if (problems.length === 0) {
		return h.p.class(styles.ok).children('No problems found.');
	}

	return ScrollArea(h, {
		key: 'problems-scroll',
		view: (scrollArea) =>
			scrollArea.root(h.div.class(styles.problemScroll).attr('data-slot', 'scroll-area')).children(
				scrollArea
					.viewport(h.div.class(styles.problemViewport).attr('data-slot', 'scroll-area-viewport'))
					.children(
						scrollArea.content(h.div.attr('data-slot', 'scroll-area-content')).children(
							problems.map((problem) =>
								ProblemItem(h, {
									problem,
									fileName: files.find((file) => file.id === problem.fileId)?.name ?? 'project',
								})
							)
						)
					),
				scrollArea.scrollbar({
					element: h.div.attr('data-slot', 'scroll-area-scrollbar'),
					thumb: h.div.attr('data-slot', 'scroll-area-thumb'),
					keepMounted: true,
				})
			),
	});
}
