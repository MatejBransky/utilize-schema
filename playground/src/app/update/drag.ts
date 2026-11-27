import type { HandlerMap } from './types';

export const dragHandlers = {
	EnteredFiles: ($) => {
		return $.evolve({ fileDragging: true });
	},
	MovedOverFiles: ($, message) => {
		const model = $.model;
		return $.evolve({
			fileDragging: true,
			fileDragMode: message.overData ? null : message.mode,
			dataDragging: message.overData && !model.dataCollapsed,
		});
	},
	LeftFiles: ($) => {
		return $.evolve({ fileDragging: false, fileDragMode: null, dataDragging: false });
	},
	EndedFileDrag: ($) => {
		return $.evolve({ fileDragging: false, fileDragMode: null, dataDragging: false });
	},
} satisfies Partial<HandlerMap>;
