import { generate as generateEffect } from '@utilize/effect';
import { Meta } from '@utilize/json-schema';
import type { ParsedJSONSchema } from '@utilize/json-schema';
import { generate as generateTypeScript } from '@utilize/typescript';
import { generate as generateZod } from '@utilize/zod';

import type { ExampleGeneratorOptions } from './exampleOptions';
import type { FormatMode } from './formatMode';
import type { RuntimeTargetId, TargetId } from './targets';

export type RuntimeSource =
	| {
			status: 'generated';
			code: string;
			runtimeCode: string;
			rootName?: string;
	  }
	| { status: 'failed'; error: Error };

export interface GeneratedCode {
	code: string;
	runtime: RuntimeSource | null;
}

const runtimeGenerators: Record<
	RuntimeTargetId,
	(root: ParsedJSONSchema, formatMode: FormatMode, options?: ExampleGeneratorOptions) => string
> = {
	zod: (root, formatMode, options) =>
		generateZod(root, { importZod: true, formatMode, ...options?.zod }),
	effect: (root, formatMode, options) =>
		generateEffect(root, { importEffect: true, formatMode, ...options?.effect }),
};

export function generateCodeFor(
	target: TargetId,
	root: ParsedJSONSchema,
	formatMode: FormatMode,
	options?: ExampleGeneratorOptions
): GeneratedCode {
	switch (target) {
		case 'zod':
		case 'effect': {
			const runtime = generateRuntimeSource(root, target, formatMode, options);

			return { code: generatedCode(runtime), runtime };
		}
		case 'typescript':
			return { code: generateTypeScript(root, { ...options?.typescript }), runtime: null };
		default: {
			const unknownTarget: never = target;

			throw new Error(`The ${unknownTarget} generator is not available yet.`);
		}
	}
}

function generateRuntimeSource(
	root: ParsedJSONSchema,
	target: RuntimeTargetId,
	formatMode: FormatMode,
	options?: ExampleGeneratorOptions
): RuntimeSource {
	try {
		const code = runtimeGenerators[target](root, formatMode, options);
		const rootName = typeof root === 'boolean' ? 'Root' : rootDeclarationName(root);
		const runtimeCode =
			target === 'zod' && typeof root === 'boolean' ? zodBooleanModule(code) : code;

		return { status: 'generated', code, runtimeCode, rootName };
	} catch (error) {
		return { status: 'failed', error: error instanceof Error ? error : new Error(String(error)) };
	}
}

function zodBooleanModule(code: string): string {
	const expression = code.trim().replace(/;$/, '');

	return `import { z } from 'zod';\n\nexport const Root = ${expression};`;
}

function generatedCode(source: RuntimeSource): string {
	if (source.status === 'failed') {
		throw source.error;
	}

	return source.code;
}

export function rootDeclarationName(root: ParsedJSONSchema): string | undefined {
	return typeof root === 'object' && root !== null ? root[Meta].resolvedName : undefined;
}
