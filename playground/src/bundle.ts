import {
	formatIssue,
	isPlainObject,
	type KeywordPolicy,
	prepareSchema,
	resolveDialect,
} from '@utilize/json-schema';

export interface SchemaFile {
	id: string;
	name: string;
	content: string;
}

export interface Problem {
	fileId?: string;
	severity: 'error' | 'warning';
	message: string;
	line?: number;
	column?: number;
}

export interface ParsedFile {
	file: SchemaFile;
	schema?: unknown;
	problems: Problem[];
}

export interface BundleResult {
	root: unknown;
	rootFileName: string;
	problems: Problem[];
	keyByFile: Map<string, string>;
}

export function parseJsonFile(file: SchemaFile): ParsedFile {
	try {
		return { file, schema: JSON.parse(file.content), problems: [] };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const position = /position (\d+)/.exec(message);
		const lineColumn = /line (\d+) column (\d+)/.exec(message);
		let line: number | undefined;
		let column: number | undefined;

		if (lineColumn) {
			line = Number(lineColumn[1]);
			column = Number(lineColumn[2]);
		} else if (position) {
			const offset = Number(position[1]);
			const before = file.content.slice(0, offset);
			const lines = before.split('\n');
			line = lines.length;
			column = (lines.at(-1)?.length ?? 0) + 1;
		}

		return {
			file,
			problems: [
				{
					fileId: file.id,
					severity: 'error',
					message: `Invalid JSON: ${message}`,
					line,
					column,
				},
			],
		};
	}
}

export function buildBundle(
	parsedFiles: ParsedFile[],
	rootId: string,
	keywordPolicy: KeywordPolicy = 'warn'
): BundleResult {
	const problems = parsedFiles.flatMap((parsed) => parsed.problems);
	const rootParsed = parsedFiles.find((parsed) => parsed.file.id === rootId) ?? parsedFiles[0];

	if (!rootParsed || rootParsed.schema === undefined) {
		return {
			root: null,
			rootFileName: 'schema.json',
			problems,
			keyByFile: new Map(),
		};
	}

	const rootDialect = resolveDialect(rootParsed.schema, {
		unknownDialect: 'fallback',
	}).dialect.id;

	for (const parsed of parsedFiles) {
		if (parsed.schema === undefined) {
			continue;
		}

		// Check a copy for dialect issues and bundle the raw schema: `parse`
		// normalizes the bundle, and normalizing twice would validate keywords
		// that were already rewritten (and mutate the memoized parsed files).
		try {
			prepareSchema(structuredClone(parsed.schema), {
				filePath: parsed.file.name,
				inheritedDialect: parsed === rootParsed ? undefined : rootDialect,
				keywordPolicy,
				onDialectIssue: (issue) => {
					problems.push({
						fileId: parsed.file.id,
						severity: 'warning',
						message: formatIssue(issue),
					});
				},
			});
		} catch (error) {
			problems.push({
				fileId: parsed.file.id,
				severity: 'error',
				message: error instanceof Error ? error.message : String(error),
			});
		}
	}

	const keyByFile = new Map<string, string>();
	const usedKeys = new Set<string>();
	const rootSchema = rootParsed.schema;
	const definitionsKey =
		isPlainObject(rootSchema) && isPlainObject(rootSchema.$defs)
			? '$defs'
			: isPlainObject(rootSchema) && isPlainObject(rootSchema.definitions)
				? 'definitions'
				: '$defs';

	if (isPlainObject(rootParsed.schema)) {
		for (const key of Object.keys(rootParsed.schema.$defs ?? {})) {
			usedKeys.add(key);
		}
		for (const key of Object.keys(rootParsed.schema.definitions ?? {})) {
			usedKeys.add(key);
		}
	}

	for (const parsed of parsedFiles) {
		if (parsed.file.id === rootParsed.file.id || parsed.schema === undefined) {
			continue;
		}

		let key = schemaKey(parsed.file.name);
		let suffix = 2;

		while (usedKeys.has(key)) {
			key = `${schemaKey(parsed.file.name)}_${suffix++}`;
		}

		usedKeys.add(key);
		keyByFile.set(parsed.file.id, key);
	}

	const byName = new Map<string, ParsedFile>();
	const parsedById = new Map(parsedFiles.map((parsed) => [parsed.file.id, parsed]));

	for (const parsed of parsedFiles) {
		const name = normalizeName(parsed.file.name);

		if (byName.has(name)) {
			problems.push({
				fileId: parsed.file.id,
				severity: 'error',
				message: `Duplicate file name "${name}". Rename one of the files.`,
			});
		} else {
			byName.set(name, parsed);
		}
	}
	const rewritten = new Map<string, unknown>();
	const context: RewriteContext = {
		rootId: rootParsed.file.id,
		keyByFile,
		definitionsKey,
		byName,
		parsedById,
		problems,
	};

	for (const parsed of parsedFiles) {
		if (parsed.schema === undefined) {
			continue;
		}

		rewritten.set(parsed.file.id, rewrite(parsed.schema, parsed.file, context));
	}

	let root = rewritten.get(rootParsed.file.id);

	if (isPlainObject(root)) {
		const definitions: Record<string, unknown> = {
			...(root[definitionsKey] as Record<string, unknown> | undefined),
		};

		for (const parsed of parsedFiles) {
			const key = keyByFile.get(parsed.file.id);

			if (key) {
				definitions[key] = rewritten.get(parsed.file.id);
			}
		}

		root = { ...root, [definitionsKey]: definitions };
	} else if (keyByFile.size > 0) {
		problems.push({
			fileId: rootParsed.file.id,
			severity: 'warning',
			message: 'The root schema must be an object to include references to other files.',
		});
	}

	return {
		root,
		rootFileName: rootParsed.file.name,
		problems,
		keyByFile,
	};
}

