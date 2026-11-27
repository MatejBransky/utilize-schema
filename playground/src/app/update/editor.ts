import { clearExampleUrl } from '../../playgroundUrl';
import { generateCommand } from '../commands';
import { withWorkspace } from '../model';
import type { HandlerMap } from './types';

export const editorHandlers = {
	UpdatedFileContent: ($, message) => {
		const model = $.model;
		const file = model.files.find((candidate) => candidate.id === message.id);

		if (!file || file.content === message.content) {
			return model;
		}

		const files = model.files.map((candidate) =>
			candidate.id === message.id ? { ...candidate, content: message.content } : candidate
		);
		const next = {
			...withWorkspace(model, files),
			busy: true,
			validation: { status: 'running' as const },
		};

		clearExampleUrl();

		return $.set(next).run(generateCommand(next));
	},
	MovedCursor: ($, message) => {
		const model = $.model;
		return model.cursorLine === message.line && model.cursorColumn === message.column
			? model
			: $.evolve({ cursorLine: message.line, cursorColumn: message.column });
	},
	FocusedEditor: ($) => {
		const model = $.model;
		return model.focusRequest === 0 ? model : $.evolve({ focusRequest: 0 });
	},
	SelectedProblem: ($, message) => {
		const model = $.model;
		const focus = {
			focusRequest: model.focusRequest + 1,
			focusLine: message.line ?? 1,
			focusColumn: message.column ?? 1,
		};

		return message.fileId === null
			? $.evolve(focus)
			: $.evolve({ ...focus, activeId: message.fileId });
	},
} satisfies Partial<HandlerMap>;
