import type { Html } from '@effect/ui/html';

import { activeCaseOf } from '../../model';
import type { AppModel } from '../../model';
import { collapsedPercentOf, resolvedThemeOf, topSplitBounds } from '../../model';
import type { AppMessage } from '../../messages';
import { SyncState } from '../../sync';
import type { Problem, SchemaFile } from '../../../bundle';
import { DataPane } from '../data/DataPane';
import { OutputPane } from '../output/OutputPane';
import { ResultPane } from '../result/ResultPane';
import { SchemaPane } from '../schema/SchemaPane';
import { Splitter } from './Splitter';
import { WorkspacePanel } from './WorkspacePanel';

import styles from '../../../App.module.css';

export interface WorkspaceProps {
	active: SchemaFile;
	problems: Problem[];
	monacoTheme: string;
	copied: boolean;
}

export function Workspace(h: Html.H<AppMessage>, model: AppModel, props: WorkspaceProps) {
	const { min } = topSplitBounds(model);
	const max = 100 - collapsedPercentOf(model);
	const activeCase = activeCaseOf(model);

	return h.div
		.class(styles.workspace)
		.attr('data-workspace', '')
		.attr('data-slot', 'resizable')
		.attr('data-orientation', 'vertical')
		.attr('aria-label', 'Workspace layout')
		.attr('data-dragging', model.splitDragging ? '' : undefined)
		.style({ display: 'flex', flexDirection: 'column' })
		.onMount(
			SyncState({
				target: model.target,
				keywordPolicy: model.keywordPolicy,
				formatMode: model.formatMode,
				colorMode: model.colorMode,
				theme: resolvedThemeOf(model),
				files: model.files,
				data: model.data,
			})
		)
		.children(
			WorkspacePanel(h, {
				id: 'schema-output-row',
				size: model.topSplit,
				children: h.div
					.class(styles.workspaceRow)
					.children(
						SchemaPane(h, model, props.active, props.problems, props.monacoTheme),
						OutputPane(h, model, props.problems, props.monacoTheme, props.copied)
					),
			}),
			Splitter(h, model, { min, max }),
			WorkspacePanel(h, {
				id: 'test-data-row',
				size: 100 - model.topSplit,
				collapsed: model.dataCollapsed,
				children: h.div
					.class(styles.workspaceRow)
					.children(DataPane(h, model, props.monacoTheme), ResultPane(h, model, activeCase)),
			})
		);
}
