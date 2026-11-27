import type { KeywordPolicy } from '@utilize/json-schema';
import { Schema } from 'effect';

import { buildBundle, parseJsonFile } from '../bundle';
import type { Problem, SchemaFile } from '../bundle';
import { exampleById, exampleCaseForData, examples } from '../examples';
import type { RuntimeSource } from '../generateCode';
import { loadState, resolveExampleId } from '../playgroundState';
import { collectProblems } from '../problems';
import { targets } from '../targets';
import { loadColorMode } from '../theme';
import { validateSchemas } from '../validation';

export const Target = Schema.Literals(['zod', 'effect', 'typescript']);
export const KeywordPolicySchema = Schema.Literals(['error', 'warn', 'ignore']);
export const FormatModeSchema = Schema.Literals(['annotate', 'assert']);
const ColorMode = Schema.Literals(['auto', 'light', 'dark']);

export const SchemaFileModel = Schema.Struct({
	id: Schema.String,
	name: Schema.String,
	content: Schema.String,
});

export const ProblemModel = Schema.Struct({
	severity: Schema.Literals(['error', 'warning']),
	message: Schema.String,
	fileId: Schema.optional(Schema.String),
	line: Schema.optional(Schema.Number),
	column: Schema.optional(Schema.Number),
});

export const RuntimeModel = Schema.Union([
	Schema.Struct({
		status: Schema.Literal('generated'),
		code: Schema.String,
		runtimeCode: Schema.String,
		rootName: Schema.optional(Schema.String),
	}),
	Schema.Struct({
		status: Schema.Literal('failed'),
		message: Schema.String,
	}),
]);

export type RuntimeModel = typeof RuntimeModel.Type;

const IssueModel = Schema.Struct({ path: Schema.String, message: Schema.String });

const ReportModel = Schema.Struct({
	ok: Schema.Boolean,
	value: Schema.optional(Schema.String),
	issues: Schema.Array(IssueModel),
	error: Schema.optional(Schema.String),
});

export const ValidationModel = Schema.Union([
	Schema.Struct({ status: Schema.Literal('running') }),
	Schema.Struct({ status: Schema.Literal('unavailable'), reason: Schema.String }),
	Schema.Struct({ status: Schema.Literal('invalid-json'), message: Schema.String }),
	Schema.Struct({ status: Schema.Literal('error'), message: Schema.String }),
	Schema.Struct({ status: Schema.Literal('ready'), result: ReportModel }),
]);

export const AppModel = Schema.Struct({
	files: Schema.Array(SchemaFileModel),
	activeId: Schema.String,
	editingId: Schema.NullOr(Schema.String),
	draftName: Schema.String,
	renameError: Schema.NullOr(Schema.String),
	target: Target,
	keywordPolicy: KeywordPolicySchema,
	formatMode: FormatModeSchema,
	data: Schema.String,
	code: Schema.String,
	runtime: Schema.NullOr(RuntimeModel),
	generationProblems: Schema.Array(ProblemModel),
	schemaProblems: Schema.Array(ProblemModel),
	bundleProblems: Schema.Array(ProblemModel),
	exampleId: Schema.NullOr(Schema.String),
	busy: Schema.Boolean,
	colorMode: ColorMode,
	systemDark: Schema.Boolean,
	cursorLine: Schema.Number,
	cursorColumn: Schema.Number,
	focusRequest: Schema.Number,
	focusLine: Schema.Number,
	focusColumn: Schema.Number,
	sharedFor: Schema.NullOr(Schema.String),
	copiedFor: Schema.NullOr(Schema.String),
	copyToken: Schema.Number,
	dataCollapsed: Schema.Boolean,
	problemsCollapsed: Schema.Boolean,
	topSplit: Schema.Number,
	expandedTopSplit: Schema.Number,
	headerHeight: Schema.Number,
	workspaceHeight: Schema.Number,
	workspaceTop: Schema.Number,
	splitDragging: Schema.Boolean,
	splitHovering: Schema.Boolean,
	fileDragging: Schema.Boolean,
	fileDragMode: Schema.NullOr(Schema.Literals(['add', 'replace'])),
	dataDragging: Schema.Boolean,
	openSelect: Schema.NullOr(Schema.Literals(['generator', 'example', 'policy', 'format'])),
	validation: ValidationModel,
});

export type AppModel = typeof AppModel.Type;

export function toRuntimeModel(runtime: RuntimeSource | null): RuntimeModel | null {
	if (!runtime) {
		return null;
	}

	if (runtime.status === 'failed') {
		return { status: 'failed', message: runtime.error.message };
	}

	return {
		status: 'generated',
		code: runtime.code,
		runtimeCode: runtime.runtimeCode,
		rootName: runtime.rootName,
	};
}

export function toRuntimeSource(runtime: RuntimeModel | null): RuntimeSource | null {
	if (!runtime) {
		return null;
	}

	if (runtime.status === 'failed') {
		return { status: 'failed', error: new Error(runtime.message) };
	}

	return {
		status: 'generated',
		code: runtime.code,
		runtimeCode: runtime.runtimeCode,
		rootName: runtime.rootName,
	};
}

