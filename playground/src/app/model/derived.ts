import type { KeywordPolicy } from '@utilize/json-schema';

import { buildBundle, parseJsonFile } from '../../bundle';
import type { Problem, SchemaFile } from '../../bundle';
import { exampleById, exampleCaseForData } from '../../examples';
import { resolveExampleId } from '../../playgroundState';
import { collectProblems } from '../../problems';
import { validateSchemas } from '../../validation';
import type { AppModel } from './schemas';

export function workspaceOf(files: readonly SchemaFile[], keywordPolicy: KeywordPolicy) {
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
