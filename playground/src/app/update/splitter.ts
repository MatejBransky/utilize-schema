import { splitFromPointer, topSplitBounds, withTopSplit } from '../model';
import type { HandlerMap } from './types';

export const splitterHandlers = {
	PressedSplitter: ($, message) => {
		const model = $.model;
		return $.evolve({
			splitDragging: true,
			splitHovering: true,
			...splitFromPointer(model, message.y),
		});
	},
	MovedSplitter: ($, message) => {
		const model = $.model;
		return model.splitDragging ? $.evolve(splitFromPointer(model, message.y)) : model;
	},
	ReleasedSplitter: ($) => {
		const model = $.model;
		if (!model.splitDragging) {
			return model;
		}

		const next = withTopSplit(model, model.topSplit);

		return $.evolve({
			splitDragging: false,
			splitHovering: false,
			topSplit: next.topSplit,
			dataCollapsed: next.dataCollapsed,
			expandedTopSplit: next.expandedTopSplit,
		});
	},
	PressedSplitterKey: ($, message) => {
		const model = $.model;
		const { min, max } = topSplitBounds(model);
		const step = message.shift ? 10 : 2;
		const top =
			message.key === 'Home'
				? min
				: message.key === 'End'
					? max
					: message.key === 'ArrowUp'
						? model.topSplit - step
						: message.key === 'ArrowDown'
							? model.topSplit + step
							: model.topSplit;

		if (top === model.topSplit) {
			return model;
		}

		const next = withTopSplit(model, top);

		return $.evolve({
			topSplit: next.topSplit,
			dataCollapsed: next.dataCollapsed,
			expandedTopSplit: next.expandedTopSplit,
		});
	},
} satisfies Partial<HandlerMap>;
