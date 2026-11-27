import { Share } from '../commands';
import type { HandlerMap } from './types';

export const feedbackHandlers = {
	ClickedShare: ($) => {
		const model = $.model;
		return $.run(
			Share.make({
				files: [...model.files],
				target: model.target,
				keywordPolicy: model.keywordPolicy,
				formatMode: model.formatMode,
				data: model.data,
			})
		);
	},
	Shared: ($, message) => {
		return $.evolve({ sharedFor: message.signature });
	},
} satisfies Partial<HandlerMap>;
