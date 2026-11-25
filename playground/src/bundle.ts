import {
	formatIssue,
	isPlainObject,
	prepareSchema,
	resolveDialect,
	SCHEMA_ARRAY_KEYWORDS,
	SCHEMA_MAP_KEYWORDS,
	SINGLE_SCHEMA_KEYWORDS,
} from '@utilize/json-schema';
import type { DialectId, JSONSchema, KeywordPolicy } from '@utilize/json-schema';

/** A JSON value before schema parsing; the bundler rewrites it without validating it. */
type UnparsedJson =
	| null
	| boolean
	| number
	| string
	| UnparsedJson[]
	| { [key: string]: UnparsedJson };

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
	root: JSONSchema | boolean | null;
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

	validateParsedSchemas(parsedFiles, rootParsed, rootDialect, keywordPolicy, problems);

	const { keyByFile, definitionsKey } = allocateDefinitionKeys(rootParsed, parsedFiles);
	const byName = indexFilesByName(parsedFiles, problems);
	const rewritten = new Map<string, UnparsedJson>();
	const context: RewriteContext = {
		rootId: rootParsed.file.id,
		keyByFile,
		definitionsKey,
		byName,
		parsedById: new Map(parsedFiles.map((parsed) => [parsed.file.id, parsed])),
		problems,
	};

	for (const parsed of parsedFiles) {
		if (parsed.schema !== undefined) {
			rewritten.set(parsed.file.id, rewrite(parsed.schema, parsed.file, context));
		}
	}

	const rootValue = attachDefinitions({
		root: rewritten.get(rootParsed.file.id),
		parsedFiles,
		rewritten,
		keyByFile,
		definitionsKey,
		rootFileId: rootParsed.file.id,
		problems,
	});

	const root =
		typeof rootValue === 'boolean' || isPlainObject(rootValue)
			? (rootValue as JSONSchema | boolean)
			: null;

	return {
		root,
		rootFileName: rootParsed.file.name,
		problems,
		keyByFile,
	};
}

function validateParsedSchemas(
	parsedFiles: ParsedFile[],
	rootParsed: ParsedFile,
	rootDialect: DialectId,
	keywordPolicy: KeywordPolicy,
	problems: Problem[]
): void {
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
}

function definitionsKeyFor(schema: unknown): '$defs' | 'definitions' {
	if (!isPlainObject(schema)) {
		return '$defs';
	}

	if (isPlainObject(schema.$defs)) {
		return '$defs';
	}

	return isPlainObject(schema.definitions) ? 'definitions' : '$defs';
}

interface DefinitionKeys {
	keyByFile: Map<string, string>;
	definitionsKey: '$defs' | 'definitions';
}

function allocateDefinitionKeys(rootParsed: ParsedFile, parsedFiles: ParsedFile[]): DefinitionKeys {
	const keyByFile = new Map<string, string>();
	const usedKeys = new Set<string>();
	const definitionsKey = definitionsKeyFor(rootParsed.schema);

	collectUsedDefinitionKeys(rootParsed.schema, usedKeys);

	for (const parsed of parsedFiles) {
		if (parsed.file.id === rootParsed.file.id || parsed.schema === undefined) {
			continue;
		}

		const baseKey = schemaKey(parsed.file.name);
		let key = baseKey;
		let suffix = 2;

		while (usedKeys.has(key)) {
			key = `${baseKey}_${suffix++}`;
		}

		usedKeys.add(key);
		keyByFile.set(parsed.file.id, key);
	}

	return { keyByFile, definitionsKey };
}

function collectUsedDefinitionKeys(schema: unknown, usedKeys: Set<string>): void {
	if (!isPlainObject(schema)) {
		return;
	}

	for (const key of Object.keys(schema.$defs ?? {})) {
		usedKeys.add(key);
	}
	for (const key of Object.keys(schema.definitions ?? {})) {
		usedKeys.add(key);
	}
}

function indexFilesByName(parsedFiles: ParsedFile[], problems: Problem[]): Map<string, ParsedFile> {
	const byName = new Map<string, ParsedFile>();

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

	return byName;
}

interface DefinitionAssembly {
	root: unknown;
	parsedFiles: ParsedFile[];
	rewritten: Map<string, UnparsedJson>;
	keyByFile: Map<string, string>;
	definitionsKey: '$defs' | 'definitions';
	rootFileId: string;
	problems: Problem[];
}

