import { $RefParser } from '@apidevtools/json-schema-ref-parser';

import type { DialectIssue, DialectOptions } from './dialect';
import { resolveDialect } from './dialect';
import { type ExternalSchemas, indexExternalSchemas, normalizeUri } from './externalSchemas';
import { createSchemaIndex, schemaChildren } from './identifiers';
import { link } from './linker';
import { Meta, type JSONSchema, type ParsedJSONSchema } from './model';
import { type DialectMap, prepareSchema } from './normalize';

type SchemaPath = string;

export interface ParseOptions extends DialectOptions {
	cwd: string;
	fileName: string;
	/**
	 * Documents served for absolute `$ref` URIs, keyed by retrieval URI. A URI
	 * present here is never read from disk or the network. Identifiers declared
	 * inside a document (`$id`, or the draft-04 `id`) are served too.
	 */
	externalSchemas?: ExternalSchemas;
}

export async function parse(
	schema: JSONSchema,
	options: ParseOptions
): Promise<{
	root: ParsedJSONSchema;
	get: ($ref: string) => ParsedJSONSchema;
	referencedSchemas: ParsedJSONSchema[];
	/** Dialect issues reported with `keywordPolicy: 'warn'`. */
	issues: DialectIssue[];
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

	const provided = options.externalSchemas
		? indexExternalSchemas(options.externalSchemas)
		: undefined;
	const providedSchema = (url: string) => provided?.get(url) ?? provided?.get(normalizeUri(url));

	const $refs = await parser.resolve(
		cwd,
		input,
		provided
			? {
					resolve: {
						external: true,
						// Runs before the built-in file and HTTP resolvers, so a provided
						// URI is served from memory instead of being fetched.
						provided: {
							order: 1,
							canRead: (file: { url: string }) => providedSchema(file.url) !== undefined,
							// A boolean schema is a valid document, but the resolver type
							// only admits objects.
							read: (file: { url: string }) => providedSchema(file.url) as JSONSchema,
						},
					},
				}
			: {}
	);

	const entries = Object.entries($refs.values()) as Array<[SchemaPath, JSONSchema]>;
	// `$RefParser` registers a nested `$id` as its own entry whose value is a node
	// inside another document. Preparing and linking both would normalize that
	// node twice and report its dialect issues twice, so keep the entry that
	// contains the others.
	const documentEntries = outerEntries(entries);

	const rootDialect = resolveDialect(schema, options).dialect.id;

	let rootDialects: DialectMap | undefined;
	const issues: DialectIssue[] = [];
	const onDialectIssue = (issue: DialectIssue) => {
		issues.push(issue);
		options.onDialectIssue?.(issue);
	};

	// Keep the document root even when it is a `$ref`: `$refs.get('#')` resolves
	// a root pointer and would return its target, which loses the root node and
	// its metadata. The root document is the object handed to `resolve`.
	const rootDocument = entries.find(([, value]) => value === input)?.[1];
	const rootSchema = rootDocument ?? ($refs.get('#') as JSONSchema);
	const identifiers = createSchemaIndex();

	// Every document is normalized and indexed before linking, so a `$ref` can
	// resolve to an `$id` declared in a file that is linked later.
	const documents = documentEntries.map(([filePath, entrySchema]) => {
		const isRootSchema = entrySchema === rootSchema;
		const prefixPath = isRootSchema ? '#' : filePath.replace(cwd, '');
		const fileName = isRootSchema ? rootFileName : (filePath.split(/[\\/]/).at(-1) ?? 'Unknown');

		// A referenced file without `$schema` inherits the root's dialect.
		const dialects = prepareSchema(entrySchema, {
			dialect: options.dialect,
			fallbackDialect: options.fallbackDialect,
			inheritedDialect: isRootSchema ? undefined : rootDialect,
			unknownDialect: options.unknownDialect,
			keywordPolicy: options.keywordPolicy,
			onDialectIssue,
			filePath: prefixPath,
		});

		if (isRootSchema) {
			rootDialects = dialects;
		}

		identifiers.addDocument(filePath, entrySchema, dialects);

		return { entrySchema, prefixPath, fileName, dialects };
	});

	for (const { entrySchema, prefixPath, fileName, dialects } of documents) {
		link({
			schema: entrySchema,
			parent: null,
			fileName,
			filePath: prefixPath,
			path: [],
			$refs,
			identifiers,
			stack: new Set(),
			dialects,
		});
	}

	const root = rootSchema as unknown as ParsedJSONSchema;

	if (typeof root === 'object' && root !== null && !Object.hasOwnProperty.call(root, Meta)) {
		link({
			schema: root,
			parent: null,
			fileName: rootFileName,
			filePath: '#',
			path: [],
			$refs,
			identifiers,
			stack: new Set(),
			dialects: rootDialects,
		});
	}

	return {
		root,
		get: ($ref: string) => $refs.get($ref) as unknown as ParsedJSONSchema,
		referencedSchemas: documentEntries
			.filter(([, entrySchema]) => entrySchema !== root)
			.map(([, entrySchema]) => entrySchema) as ParsedJSONSchema[],
		issues,
	};
}

/**
 * Drops `$RefParser` entries that point at a node inside another entry, and
 * duplicate entries for the same document. A nested `$id` is registered as its
 * own URI, but prepare and link already reach the node through its document.
 */
function outerEntries(entries: Array<[SchemaPath, JSONSchema]>): Array<[SchemaPath, JSONSchema]> {
	const descendants = new Map<JSONSchema, Set<unknown>>();

	for (const [, entrySchema] of entries) {
		if (!descendants.has(entrySchema)) {
			const nodes = new Set<unknown>();

			markSchemaNodes(entrySchema, nodes);
			descendants.set(entrySchema, nodes);
		}
	}

	const seen = new Set<JSONSchema>();

	return entries.filter(([, entrySchema]) => {
		if (seen.has(entrySchema)) {
			return false;
		}

		seen.add(entrySchema);

		return !entries.some(
			([, other]) => other !== entrySchema && descendants.get(other)?.has(entrySchema) === true
		);
	});
}

/** Collects a schema node and every schema-bearing node below it. */
function markSchemaNodes(node: unknown, nodes: Set<unknown>): void {
	if (Array.isArray(node)) {
		for (const item of node) {
			markSchemaNodes(item, nodes);
		}

		return;
	}

	if (typeof node !== 'object' || node === null || nodes.has(node)) {
		return;
	}

	nodes.add(node);

	for (const child of schemaChildren(node as Record<string, unknown>)) {
		markSchemaNodes(child, nodes);
	}
}
