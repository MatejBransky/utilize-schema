import {
	dereference,
	type DereferenceOptions,
	type JSONSchema,
	link,
	logger,
	LogLevel,
	normalize,
	type NormalizeOptions,
	optimize,
	parse,
	rules,
	safeStringify,
} from '@utilize/json-schema-core';
import prettierConfig from '@utilize/prettier-config/prettier.json';
import {
	format as prettierFormat,
	type Options as PrettierOptions,
} from 'prettier';

import { generate, type GenerateOptions } from '../src';

const log = logger.withNamespace('test-utils');
logger.setNamespaceLevels('test-utils', [
	// LogLevel.DEBUG,
	LogLevel.INFO,
	LogLevel.WARN,
	LogLevel.ERROR,
]);

export function format(code: string) {
	return prettierFormat(code, {
		...(prettierConfig as PrettierOptions),
		parser: 'typescript',
	});
}

/**
 * A tagged template literal function that formats TypeScript code.
 */
export const ts = (strings: TemplateStringsArray, ...values: unknown[]) => {
	const rawString = String.raw(strings, ...values);
	return format(rawString);
};

export interface CompileOptions {
	normalize?: NormalizeOptions;
	dereference?: DereferenceOptions;
	generate?: GenerateOptions;
}

export async function compile(
	schema: JSONSchema,
	options?: CompileOptions
): Promise<string> {
	log.debug('Compiling JSON Schema to Zod...', safeStringify(schema));

	const deref = await dereference(
		schema,
		options?.dereference ?? { cwd: process.cwd(), $refOptions: {} }
	); // resolved JSONSchema refs
	log.debug('Dereferenced JSON Schema:', safeStringify(deref));

	const linked = link(deref.dereferencedSchema as JSONSchema); // parent link in every schema node
	log.debug('Linked JSON Schema:', safeStringify(linked));

	const normalized = normalize({
		rootSchema: linked,
		dereferencedPaths: deref.dereferencedPaths,
		fileName: options?.normalize.fileName ?? 'unknown',
		rules,
	}); // unified JSON Schema various functions
	log.debug('Normalized JSON Schema:', safeStringify(normalized));

	const ast = parse({ schema: normalized }); // NormalizedJSONSchema → ASTNode
	log.debug('AST:', safeStringify(ast));

	const optimizedAst = optimize(ast); // deduplicate, prefer named nodes, optimize structure
	log.debug('Optimized AST:', safeStringify(optimizedAst));

	const generated = generate(optimizedAst, {
		importZod: options?.generate?.importZod ?? false,
	}); // ASTNode → TS (Zod) code
	return format(generated);
}