function attachDefinitions({
	root,
	parsedFiles,
	rewritten,
	keyByFile,
	definitionsKey,
	rootFileId,
	problems,
}: DefinitionAssembly): UnparsedJson {
	if (!isPlainObject(root)) {
		if (keyByFile.size > 0) {
			problems.push({
				fileId: rootFileId,
				severity: 'warning',
				message: 'The root schema must be an object to include references to other files.',
			});
		}

		return root as UnparsedJson;
	}

	const definitions = new Map<string, UnparsedJson>();
	const existing = root[definitionsKey];

	if (isPlainObject(existing)) {
		for (const [name, value] of Object.entries(existing)) {
			definitions.set(name, value as UnparsedJson);
		}
	}

	for (const parsed of parsedFiles) {
		const key = keyByFile.get(parsed.file.id);

		const value = key ? rewritten.get(parsed.file.id) : undefined;

		if (key && value !== undefined) {
			definitions.set(key, value);
		}
	}

	return { ...root, [definitionsKey]: Object.fromEntries(definitions) } as UnparsedJson;
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
		.toSorted((a, b) => b.score - a.score)[0].file.id;
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

function rewrite(value: unknown, file: SchemaFile, context: RewriteContext): UnparsedJson {
	if (!isPlainObject(value)) {
		return value as UnparsedJson;
	}

	const copy: Record<string, UnparsedJson> = {};

	for (const [key, child] of Object.entries(value)) {
		copy[key] = rewriteProperty(key, child, file, context);
	}

	return copy;
}

function rewriteProperty(
	key: string,
	child: unknown,
	file: SchemaFile,
	context: RewriteContext
): UnparsedJson {
	if (key === '$ref') {
		return rewriteRef(child, file, context);
	}

	if (SCHEMA_MAP_KEYWORDS.has(key)) {
		return rewriteMap(child, file, context);
	}

	if (key === 'items') {
		return rewriteItems(child, file, context);
	}

	if (SINGLE_SCHEMA_KEYWORDS.has(key)) {
		return rewrite(child, file, context);
	}

	if (SCHEMA_ARRAY_KEYWORDS.has(key)) {
		return rewriteArray(child, file, context);
	}

	if (key === 'dependencies') {
		return rewriteDependencies(child, file, context);
	}

	return child as UnparsedJson;
}

function rewriteItems(child: unknown, file: SchemaFile, context: RewriteContext): UnparsedJson {
	return Array.isArray(child) ? rewriteArray(child, file, context) : rewrite(child, file, context);
}

function rewriteMap(value: unknown, file: SchemaFile, context: RewriteContext): UnparsedJson {
	if (!isPlainObject(value)) {
		return value as UnparsedJson;
	}

	const map: Record<string, UnparsedJson> = {};

	for (const [name, subschema] of Object.entries(value)) {
		map[name] = rewrite(subschema, file, context);
	}

	return map;
}

function rewriteArray(value: unknown, file: SchemaFile, context: RewriteContext): UnparsedJson {
	if (!Array.isArray(value)) {
		return value as UnparsedJson;
	}

	return value.map((item) => rewrite(item, file, context)) as UnparsedJson;
}

function rewriteDependencies(
	value: unknown,
	file: SchemaFile,
	context: RewriteContext
): UnparsedJson {
	if (!isPlainObject(value)) {
		return value as UnparsedJson;
	}

	const dependencies: Record<string, UnparsedJson> = {};

	for (const [name, dependency] of Object.entries(value)) {
		dependencies[name] = Array.isArray(dependency)
			? dependency
			: rewrite(dependency, file, context);
	}

	return dependencies;
}

function rewriteRef(ref: unknown, file: SchemaFile, context: RewriteContext): UnparsedJson {
	if (typeof ref !== 'string') {
		return ref as UnparsedJson;
	}

	if (ref.startsWith('#')) {
		return rewriteLocalRef(ref, file, context);
	}

	// Remote refs are fetched by the parser when the schema is generated.
	if (/^(https?:)?\/\//.test(ref)) {
		return ref;
	}

	return rewriteExternalRef(ref, file, context);
}

function rewriteLocalRef(ref: string, file: SchemaFile, context: RewriteContext): string {
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

function rewriteExternalRef(ref: string, file: SchemaFile, context: RewriteContext): string {
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

	const decoded = decodeFragment(fragment);

	if (decoded === null || parsed.schema === undefined) {
		return false;
	}

	// A fragment that does not start with `/` is an identifier (`$id` or
	// `$anchor`), not a JSON pointer. The parser validates it after bundling.
	return !decoded.startsWith('/') || pointerTargetExists(parsed.schema, decoded);
}

function decodeFragment(fragment: string): string | null {
	try {
		return decodeURIComponent(fragment);
	} catch {
		return null;
	}
}

function pointerTargetExists(root: unknown, pointer: string): boolean {
	let current: unknown = root;

	for (const segment of pointer.slice(1).split('/')) {
		const key = segment.replaceAll('~1', '/').replaceAll('~0', '~');

		if (Array.isArray(current)) {
			const index = pointerArrayIndex(current, key);

			if (index === null) {
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

function pointerArrayIndex(values: unknown[], key: string): number | null {
	const index = Number(key);

	return Number.isInteger(index) && index >= 0 && index < values.length ? index : null;
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
		.replaceAll('\\', '/')
		.replace(/^(\.\/)+/, '')
		.replaceAll(/\/+/g, '/')
		.replace(/^\/+/, '')
		.trim();
}

function schemaKey(name: string): string {
	const base =
		normalizeName(name)
			.split('/')
			.at(-1)
			?.replace(/\.json$/i, '')
			.replaceAll(/[^A-Za-z0-9_$-]+/g, '_') || 'file';

	return /^[A-Za-z_$]/.test(base) ? base : `f_${base}`;
}

function escapePointer(key: string): string {
	return key.replaceAll('~', '~0').replaceAll('/', '~1');
}
