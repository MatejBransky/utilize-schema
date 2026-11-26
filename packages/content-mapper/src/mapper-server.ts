// fallow-ignore-file coverage-gaps -- the handlers run in the spawned mapper process; the integration tests exercise them end to end

import { isTarget, MapperDiagnosticCode, schemaModule } from './module';
import type { MapperDiagnostic, MapperOptions } from './module';

interface OpenProjectParams {
	projectHandle: string;
	options?: Record<string, unknown>;
}

interface TransformParams {
	fileName: string;
	content: string;
	projectHandle: string;
}

type OptionDiagnostic = {
	path: (string | number)[];
	messageText: string;
	code: number;
};

export type TransformResult = {
	extension: '.ts';
	text: string;
	diagnostics?: MapperDiagnostic[];
	mappings: [];
	/** Files read through `$ref`; TypeScript watches them when `dynamicConfig` is on. */
	watchedFiles?: string[];
};

const projects = new Map<string, MapperOptions>();

/** The content mapper methods TypeScript calls over JSON-RPC. */
export function mapperHandlers() {
	return {
		initialize(params: unknown) {
			const protocolVersion =
				isRecord(params) && typeof params.protocolVersion === 'number' ? params.protocolVersion : 1;

			return {
				protocolVersion,
				// oxlint-disable-next-line unicorn/text-encoding-identifier-case -- the LSP protocol value is "utf-8"
				positionEncoding: 'utf-8' as const,
				diagnosticSource: 'utilize-schema',
			};
		},
		openProject(params: unknown) {
			if (!isOpenProjectParams(params)) {
				throw new Error('Invalid openProject parameters.');
			}

			const rawOptions = params.options ?? {};
			const options: MapperOptions = isTarget(rawOptions.target)
				? { target: rawOptions.target }
				: {};

			projects.set(params.projectHandle, options);

			return {
				optionDiagnostics: validateOptions(rawOptions),
				configIdentity: JSON.stringify(rawOptions),
			};
		},
		async transform(params: unknown): Promise<TransformResult> {
			if (!isTransformParams(params)) {
				throw new Error('Invalid transform parameters.');
			}

			const options = projects.get(params.projectHandle) ?? {};
			const result = await schemaModule(params.fileName, params.content, options);
			const response: TransformResult = {
				extension: '.ts',
				text: result.text,
				mappings: [],
				watchedFiles: result.dependencies ?? [],
			};

			if (result.diagnostics) {
				response.diagnostics = result.diagnostics;
			}

			return response;
		},
		closeProject(params: unknown) {
			const projectHandle = projectHandleOf(params);

			if (projectHandle !== undefined) {
				projects.delete(projectHandle);
			}

			return {};
		},
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOpenProjectParams(value: unknown): value is OpenProjectParams {
	return (
		isRecord(value) &&
		typeof value.projectHandle === 'string' &&
		(value.options === undefined || isRecord(value.options))
	);
}

function isTransformParams(value: unknown): value is TransformParams {
	return (
		isRecord(value) &&
		typeof value.projectHandle === 'string' &&
		typeof value.fileName === 'string' &&
		typeof value.content === 'string'
	);
}

function projectHandleOf(value: unknown): string | undefined {
	return isRecord(value) && typeof value.projectHandle === 'string'
		? value.projectHandle
		: undefined;
}

function validateOptions(options: Record<string, unknown>): OptionDiagnostic[] {
	const diagnostics: OptionDiagnostic[] = [];

	for (const key of Object.keys(options)) {
		if (key !== 'target') {
			diagnostics.push({
				path: [key],
				messageText: `Unknown content mapper option "${key}".`,
				code: MapperDiagnosticCode.UnknownOption,
			});
		}
	}

	if (options.target !== undefined && !isTarget(options.target)) {
		diagnostics.push({
			path: ['target'],
			messageText: 'target must be "zod", "effect" or "typescript".',
			code: MapperDiagnosticCode.InvalidOption,
		});
	}

	return diagnostics;
}