const ROOT_FILE_NAMES = new Set(['index.json', 'schema.json', 'root.json']);

export function detectRootId(files: SchemaFile[]): string | null {
	if (files.length === 0) {
		return null;
	}

	const schemas = new Map<string, unknown>();

	for (const file of files) {
		try {
			schemas.set(normalizeName(file.name), JSON.parse(file.content));
		} catch {
			// A file without valid JSON cannot declare references.
		}
	}

	const outgoing = new Map<string, number>();
	const referenced = new Set<string>();

	for (const [name, schema] of schemas) {
		const refs = collectRefs(schema);

		outgoing.set(name, refs.length);

		for (const ref of refs) {
			const target = localRefTarget(name, ref);

			if (target) {
				referenced.add(target);
			}
		}
	}

	const unreferenced = files.filter((file) => !referenced.has(normalizeName(file.name)));
	const candidates = unreferenced.length > 0 ? unreferenced : files;

	return candidates
		.map((file) => ({ file, score: rootScore(file, schemas, outgoing) }))
		.toSorted((a, b) => b.score - a.score)[0]!.file.id;
}

function rootScore(
	file: SchemaFile,
	schemas: Map<string, unknown>,
	outgoing: Map<string, number>
): number {
	const name = normalizeName(file.name);
	const schema = schemas.get(name);
	const base = name.split('/').at(-1)?.toLowerCase() ?? '';
	let score = 0;

	if (ROOT_FILE_NAMES.has(base)) {
		score += 100;
	}
	if (!name.includes('/')) {
		score += 20;
	}
	if (isPlainObject(schema) && '$schema' in schema) {
		score += 20;
	}
	if (schema !== undefined) {
		score += 1;
	}

	return score + Math.min(outgoing.get(name) ?? 0, 9);
}

function collectRefs(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value.flatMap(collectRefs);
	}

	if (!isPlainObject(value)) {
		return [];
	}

	const refs = typeof value.$ref === 'string' ? [value.$ref] : [];

	for (const [key, child] of Object.entries(value)) {
		if (key !== '$ref') {
			refs.push(...collectRefs(child));
		}
	}

	return refs;
}

function localRefTarget(name: string, ref: string): string | null {
	if (ref.startsWith('#') || /^(https?:)?\/\//.test(ref)) {
		return null;
	}

	const hashIndex = ref.indexOf('#');
	const path = hashIndex === -1 ? ref : ref.slice(0, hashIndex);

	return path ? resolveRefPath(name, path) : null;
}

interface RewriteContext {
	rootId: string;
	keyByFile: Map<string, string>;
	definitionsKey: '$defs' | 'definitions';
	byName: Map<string, ParsedFile>;
	parsedById: Map<string, ParsedFile>;
	problems: Problem[];
}

const MAP_KEYWORDS = new Set([
	'properties',
	'patternProperties',
	'$defs',
	'definitions',
	'dependentSchemas',
]);
const SINGLE_SCHEMA_KEYWORDS = new Set([
	'additionalProperties',
	'additionalItems',
	'unevaluatedProperties',
	'unevaluatedItems',
	'contentSchema',
	'contains',
	'propertyNames',
	'if',
	'then',
	'else',
	'not',
]);
const ARRAY_SCHEMA_KEYWORDS = new Set(['allOf', 'anyOf', 'oneOf', 'prefixItems']);

