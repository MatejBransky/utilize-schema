// fallow-ignore-file coverage-gaps -- the handlers run in the spawned mapper process; the integration tests exercise them end to end

import { isTarget, schemaModule } from './module';
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
};

const projects = new Map<string, MapperOptions>();

/** The content mapper methods TypeScript calls over JSON-RPC. */
export function mapperHandlers() {
	return {
		initialize(params: unknown) {
			const { protocolVersion } = (params ?? {}) as { protocolVersion?: number };

			return {
				protocolVersion: protocolVersion ?? 1,
				// oxlint-disable-next-line unicorn/text-encoding-identifier-case -- the LSP protocol value is "utf-8"
				positionEncoding: 'utf-8' as const,
				diagnosticSource: 'utilize-schema',
			};
		},
		openProject(params: unknown) {
			const project = params as OpenProjectParams;
			const options = project.options ?? {};

			projects.set(project.projectHandle, options);

			return { optionDiagnostics: validateOptions(options) };
		},
		async transform(params: unknown): Promise<TransformResult> {
			const request = params as TransformParams;
			const result = await schemaModule(
				request.fileName,
				request.content,
				projects.get(request.projectHandle) ?? {}
			);

			return {
				extension: '.ts',
				text: result.text,
				...(result.diagnostics ? { diagnostics: result.diagnostics } : {}),
				mappings: [],
			};
		},
		closeProject(params: unknown) {
			projects.delete((params as { projectHandle: string }).projectHandle);
			return {};
		},
	};
}

function validateOptions(options: Record<string, unknown>): OptionDiagnostic[] {
	const diagnostics: OptionDiagnostic[] = [];

	for (const key of Object.keys(options)) {
		if (key !== 'target') {
			diagnostics.push({
				path: [key],
				messageText: `Unknown content mapper option "${key}".`,
				code: 100,
			});
		}
	}

	if (options.target !== undefined && !isTarget(options.target)) {
		diagnostics.push({
			path: ['target'],
			messageText: 'target must be "zod", "effect" or "typescript".',
			code: 101,
		});
	}

	return diagnostics;
}
