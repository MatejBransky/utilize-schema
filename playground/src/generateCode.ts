import { generate as generateEffect } from '@utilize/effect';
import { Meta, type ParsedJSONSchema } from '@utilize/json-schema';
import { generate as generateTypeScript } from '@utilize/typescript';
import { generate as generateZod } from '@utilize/zod';

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

/** Parses the schema into a new object on every call. */
export type ParseRoot = () => Promise<ParsedJSONSchema>;

const runtimeGenerators: Record<RuntimeTargetId, (root: ParsedJSONSchema) => string> = {
	zod: (root) => generateZod(root, { importZod: true }),
	effect: (root) => generateEffect(root, { importEffect: true }),
};

/**
 * Generates both runtime validators, so they can be tried out next to the
 * output even when the editor shows TypeScript or only one of them. A failing
 * generator does not stop the other one.
 *
 * Every generator gets its own parsed schema. The generators record the names
 * they choose on the parsed schema and reuse them, so a shared schema would
 * hand one generator's names to the next: Zod may name a schema `Schema`,
 * which Effect reserves for its import and has to rename.
 */
export async function generateRuntimeCode(parseRoot: ParseRoot): Promise<RuntimeCode> {
	const [zod, effect] = await Promise.all([
		parseRoot().then((root) => generateRuntimeSource(root, 'zod')),
		parseRoot().then((root) => generateRuntimeSource(root, 'effect')),
	]);

	return { zod, effect };
}

/** Code shown in the output editor for the selected target. */
export async function generateCodeFor(
	target: TargetId,
	parseRoot: ParseRoot,
	runtime: RuntimeCode
): Promise<string> {
	switch (target) {
		case 'zod':
		case 'effect':
			return generatedCode(runtime[target]);
		case 'typescript':
			return generateTypeScript(await parseRoot());
		default: {
			const unknownTarget: never = target;

			throw new Error(`The ${unknownTarget} generator is not available yet.`);
		}
	}
}

function generateRuntimeSource(root: ParsedJSONSchema, target: RuntimeTargetId): RuntimeSource {
	try {
		const code = runtimeGenerators[target](root);

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
