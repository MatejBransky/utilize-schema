import { generateCommand } from '../commands';
import { withWorkspace } from '../model';
import type { HandlerMap } from './types';

export const historyHandlers = {
	ChangedSystemTheme: ($, message) => {
		const model = $.model;
		return model.systemDark === message.dark ? model : $.evolve({ systemDark: message.dark });
	},
	ChangedHistory: ($, message) => {
		const model = $.model;
		const next = {
			...withWorkspace(
				{ ...model, target: message.target, formatMode: message.formatMode },
				message.files,
				message.keywordPolicy
			),
			target: message.target,
			keywordPolicy: message.keywordPolicy,
			formatMode: message.formatMode,
			data: message.data,
			activeId: message.files[0]?.id ?? '',
			editingId: null,
			busy: true,
			validation: { status: 'running' as const },
		};

		return $.set(next).run(generateCommand(next));
	},
} satisfies Partial<HandlerMap>;