function workspaceOf(files: readonly SchemaFile[], keywordPolicy: KeywordPolicy) {
	const nextFiles = [...files];
	const parsed = nextFiles.map(parseJsonFile);
	const bundle = buildBundle(parsed, nextFiles[0]?.id ?? '', keywordPolicy);

	return {
		schemaProblems: validateSchemas(parsed),
		bundleProblems: bundle.problems,
		exampleId: resolveExampleId(nextFiles),
	};
}

export function signatureOf({
	files,
	target,
	keywordPolicy,
	formatMode,
	data,
}: {
	files: readonly SchemaFile[];
	target: string;
	keywordPolicy: string;
	formatMode: string;
	data: string;
}): string {
	return JSON.stringify([files, target, keywordPolicy, formatMode, data]);
}

export const activeFileOf = (model: AppModel): SchemaFile | undefined =>
	model.files.find((file) => file.id === model.activeId) ?? model.files[0];

export const activeExampleOf = (model: AppModel) => exampleById(model.exampleId);

export const activeCaseOf = (model: AppModel) => {
	const example = activeExampleOf(model);

	return example ? exampleCaseForData(example, model.data) : undefined;
};

export const resolvedThemeOf = (model: AppModel): 'light' | 'dark' =>
	model.colorMode === 'auto' ? (model.systemDark ? 'dark' : 'light') : model.colorMode;

export const monacoThemeOf = (model: AppModel): string =>
	resolvedThemeOf(model) === 'dark' ? 'utilize-dark' : 'utilize-light';

export const problemsOf = (model: AppModel): Problem[] =>
	collectProblems(
		[...model.schemaProblems],
		[...model.bundleProblems],
		[...model.generationProblems]
	);

export const collapsedPercentOf = (model: AppModel): number => {
	if (model.workspaceHeight === 0) {
		return 4;
	}

	return Math.min(100, Math.max(0, (model.headerHeight * 100) / model.workspaceHeight));
};

export function topSplitBounds(model: AppModel) {
	const collapsed = collapsedPercentOf(model);

	return { min: 20, max: Math.min(100, Math.max(20, 100 - collapsed)) };
}

function clampTop(model: AppModel, top: number): number {
	const { min, max } = topSplitBounds(model);

	return Math.min(max, Math.max(min, top));
}

export function splitFromPointer(model: AppModel, y: number) {
	if (model.workspaceHeight === 0) {
		return { topSplit: model.topSplit };
	}

	return {
		topSplit: clampTop(model, ((y - model.workspaceTop) * 100) / model.workspaceHeight),
	};
}

/** Applies a split and decides whether the test data row counts as collapsed. */
export function withTopSplit(model: AppModel, top: number): AppModel {
	const next = clampTop(model, top);
	const bottom = 100 - next;
	const collapsed = bottom <= collapsedPercentOf(model) + 0.25;

	return {
		...model,
		topSplit: next,
		dataCollapsed: collapsed,
		expandedTopSplit: collapsed ? model.expandedTopSplit : next,
	};
}

export function withWorkspace(
	model: AppModel,
	files: readonly SchemaFile[],
	keywordPolicy = model.keywordPolicy
) {
	const nextFiles = [...files];
	const derived = workspaceOf(nextFiles, keywordPolicy);
	const activeId = nextFiles.some((file) => file.id === model.activeId)
		? model.activeId
		: (nextFiles[0]?.id ?? '');

	return { ...model, files: nextFiles, activeId, ...derived };
}

export function initialModel(): AppModel {
	const initial = loadState();
	const files = initial.files;
	const derived = workspaceOf(files, initial.keywordPolicy);

	return {
		files,
		activeId: files[0]?.id ?? '',
		editingId: null,
		draftName: '',
		renameError: null,
		target: initial.target,
		keywordPolicy: initial.keywordPolicy,
		formatMode: initial.formatMode,
		data: initial.data,
		code: '',
		runtime: null,
		generationProblems: [],
		schemaProblems: derived.schemaProblems,
		bundleProblems: derived.bundleProblems,
		exampleId: derived.exampleId,
		busy: true,
		colorMode: loadColorMode(),
		systemDark: window.matchMedia('(prefers-color-scheme: dark)').matches,
		cursorLine: 1,
		cursorColumn: 1,
		focusRequest: 0,
		focusLine: 1,
		focusColumn: 1,
		sharedFor: null,
		copiedFor: null,
		copyToken: 0,
		dataCollapsed: false,
		problemsCollapsed: false,
		topSplit: 60,
		expandedTopSplit: 60,
		headerHeight: 0,
		workspaceHeight: 0,
		workspaceTop: 0,
		splitDragging: false,
		splitHovering: false,
		fileDragging: false,
		fileDragMode: null,
		dataDragging: false,
		openSelect: null,
		validation: { status: 'running' },
	};
}

export function targetOptionsFor() {
	return targets.map((option) => ({
		value: option.value,
		label: option.label,
		disabled: option.disabled === true,
	}));
}

export function exampleOptionsFor() {
	return examples.map((example) => ({ value: example.id, label: example.name }));
}
