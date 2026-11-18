import { generate as generateEffect } from '@utilize/effect';
import { type ParsedJSONSchema } from '@utilize/json-schema';
import { generate as generateTypeScript } from '@utilize/typescript';
import { generate as generateZod } from '@utilize/zod';

import type { TargetId } from './targets';

/** Targets whose generated code is a runtime validator the playground can run. */
export type RuntimeTargetId = 'zod' | 'effect';

/** Generated code of one runtime target, or why the generator could not produce it. */
export type RuntimeSource =
	| { status: 'generated'; code: string }
	| { status: 'failed'; error: Error };

export type RuntimeCode = Record<RuntimeTargetId, RuntimeSource>;

const runtimeGenerators: Record<RuntimeTargetId, (root: ParsedJSONSchema) => string> = {
	zod: (root) => generateZod(root, { importZod: true }),
	effect: (root) => generateEffect(root, { importEffect: true }),
};

/**
 * Generates both runtime validators, so they can be tried out next to the
 * output even when the editor shows TypeScript or only one of them. A failing
 * generator does not stop the other one.
 */
export function generateRuntimeCode(root: ParsedJSONSchema): RuntimeCode {
	return {
		zod: generateRuntimeSource(root, 'zod'),
		effect: generateRuntimeSource(root, 'effect'),
	};
}

/** Code shown in the output editor for the selected target. */
export function generateCodeFor(target: TargetId, root: ParsedJSONSchema, runtime: RuntimeCode) {
	switch (target) {
		case 'zod':
		case 'effect':
			return generatedCode(runtime[target]);
		case 'typescript':
			return generateTypeScript(root);
		default: {
			const unknownTarget: never = target;

			throw new Error(`The ${unknownTarget} generator is not available yet.`);
		}
	}
}

function generateRuntimeSource(root: ParsedJSONSchema, target: RuntimeTargetId): RuntimeSource {
	try {
		return { status: 'generated', code: runtimeGenerators[target](root) };
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
