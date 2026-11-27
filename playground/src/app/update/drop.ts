import { detectRootId } from '../../bundle';
import type { SchemaFile } from '../../bundle';
import { clearExampleUrl } from '../../playgroundUrl';
import { newFileId, uniqueName } from '../../playgroundState';
import { generateCommand, validateCommand } from '../commands';
import { withWorkspace } from '../model';
import type { HandlerMap } from './types';

export const dropHandlers = {
	DroppedSchemas: ($, message) => {
		const model = $.model;
		const base = message.mode === 'replace' ? [] : model.files;
		const added: SchemaFile[] = [];

		for (const schema of message.schemas) {
			added.push({
				id: newFileId(),
				name: uniqueName(schema.name, [...base, ...added]),
				content: schema.content,
			});
		}

		if (added.length === 0) {
			return model;
		}

		const ordered =
			message.mode === 'add'
				? [...model.files, ...added]
				: (() => {
						const rootId = detectRootId(added) ?? added[0].id;
						const root = added.find((file) => file.id === rootId) ?? added[0];

						return [root, ...added.filter((file) => file.id !== root.id)];
					})();
		const activeId = message.mode === 'add' ? added[0].id : ordered[0].id;
		const next = {
			...withWorkspace(model, ordered),
			activeId,
			editingId: null,
			busy: true,
			validation: { status: 'running' as const },
			fileDragging: false,
			fileDragMode: null,
			dataDragging: false,
		};

		clearExampleUrl();

		return $.set(next).run(generateCommand(next));
	},
	DroppedData: ($, message) => {
		const model = $.model;
		if (model.dataCollapsed) {
			return model;
		}

		const next = {
			...model,
			data: message.content,
			validation: { status: 'running' as const },
			dataDragging: false,
			fileDragging: false,
			fileDragMode: null,
		};

		clearExampleUrl();

		return $.set(next).run(validateCommand(next));
	},
} satisfies Partial<HandlerMap>;
