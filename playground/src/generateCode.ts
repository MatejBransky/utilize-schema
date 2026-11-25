import { generate as generateEffect } from '@utilize/effect';
import { Meta, type ParsedJSONSchema } from '@utilize/json-schema';
import { generate as generateTypeScript } from '@utilize/typescript';
import { generate as generateZod } from '@utilize/zod';

import type { ExampleGeneratorOptions } from './exampleOptions';
import type { FormatMode } from './formatMode';
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

/** The code shown in the editor and, for a runtime target, the validator it produced. */
export interface GeneratedCode {
	code: string;
	/** `null` for targets, such as TypeScript, that do not generate a runtime validator. */
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

/** Generates the code and runtime validator of the selected target only. */
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
