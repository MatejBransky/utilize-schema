import { detectSchemaVersion, isPlainObject, normalizeSchema } from '@utilize/json-schema';

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

export function buildBundle(parsedFiles: ParsedFile[], rootId: string): BundleResult {
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

	const rootVersion = detectSchemaVersion(rootParsed.schema);

	for (const parsed of parsedFiles) {
		if (parsed.schema === undefined) {
			continue;
		}

		try {
			normalizeSchema(parsed.schema, detectSchemaVersion(parsed.schema, rootVersion));
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

	const byName = new Map(parsedFiles.map((parsed) => [normalizeName(parsed.file.name), parsed]));
	const parsedById = new Map(parsedFiles.map((parsed) => [parsed.file.id, parsed]));
	const rewritten = new Map<string, unknown>();
	const context: RewriteContext = {
		rootId: rootParsed.file.id,
		keyByFile,
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
			...(root.$defs as Record<string, unknown> | undefined),
		};

		for (const parsed of parsedFiles) {
			const key = keyByFile.get(parsed.file.id);

			if (key) {
				definitions[key] = rewritten.get(parsed.file.id);
			}
		}

		root = { ...root, $defs: definitions };
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

interface RewriteContext {
	rootId: string;
	keyByFile: Map<string, string>;
	byName: Map<string, ParsedFile>;
	parsedById: Map<string, ParsedFile>;
	problems: Problem[];
}

function rewrite(value: unknown, file: SchemaFile, context: RewriteContext): unknown {
	if (Array.isArray(value)) {
		return value.map((item) => rewrite(item, file, context));
	}

	if (!isPlainObject(value)) {
		return value;
	}

	const copy: Record<string, unknown> = {};

	for (const [key, child] of Object.entries(value)) {
		copy[key] = rewrite(child, file, context);
	}

	if (typeof value.$ref === 'string') {
		copy.$ref = rewriteRef(value.$ref, file, context);
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

	return `#/$defs/${escapePointer(key)}${fragment}`;
}

function pointerExists(parsed: ParsedFile, fragment: string): boolean {
	if (fragment === '' || fragment === '/') {
		return true;
	}

	if (parsed.schema === undefined || !fragment.startsWith('/')) {
		return false;
	}

	let current: unknown = parsed.schema;

	for (const segment of fragment.slice(1).split('/')) {
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
