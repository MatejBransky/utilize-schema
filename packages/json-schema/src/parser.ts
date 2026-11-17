import { $RefParser } from '@apidevtools/json-schema-ref-parser';

import { link } from './linker';
import { Meta, type JSONSchema, type ParsedJSONSchema } from './model';
import { detectSchemaVersion, normalizeSchema } from './normalize';

type SchemaPath = string;

interface ParseOptions {
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
	const $refs = await parser.resolve(cwd, schema, {});

	const entries = Object.entries($refs.values()) as Array<[SchemaPath, JSONSchema]>;

	const rootVersion = detectSchemaVersion(schema);

	entries.forEach(([filePath, entrySchema]) => {
		normalizeSchema(entrySchema, detectSchemaVersion(entrySchema, rootVersion));

		const rootSchema = $refs.get('#');
		const isRootSchema = entrySchema === rootSchema;
		const prefixPath = isRootSchema ? '#' : filePath.replace(cwd, '');
		const fileName = isRootSchema ? rootFileName : (filePath.split(/[\\/]/).at(-1) ?? 'Unknown');
		link({
			schema: entrySchema,
			parent: null,
			fileName,
			filePath: prefixPath,
			path: [],
			$refs,
			stack: new Set(),
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
