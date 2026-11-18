import { generate as generateEffect } from '@utilize/effect';
import { Meta, type ParsedJSONSchema } from '@utilize/json-schema';
import { generate as generateTypeScript } from '@utilize/typescript';
import { generate as generateZod } from '@utilize/zod';

import type { ExampleGeneratorOptions } from './exampleOptions';
import type { RuntimeTargetId, TargetId } from './targets';

/** Generated code of one runtime target, or why the generator could not produce it. */
export type RuntimeSource =
	| {
			status: 'generated';
			code: string;
			/** Export that holds the root schema. Missing for a boolean root schema. */
			rootName?: string;
	  }
	| { status: 'failed'; error: Error };

export type RuntimeCode = Record<RuntimeTargetId, RuntimeSource>;

const runtimeGenerators: Record<
	RuntimeTargetId,
	(root: ParsedJSONSchema, options?: ExampleGeneratorOptions) => string
> = {
	zod: (root, options) => generateZod(root, { importZod: true, ...options?.zod }),
	effect: (root, options) => generateEffect(root, { importEffect: true, ...options?.effect }),
};

/**
 * Generates both runtime validators, so they can be tried out next to the
 * output even when the editor shows TypeScript or only one of them. A failing
 * generator does not stop the other one.
 */
export function generateRuntimeCode(
	root: ParsedJSONSchema,
	options?: ExampleGeneratorOptions
): RuntimeCode {
	return {
		zod: generateRuntimeSource(root, 'zod', options),
		effect: generateRuntimeSource(root, 'effect', options),
	};
}

/** Code shown in the output editor for the selected target. */
export function generateCodeFor(
	target: TargetId,
	root: ParsedJSONSchema,
	runtime: RuntimeCode,
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
	options?: ExampleGeneratorOptions
): RuntimeSource {
	try {
		const code = runtimeGenerators[target](root, options);

		return { status: 'generated', code, rootName: rootDeclarationName(root) };
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

/**
 * The generators record the name they declare each standalone schema under in
 * its `resolvedName`, and the root is always a standalone schema.
 */
export function rootDeclarationName(root: ParsedJSONSchema): string | undefined {
	return typeof root === 'object' && root !== null ? root[Meta].resolvedName : undefined;
}
