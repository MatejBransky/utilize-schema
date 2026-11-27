import { collapsedPercentOf } from '../model';
import type { HandlerMap } from './types';

export const layoutHandlers = {
	MeasuredLayout: ($, message) => {
		const model = $.model;
		const measured = {
			...model,
			headerHeight: message.headerHeight,
			workspaceHeight: message.workspaceHeight,
			workspaceTop: message.workspaceTop,
		};
		const collapsedTop = 100 - collapsedPercentOf(measured);
		const topSplit =
			measured.dataCollapsed && Math.abs(collapsedTop - model.topSplit) >= 0.5
				? collapsedTop
				: model.topSplit;

		return $.evolve({
			headerHeight: message.headerHeight,
			workspaceHeight: message.workspaceHeight,
			workspaceTop: message.workspaceTop,
			topSplit,
		});
	},
	HoveredSplitter: ($) => {
		const model = $.model;
		return model.splitHovering ? model : $.evolve({ splitHovering: true });
	},
	LeftSplitter: ($) => {
		const model = $.model;
		return model.splitHovering && !model.splitDragging ? $.evolve({ splitHovering: false }) : model;
	},
	ToggledDataOpen: ($, message) => {
		const model = $.model;
		if (message.open === !model.dataCollapsed) {
			return model;
		}

		const topSplit = message.open ? model.expandedTopSplit : 100 - collapsedPercentOf(model);

		return $.evolve({
			dataCollapsed: !message.open,
			topSplit,
		});
	},
	ToggledProblems: ($, message) => {
		return $.evolve({ problemsCollapsed: !message.open });
	},
} satisfies Partial<HandlerMap>;
