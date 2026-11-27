import { clearExampleUrl } from '../../playgroundUrl';
import { newFileId, uniqueName } from '../../playgroundState';
import { generateCommand } from '../commands';
import { withWorkspace } from '../model';
import type { HandlerMap } from './types';

export const selectionHandlers = {
	SelectedFile: ($, message) => {
		return $.evolve({ activeId: message.id });
	},
	ClickedAddFile: ($) => {
		const model = $.model;
		const id = newFileId();
		const files = [
			...model.files,
			{
				id,
				name: uniqueName('untitled.json', [...model.files]),
				content: '{\n  "type": "object"\n}',
			},
		];
		const next = {
			...withWorkspace(model, files),
			activeId: id,
			editingId: null,
			busy: true,
			validation: { status: 'running' as const },
		};

		clearExampleUrl();

		return $.set(next).run(generateCommand(next));
	},
	ClickedCloseFile: ($, message) => {
		const model = $.model;
		if (model.files.length <= 1) {
			return model;
		}

		const files = model.files.filter((file) => file.id !== message.id);
		const next = {
			...withWorkspace(model, files),
			editingId: model.editingId === message.id ? null : model.editingId,
			busy: true,
			validation: { status: 'running' as const },
		};

		clearExampleUrl();

		return $.set(next).run(generateCommand(next));
	},
} satisfies Partial<HandlerMap>;
