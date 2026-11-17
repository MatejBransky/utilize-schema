import { $RefParser } from '@apidevtools/json-schema-ref-parser';

import type { DialectOptions } from './dialect';
import { resolveDialect } from './dialect';
import { link } from './linker';
import { Meta, type JSONSchema, type ParsedJSONSchema } from './model';
import { type DialectMap, prepareSchema } from './normalize';

type SchemaPath = string;

export interface ParseOptions extends DialectOptions {
	cwd: string;
	fileName: string;
}

export async function parse(
	schema: JSONSchema,
	options: ParseOptions
): Promise<{
	root: ParsedJSONSchema;
	get: ($ref: string) => ParsedJSONSchema;
	referencedSchemas: ParsedJSONSchema[];
}> {
	let cwd = options.cwd;
	const rootFileName = options.fileName;

	if (!cwd.endsWith('/')) {
		cwd += '/';
	}

	const parser = new $RefParser();
	// Parsing normalizes and links in place. Clone the input so the same schema
	// object can be compiled again, and with another dialect, without leftovers.
	const input = structuredClone(schema);
	const $refs = await parser.resolve(cwd, input, {});

	const entries = Object.entries($refs.values()) as Array<[SchemaPath, JSONSchema]>;

	const rootDialect = resolveDialect(schema, options).dialect.id;

	let rootDialects: DialectMap | undefined;

	entries.forEach(([filePath, entrySchema]) => {
		const rootSchema = $refs.get('#');
		const isRootSchema = entrySchema === rootSchema;
		const prefixPath = isRootSchema ? '#' : filePath.replace(cwd, '');
		const fileName = isRootSchema ? rootFileName : (filePath.split(/[\\/]/).at(-1) ?? 'Unknown');

		const dialects = prepareSchema(entrySchema, {
			dialect: options.dialect,
			fallbackDialect: rootDialect,
			unknownDialect: options.unknownDialect,
			keywordPolicy: options.keywordPolicy,
			onDialectIssue: options.onDialectIssue,
			filePath: prefixPath,
		});

		if (isRootSchema) {
			rootDialects = dialects;
		}

		link({
			schema: entrySchema,
			parent: null,
			fileName,
			filePath: prefixPath,
			path: [],
			$refs,
			stack: new Set(),
			dialects,
		});
	});
	const root = $refs.get('#') as unknown as ParsedJSONSchema;

	if (typeof root === 'object' && root !== null && !Object.hasOwnProperty.call(root, Meta)) {
		link({
			schema: root,
			parent: null,
			fileName: rootFileName,
			filePath: '#',
			path: [],
			$refs,
			stack: new Set(),
			dialects: rootDialects,
		});
	}

	return {
		root,
		get: ($ref: string) => $refs.get($ref) as unknown as ParsedJSONSchema,
		referencedSchemas: entries
			.filter(([, entrySchema]) => entrySchema !== root)
			.map(([, entrySchema]) => entrySchema) as ParsedJSONSchema[],
	};
}
