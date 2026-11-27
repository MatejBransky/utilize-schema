import type { HandlerMap } from './types';

export const renameStartHandlers = {
	ClickedRenameFile: ($, message) => {
		const model = $.model;
		const file = model.files.find((candidate) => candidate.id === message.id);

		if (!file) {
			return model;
		}

		return $.evolve({
			editingId: file.id,
			draftName: file.name,
			renameError: null,
		});
	},
	UpdatedDraftName: ($, message) => {
		return $.evolve({ draftName: message.value });
	},
} satisfies Partial<HandlerMap>;
