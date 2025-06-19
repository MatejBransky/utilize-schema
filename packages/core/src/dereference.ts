import {
	$RefParser,
	type ParserOptions as $RefOptions,
} from '@apidevtools/json-schema-ref-parser';
import type { JSONSchemaObject } from '@apidevtools/json-schema-ref-parser/dist/lib/types';

import { logger, LogLevel, safeStringify } from './logger';
import { Reference, type JSONSchema } from './types/JSONSchema';
import {
	assert,
	generateName,
	getDefinitions,
	justName,
	omitFields,
	toSafeString,
} from './utils';

const log = logger.withNamespace('dereference');
logger.setNamespaceLevels('dereference', [
	LogLevel.DEBUG,
	LogLevel.INFO,
	LogLevel.WARN,
	LogLevel.ERROR,
]);

export type DereferenceTrace = WeakMap<
	JSONSchema,
	{ ref: string; refSchema: JSONSchema; name?: string }
>;

export interface DereferenceOptions {
	/** The current working directory where the schema is located. */
	cwd: string;
	/** Options for the $RefParser */
	$refOptions: $RefOptions;
}

/**
 * Dereferences all $ref pointers in a JSON Schema using json-schema-ref-parser.
 * Tracks the original reference paths for each dereferenced schema node.
 *
 * @returns An object containing:
 *   - dereferencedPaths: A WeakMap mapping dereferenced schema nodes to their original $ref paths.
 *   - dereferencedSchema: The fully dereferenced schema.
 */
export async function dereference(
	schema: JSONSchema,
	{ cwd, $refOptions }: DereferenceOptions
) {
	const parser = new $RefParser();
	const dereferenceTrace: DereferenceTrace = new WeakMap();
	const buffer = new Set<{
		$ref: string;
		referencedSubschema: JSONSchema;
		referencingSubSchema: JSONSchema;
	}>();
	const dereferencedSchema = (await parser.dereference(cwd, schema, {
		...$refOptions,
		dereference: {
			...$refOptions.dereference,
			onDereference(
				$ref: string,
				dereferencedSubschema: JSONSchema,
				parent: JSONSchemaObject,
				parentPropName: string
			) {
				const referencedSubschema = parser.$refs.get($ref, {}) as JSONSchema;

				assert(
					referencedSubschema,
					`Referenced schema for $ref "${$ref}" not found.`
				);

				const extraFields = omitFields(
					dereferencedSubschema,
					referencedSubschema
				) as JSONSchemaObject;

				parent[parentPropName] = extraFields;

				log.debug(
					'Dereferencing - equal',
					$ref
					// 'extraFields',
					// safeStringify(extraFields),
					// 'equal',
					// dereferencedSubschema === referencedSubschema,
					// 'referencedSubschema',
					// safeStringify(referencedSubschema),
					// 'dereferencedSubschema',
					// safeStringify(dereferencedSubschema),
					// 'parent',
					// safeStringify(parent),
					// 'parentPropName',
					// parentPropName
				);

				Object.defineProperty(extraFields, Reference, {
					enumerable: false,
					value: { schema: referencedSubschema, ref: $ref },
					writable: false,
				});

				buffer.add({
					$ref,
					referencedSubschema,
					referencingSubSchema: extraFields,
				});

				dereferenceTrace.set(extraFields, {
					ref: $ref,
					refSchema: referencedSubschema,
				});
			},
		},
	})) as JSONSchema;

	const definitions = getDefinitions({ schema: dereferencedSchema });
	log.debug('Definitions:', safeStringify(definitions));

	const usedNames = new Set(Object.keys(definitions));
	log.debug('Used names:', usedNames);

	buffer.forEach(({ referencedSubschema, $ref, referencingSubSchema }) => {
		const localName = toSafeString(justName($ref));
		let uniqueName = generateName(localName, usedNames);

		let defs = dereferencedSchema.definitions ?? dereferencedSchema.$defs;
		if (!defs) {
			dereferencedSchema.definitions = {};
			defs = dereferencedSchema.definitions;
		}

		// If the referenced schema is not in the definitions,
		// add it with a unique name.
		if (defs[localName] !== referencedSubschema) {
			if (definitions[$ref] || definitions[justName($ref)]) {
				log.debug(
					`Schema with $ref "${$ref}" is already defined in definitions.`
				);
			} else {
				log.debug(`Adding $ref "${$ref}" to definitions.`);
				defs[uniqueName] = referencedSubschema;
				dereferenceTrace.get(referencingSubSchema)!.name = uniqueName;
			}
		} else {
			uniqueName = localName;
		}
	});

	log.debug(
		'Final Definitions',
		getDefinitions({ schema: dereferencedSchema })
	);

	return { dereferenceTrace, dereferencedSchema };
}
