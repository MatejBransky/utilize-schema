import { Html } from '@effect/ui/html';

import { detectRootId, normalizeName } from '../bundle';
import type { SchemaFile } from '../bundle';
import { exampleData, examples } from '../examples';
import { clearExampleUrl, playgroundParams, setExampleUrl, updateUrl } from '../playgroundUrl';
import { newFileId, uniqueName } from '../playgroundState';
import {
	CopyCode,
	FormatEditor,
	Share,
	WaitBeforeClearingCopy,
	generateCommand,
	validateCommand,
} from './commands';
import { AppMessage } from './messages';
import {
	AppModel,
	activeExampleOf,
	collapsedPercentOf,
	initialModel,
	splitFromPointer,
	topSplitBounds,
	withTopSplit,
	withWorkspace,
} from './model';
import { colorModeAfter } from './sync';
import { AppView } from './views';

export const App = Html.component({
	name: 'App',
	model: AppModel,
	message: AppMessage,
}).make({
	init: ($) => {
		const model = initialModel();

		return $.set(model).run(generateCommand(model));
	},
	update: {
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
		RequestedOpenSelect: ($, message) => {
			return $.evolve({ openSelect: message.which });
		},
		RequestedCloseSelect: ($) => {
			const model = $.model;
			return model.openSelect === null ? model : $.evolve({ openSelect: null });
		},
		ClickedShare: ($) => {
			const model = $.model;
			return $.run(
				Share.make({
					files: [...model.files],
					target: model.target,
					keywordPolicy: model.keywordPolicy,
					formatMode: model.formatMode,
					data: model.data,
				})
			);
		},
		Shared: ($, message) => {
			return $.evolve({ sharedFor: message.signature });
		},
		ClickedCopyCode: ($) => {
			const model = $.model;
			return $.run(CopyCode.make({ fallback: model.code }));
		},
		CopiedCode: ($, message) => {
			const model = $.model;
			const token = model.copyToken + 1;

			return $.evolve({ copiedFor: message.value, copyToken: token }).run(
				WaitBeforeClearingCopy.make({ token })
			);
		},
		FailedCopy: ($) => {
			return $.evolve({ copiedFor: null });
		},
		CopyFeedbackExpired: ($, message) => {
			const model = $.model;
			return message.token === model.copyToken ? $.evolve({ copiedFor: null }) : model;
		},
		ClickedFormatEditor: ($, message) => {
			return $.run(FormatEditor.make({ editorId: message.editorId }));
		},
		EnteredFiles: ($) => {
			return $.evolve({ fileDragging: true });
		},
		MovedOverFiles: ($, message) => {
			const model = $.model;
			return $.evolve({
				fileDragging: true,
				fileDragMode: message.overData ? null : message.mode,
				dataDragging: message.overData && !model.dataCollapsed,
			});
		},
		LeftFiles: ($) => {
			return $.evolve({ fileDragging: false, fileDragMode: null, dataDragging: false });
		},
		EndedFileDrag: ($) => {
			return $.evolve({ fileDragging: false, fileDragMode: null, dataDragging: false });
		},
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
		MeasuredLayout: ($, message) => {
			const model = $.model;
			const measured = {
				...model,
				headerHeight: message.headerHeight,
				workspaceHeight: message.workspaceHeight,
				workspaceTop: message.workspaceTop,
			};
			const collapsed = measured.dataCollapsed;
			const topSplit = collapsed ? 100 - collapsedPercentOf(measured) : measured.topSplit;

			return $.evolve({
				headerHeight: message.headerHeight,
				workspaceHeight: message.workspaceHeight,
				workspaceTop: message.workspaceTop,
				topSplit,
			});
		},
		PressedSplitter: ($, message) => {
			const model = $.model;
			return $.evolve({
				splitDragging: true,
				splitHovering: true,
				...splitFromPointer(model, message.y),
			});
		},
		MovedSplitter: ($, message) => {
			const model = $.model;
			return model.splitDragging ? $.evolve(splitFromPointer(model, message.y)) : model;
		},
		ReleasedSplitter: ($) => {
			const model = $.model;
			if (!model.splitDragging) {
				return model;
			}

			const next = withTopSplit(model, model.topSplit);

			return $.evolve({
				splitDragging: false,
				splitHovering: false,
				topSplit: next.topSplit,
				dataCollapsed: next.dataCollapsed,
				expandedTopSplit: next.expandedTopSplit,
			});
		},
		PressedSplitterKey: ($, message) => {
			const model = $.model;
			const { min, max } = topSplitBounds(model);
			const step = message.shift ? 10 : 2;
			const top =
				message.key === 'Home'
					? min
					: message.key === 'End'
						? max
						: message.key === 'ArrowUp'
							? model.topSplit - step
							: message.key === 'ArrowDown'
								? model.topSplit + step
								: model.topSplit;

			if (top === model.topSplit) {
				return model;
			}

			const next = withTopSplit(model, top);

			return $.evolve({
				topSplit: next.topSplit,
				dataCollapsed: next.dataCollapsed,
				expandedTopSplit: next.expandedTopSplit,
			});
		},
		HoveredSplitter: ($) => {
			const model = $.model;
			return model.splitHovering ? model : $.evolve({ splitHovering: true });
		},
		LeftSplitter: ($) => {
			const model = $.model;
			return model.splitHovering && !model.splitDragging
				? $.evolve({ splitHovering: false })
				: model;
		},
		ToggledDataOpen: ($, message) => {
			const model = $.model;
			if (message.open === !model.dataCollapsed) {
				return model;
			}

			const topSplit = message.open ? model.expandedTopSplit : 100 - collapsedPercentOf(model);

			return $.evolve({
				dataCollapsed: !message.open,
				topSplit,
			});
		},
		ToggledProblems: ($, message) => {
			return $.evolve({ problemsCollapsed: !message.open });
		},
	},
	view: AppView,
});
