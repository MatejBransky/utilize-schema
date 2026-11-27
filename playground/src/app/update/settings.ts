import { playgroundParams, updateUrl } from '../../playgroundUrl';
import { generateCommand } from '../commands';
import { withWorkspace } from '../model';
import type { HandlerMap } from './types';

export const settingsHandlers = {
	PickedTarget: ($, message) => {
		const model = $.model;
		const next = {
			...model,
			target: message.value,
			openSelect: null,
			busy: true,
			validation: { status: 'running' as const },
		};

		updateUrl({ [playgroundParams.generator]: message.value }, 'push');

		return $.set(next).run(generateCommand(next));
	},
	PickedKeywordPolicy: ($, message) => {
		const model = $.model;
		if (model.keywordPolicy === message.value) {
			return $.evolve({ openSelect: null });
		}

		const next = {
			...withWorkspace(model, model.files, message.value),
			keywordPolicy: message.value,
			openSelect: null,
			busy: true,
			validation: { status: 'running' as const },
		};

		updateUrl({ [playgroundParams.keywordPolicy]: message.value }, 'push');

		return $.set(next).run(generateCommand(next));
	},
	PickedFormatMode: ($, message) => {
		const model = $.model;
		if (model.formatMode === message.value) {
			return $.evolve({ openSelect: null });
		}

		const next = {
			...model,
			formatMode: message.value,
			openSelect: null,
			busy: true,
			validation: { status: 'running' as const },
		};

		updateUrl({ [playgroundParams.formatMode]: message.value }, 'push');

		return $.set(next).run(generateCommand(next));
	},
	RequestedOpenSelect: ($, message) => {
		return $.evolve({ openSelect: message.which });
	},
	RequestedCloseSelect: ($) => {
		const model = $.model;
		return model.openSelect === null ? model : $.evolve({ openSelect: null });
	},
} satisfies Partial<HandlerMap>;