function rewrite(value: unknown, file: SchemaFile, context: RewriteContext): unknown {
	if (!isPlainObject(value)) {
		return value;
	}

	const copy: Record<string, unknown> = {};

	for (const [key, child] of Object.entries(value)) {
		if (key === '$ref' && typeof child === 'string') {
			copy[key] = rewriteRef(child, file, context);
		} else if (MAP_KEYWORDS.has(key) && isPlainObject(child)) {
			const map: Record<string, unknown> = {};

			for (const [name, subschema] of Object.entries(child)) {
				map[name] = rewrite(subschema, file, context);
			}
			copy[key] = map;
		} else if (key === 'items' && Array.isArray(child)) {
			copy[key] = child.map((item) => rewrite(item, file, context));
		} else if (SINGLE_SCHEMA_KEYWORDS.has(key) || key === 'items') {
			copy[key] = rewrite(child, file, context);
		} else if (ARRAY_SCHEMA_KEYWORDS.has(key) && Array.isArray(child)) {
			copy[key] = child.map((item) => rewrite(item, file, context));
		} else if (key === 'dependencies' && isPlainObject(child)) {
			const dependencies: Record<string, unknown> = {};

			for (const [name, dependency] of Object.entries(child)) {
				dependencies[name] = Array.isArray(dependency)
					? dependency
					: rewrite(dependency, file, context);
			}
			copy[key] = dependencies;
		} else {
			copy[key] = child;
		}
	}

	return copy;
}

function rewriteRef(ref: string, file: SchemaFile, context: RewriteContext): string {
	if (ref.startsWith('#')) {
		const parsed = context.parsedById.get(file.id);

		if (parsed && !pointerExists(parsed, ref.slice(1))) {
			context.problems.push({
				fileId: file.id,
				severity: 'error',
				message: `Unresolved $ref "${ref}".`,
			});
		}

		if (file.id === context.rootId) {
			return ref;
		}

		const key = context.keyByFile.get(file.id);

		return key ? `#/$defs/${escapePointer(key)}${ref.slice(1)}` : ref;
	}

	// Remote refs are fetched by the parser when the schema is generated.
	if (/^(https?:)?\/\//.test(ref)) {
		return ref;
	}

	const hashIndex = ref.indexOf('#');
	const path = hashIndex === -1 ? ref : ref.slice(0, hashIndex);
	const fragment = hashIndex === -1 ? '' : ref.slice(hashIndex + 1);
	const targetName = resolveRefPath(file.name, path);
	const target = context.byName.get(targetName);

	if (!target || target.schema === undefined) {
		context.problems.push({
			fileId: file.id,
			severity: 'error',
			message: `Unresolved $ref "${ref}": no file named "${targetName}".`,
		});
		return ref;
	}

	if (!pointerExists(target, fragment)) {
		context.problems.push({
			fileId: file.id,
			severity: 'error',
			message: `Unresolved $ref "${ref}": target pointer does not exist.`,
		});
	}

	if (target.file.id === context.rootId) {
		return fragment ? `#${fragment}` : '#';
	}

	const key = context.keyByFile.get(target.file.id);

	if (!key) {
		return ref;
	}

	return `#/${context.definitionsKey}/${escapePointer(key)}${fragment}`;
}

function pointerExists(parsed: ParsedFile, fragment: string): boolean {
	if (fragment === '' || fragment === '/') {
		return true;
	}

	let decoded: string;

	try {
		decoded = decodeURIComponent(fragment);
	} catch {
		return false;
	}

	if (parsed.schema === undefined || !decoded.startsWith('/')) {
		return false;
	}

	let current: unknown = parsed.schema;

	for (const segment of decoded.slice(1).split('/')) {
		const key = segment.replace(/~1/g, '/').replace(/~0/g, '~');

		if (Array.isArray(current)) {
			const index = Number(key);

			if (!Number.isInteger(index) || index < 0 || index >= current.length) {
				return false;
			}
			current = current[index];
		} else if (isPlainObject(current) && key in current) {
			current = current[key];
		} else {
			return false;
		}
	}

	return true;
}

function resolveRefPath(currentName: string, path: string): string {
	try {
		const url = new URL(path, `file:///${currentName}`);
		return normalizeName(decodeURIComponent(url.pathname));
	} catch {
		return normalizeName(path);
	}
}

export function normalizeName(name: string): string {
	return name
		.replace(/\\/g, '/')
		.replace(/^(\.\/)+/, '')
		.replace(/\/+/g, '/')
		.replace(/^\/+/, '')
		.trim();
}

function schemaKey(name: string): string {
	const base =
		normalizeName(name)
			.split('/')
			.at(-1)
			?.replace(/\.json$/i, '')
			.replace(/[^A-Za-z0-9_$-]+/g, '_') || 'file';

	return /^[A-Za-z_$]/.test(base) ? base : `f_${base}`;
}

function escapePointer(key: string): string {
	return key.replace(/~/g, '~0').replace(/\//g, '~1');
}
