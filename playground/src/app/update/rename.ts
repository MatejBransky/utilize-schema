import { normalizeName } from '../../bundle';
import { clearExampleUrl } from '../../playgroundUrl';
import { generateCommand } from '../commands';
import { withWorkspace } from '../model';
import type { HandlerMap } from './types';

export const renameHandlers = {
	ClickedConfirmRename: ($) => {
		const model = $.model;
		if (!model.editingId) {
			return model;
		}

		const name = model.draftName.trim();

		if (
			name &&
			model.files.some(
				(file) => file.id !== model.editingId && normalizeName(file.name) === normalizeName(name)
			)
		) {
			return $.evolve({ renameError: 'A file with this name already exists.' });
		}

		if (!name) {
			return $.evolve({ editingId: null, renameError: null });
		}

		const files = model.files.map((file) =>
			file.id === model.editingId ? { ...file, name } : file
		);
		const next = {
			...withWorkspace(model, files),
			editingId: null,
			renameError: null,
			busy: true,
			validation: { status: 'running' as const },
		};

		clearExampleUrl();

		return $.set(next).run(generateCommand(next));
	},
	CancelledRename: ($) => {
		const model = $.model;
		return model.editingId === null ? model : $.evolve({ editingId: null });
	},
	PressedOutsideRename: ($) => {
		const model = $.model;
		return model.editingId === null ? model : $.evolve({ editingId: null });
	},
} satisfies Partial<HandlerMap>;
