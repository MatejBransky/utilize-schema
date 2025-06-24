import { $RefParser } from '@apidevtools/json-schema-ref-parser';

import { link } from './linker';
import { type JSONSchema, type ParsedJSONSchema } from './model';

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

	const entries = Object.entries($refs.values()) as Array<
		[SchemaPath, JSONSchema]
	>;

	entries.forEach(([filePath, schema]) => {
		const rootSchema = $refs.get('#');
		const isRootSchema = schema === rootSchema;
		const prefixPath = isRootSchema ? '#' : filePath.replace(cwd, '');
		const fileName = isRootSchema
			? rootFileName
			: (filePath.split(/[\\/]/).at(-1) ?? 'Unknown');
		link({
			schema,
			parent: null,
			fileName,
			filePath: prefixPath,
			path: [],
			$refs,
			stack: new Set(),
		});
	});
	console.log(
		`Parsed ${entries.length} schemas from ${rootFileName} at ${cwd}`
	);
	const root = $refs.get('#') as unknown as ParsedJSONSchema;

	return {
		root,
		get: ($ref: string) => $refs.get($ref) as unknown as ParsedJSONSchema,
		referencedSchemas: entries
			.filter(([, schema]) => schema !== root)
			.map(([, schema]) => schema) as ParsedJSONSchema[],
	};
}
