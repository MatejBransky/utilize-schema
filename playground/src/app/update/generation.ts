import { validateCommand } from '../commands';
import type { HandlerMap } from './types';

export const generationHandlers = {
	Generated: ($, message) => {
		const model = $.model;
		const next = {
			...model,
			code: message.code,
			runtime: message.runtime,
			generationProblems: message.problems,
			busy: false,
			validation: { status: 'running' as const },
		};

		return $.set(next).run(validateCommand(next));
	},
	Validated: ($, message) => {
		return $.evolve({ validation: message.state });
	},
} satisfies Partial<HandlerMap>;
