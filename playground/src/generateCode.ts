import { generate as generateEffect } from '@utilize/effect';
import { type ParsedJSONSchema } from '@utilize/json-schema';
import { generate as generateTypeScript } from '@utilize/typescript';
import { generate as generateZod } from '@utilize/zod';

import type { ExampleGeneratorOptions } from './exampleOptions';
import type { FormatMode } from './formatMode';
import type { TargetId } from './targets';

/** Targets whose generated code is a runtime validator the playground can run. */
export type RuntimeTargetId = 'zod' | 'effect';

/** Generated code of one runtime target, or why the generator could not produce it. */
export type RuntimeSource =
	| { status: 'generated'; code: string }
	| { status: 'failed'; error: Error };

export type RuntimeCode = Record<RuntimeTargetId, RuntimeSource>;

const runtimeGenerators: Record<
	RuntimeTargetId,
	(root: ParsedJSONSchema, formatMode: FormatMode, options?: ExampleGeneratorOptions) => string
> = {
	zod: (root, formatMode, options) =>
		generateZod(root, { importZod: true, formatMode, ...options?.zod }),
	effect: (root, formatMode, options) =>
		generateEffect(root, { importEffect: true, formatMode, ...options?.effect }),
};

/**
 * Generates both runtime validators, so they can be tried out next to the
 * output even when the editor shows TypeScript or only one of them. A failing
 * generator does not stop the other one.
 */
export function generateRuntimeCode(
	root: ParsedJSONSchema,
	formatMode: FormatMode,
	options?: ExampleGeneratorOptions
): RuntimeCode {
	return {
		zod: generateRuntimeSource(root, 'zod', formatMode, options),
		effect: generateRuntimeSource(root, 'effect', formatMode, options),
	};
}

/** Code shown in the output editor for the selected target. */
export function generateCodeFor(
	target: TargetId,
	root: ParsedJSONSchema,
	runtime: RuntimeCode,
	formatMode: FormatMode,
	options?: ExampleGeneratorOptions
) {
	switch (target) {
		case 'zod':
		case 'effect':
			return generatedCode(runtime[target]);
		case 'typescript':
			return generateTypeScript(root, { ...options?.typescript });
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
		return { status: 'generated', code: runtimeGenerators[target](root, formatMode, options) };
	} catch (error) {
		return { status: 'failed', error: error instanceof Error ? error : new Error(String(error)) };
	}
}

function generatedCode(source: RuntimeSource): string {
	if (source.status === 'failed') {
		throw source.error;
	}

	return source.code;
}
