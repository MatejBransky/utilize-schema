import { exampleData, examples } from '../../examples';
import { clearExampleUrl, setExampleUrl } from '../../playgroundUrl';
import { generateCommand, validateCommand } from '../commands';
import { activeExampleOf, withWorkspace } from '../model';
import { colorModeAfter } from '../sync';
import type { HandlerMap } from './types';

export const exampleHandlers = {
	PickedExample: ($, message) => {
		const model = $.model;
		const example = examples.find((candidate) => candidate.id === message.id);

		if (!example) {
			return $.evolve({ openSelect: null });
		}

		const next = {
			...withWorkspace(model, example.files),
			data: exampleData(example),
			editingId: null,
			busy: true,
			validation: { status: 'running' as const },
			openSelect: null,
		};

		setExampleUrl(example.id, 'push');

		return $.set(next).run(generateCommand(next));
	},
	PickedTestCase: ($, message) => {
		const model = $.model;
		const example = activeExampleOf(model);
		const item = example?.cases.find((candidate) => candidate.value === message.value);

		if (!item) {
			return model;
		}

		const next = {
			...model,
			data: JSON.stringify(item.data, null, 2),
			validation: { status: 'running' as const },
		};

		clearExampleUrl();

		return $.set(next).run(validateCommand(next));
	},
	CycledColorMode: ($) => {
		const model = $.model;
		return $.evolve({ colorMode: colorModeAfter(model.colorMode) });
	},
} satisfies Partial<HandlerMap>;
