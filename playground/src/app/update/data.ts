import { clearExampleUrl } from '../../playgroundUrl';
import { validateCommand } from '../commands';
import type { HandlerMap } from './types';

export const dataHandlers = {
	UpdatedData: ($, message) => {
		const model = $.model;
		if (message.value === model.data) {
			return model;
		}

		const next = {
			...model,
			data: message.value,
			validation: { status: 'running' as const },
		};

		clearExampleUrl();

		return $.set(next).run(validateCommand(next));
	},
} satisfies Partial<HandlerMap>;
