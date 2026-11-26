import { $RefParser } from '@apidevtools/json-schema-ref-parser';

import type { DialectIssue, DialectOptions } from './dialect';
import { resolveDialect } from './dialect';
import { indexExternalSchemas, normalizeUri } from './externalSchemas';
import type { ExternalSchemas } from './externalSchemas';
import { createSchemaIndex, schemaChildren } from './identifiers';
import { link } from './linker';
import { isJSONSchema, isJSONSchemaObject, isParsedJSONSchema } from './model';
import type { JSONSchema, ParsedJSONSchema, ParsedJSONSchemaObject } from './model';
import { prepareSchema } from './normalize';
import type { DialectMap } from './normalize';

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
	schema: JSONSchema | boolean,
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
	const rootDialect = resolveDialect(schema, options).dialect.id;
	// Pre-index cloned documents so opaque in-document IDs resolve before $RefParser reads them as paths.
	// Indexing clones each document, so parsing can normalize and link in place
	// without leaving leftovers on the caller's schema.
	const provided = indexExternalSchemas(
		{ ...options.externalSchemas, [cwd]: schema },
		{ ...options, fallbackDialect: rootDialect }
	);
	const input = provided.get(cwd);

	if (input === undefined) {
		throw new Error(`Provided schema is missing its root document: ${cwd}`);
	}

	const providedSchema = (url: string) => provided.get(url) ?? provided.get(normalizeUri(url));

	const $refs = await parser.resolve(cwd, input, {
		resolve: {
			external: true,
			// Provided URIs and identifiers must win over file and HTTP reads.
			provided: {
				order: 1,
				canRead: (file: { url: string }) => providedSchema(file.url) !== undefined,
				// A boolean schema is a valid document, but the resolver type only
				// admits objects, so hand it to the JSON parser as source.
				read: (file: { url: string }) => {
					const providedDocument = providedSchema(file.url);

					if (providedDocument === undefined) {
						throw new Error(`Provided schema not found: ${file.url}`);
					}

					return isJSONSchemaObject(providedDocument) ? providedDocument : String(providedDocument);
				},
			},
		},
	});

	const entries = schemaEntries($refs.values()); // `$RefParser` registers a nested `$id` as its own entry whose value is a node
	// inside another document. Preparing and linking both would normalize that
	// node twice and report its dialect issues twice, so keep the entry that
	// contains the others.
	const documentEntries = outerEntries(entries);

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
	const rootSchema = rootDocument ?? schemaFromRootPointer($refs.get('#'));
	const identifiers = createSchemaIndex();

	// Every document is normalized and indexed before linking, so a `$ref` can
	// resolve to an `$id` declared in a file that is linked later.
	const documents = documentEntries.map(([filePath, entrySchema]) => {
		const isRootSchema = entrySchema === rootSchema;
		const prefixPath = isRootSchema ? '#' : filePath.replace(cwd, '');
		const fileName = isRootSchema ? rootFileName : (filePath.split(/[\\/]/).at(-1) ?? 'Unknown');

		// A referenced file without `$schema` inherits the root's dialect.
		const dialects = isJSONSchemaObject(entrySchema)
			? prepareSchema(entrySchema, {
					dialect: options.dialect,
					fallbackDialect: options.fallbackDialect,
					inheritedDialect: isRootSchema ? undefined : rootDialect,
					unknownDialect: options.unknownDialect,
					keywordPolicy: options.keywordPolicy,
					onDialectIssue,
					filePath: prefixPath,
				})
			: undefined;

		if (isRootSchema && dialects) {
			rootDialects = dialects;
		}

		identifiers.addDocument(filePath, entrySchema, dialects);

		return { entrySchema, prefixPath, fileName, dialects };
	});

	for (const { entrySchema, prefixPath, fileName, dialects } of documents) {
		if (!isJSONSchemaObject(entrySchema)) {
			continue;
		}

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

	const root = linkedRoot(rootSchema, (schema) =>
		link({
			schema,
			parent: null,
			fileName: rootFileName,
			filePath: '#',
			path: [],
			$refs,
			identifiers,
			stack: new Set(),
			dialects: rootDialects,
		})
	);
	const referencedSchemas: ParsedJSONSchema[] = [];

	for (const [, entrySchema] of documentEntries) {
		if (entrySchema !== root && isParsedJSONSchema(entrySchema)) {
			referencedSchemas.push(entrySchema);
		}
	}

	function linkedSchema(value: unknown): ParsedJSONSchema {
		if (isParsedJSONSchema(value)) {
			return value;
		}

		if (isJSONSchemaObject(value)) {
			return link({
				schema: value,
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

		throw new TypeError('The referenced schema has not been linked');
	}

	return {
		root,
		get: ($ref: string) => linkedSchema($refs.get($ref)),
		referencedSchemas,
		issues,
	};
}

function schemaEntries(values: unknown): [SchemaPath, JSONSchema | boolean][] {
	const entries: [SchemaPath, JSONSchema | boolean][] = [];

	if (!isJSONSchemaObject(values)) {
		throw new TypeError('Expected a map of schema documents');
	}

	for (const [filePath, schema] of Object.entries(values)) {
		if (isJSONSchema(schema)) {
			entries.push([filePath, schema]);
		}
	}

	return entries;
}

function linkedRoot(
	rootSchema: JSONSchema | boolean | null,
	linkRoot: (schema: JSONSchema) => ParsedJSONSchemaObject
): ParsedJSONSchema {
	if (isParsedJSONSchema(rootSchema)) {
		return rootSchema;
	}

	if (isJSONSchemaObject(rootSchema)) {
		return linkRoot(rootSchema);
	}

	return rootSchema;
}

function schemaFromRootPointer(value: unknown): JSONSchema | boolean | null {
	if (value === null || isJSONSchema(value)) {
		return value;
	}

	throw new TypeError('The root schema is not a schema');
}

/**
 * Drops `$RefParser` entries that point at a node inside another entry, and
 * duplicate entries for the same document. A nested `$id` is registered as its
 * own URI, but prepare and link already reach the node through its document.
 */
function outerEntries(
	entries: [SchemaPath, JSONSchema | boolean][]
): [SchemaPath, JSONSchema | boolean][] {
	const descendants = new Map<JSONSchema | boolean, Set<unknown>>();

	for (const [, entrySchema] of entries) {
		if (!descendants.has(entrySchema)) {
			const nodes = new Set<unknown>();

			markSchemaNodes(entrySchema, nodes);
			descendants.set(entrySchema, nodes);
		}
	}

	const seen = new Set<JSONSchema | boolean>();

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

	if (!isJSONSchemaObject(node) || nodes.has(node)) {
		return;
	}

	nodes.add(node);

	for (const child of schemaChildren(node)) {
		markSchemaNodes(child, nodes);
	}
}
