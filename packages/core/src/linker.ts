import { logger, LogLevel, safeStringify } from './logger';
import type {
	JSONSchema,
	JSONSchemaType,
	LinkedJSONSchema,
} from './types/JSONSchema';
import { Parent, Reference } from './types/JSONSchema';
import { assert, isPlainObject } from './utils';

const log = logger.withNamespace('linker');
logger.setNamespaceLevels('linker', [
	// LogLevel.DEBUG,
	LogLevel.INFO,
	LogLevel.WARN,
	LogLevel.ERROR,
]);

let callId = 0;

/**
 * Traverses over the schema, giving each node a reference to its
 * parent node. We need this for downstream operations.
 */
export function link(
	schema: JSONSchemaType | JSONSchema,
	parent: JSONSchemaType | JSONSchema | null = null,
	root = schema
): LinkedJSONSchema {
	callId++;
	log.accumulate(schema, `Call #${callId}`);

	try {
		if (!Array.isArray(schema) && !isPlainObject(schema)) {
			log.accumulate(
				schema,
				`Skipping non-object schema: ${safeStringify(schema)}`
			);
			return schema as LinkedJSONSchema;
		}
		/**
		 * Special handling for referenced schemas:
		 *
		 * When a schema node is a reference wrapper (i.e., an object with a $ref and possibly additional fields like "default"),
		 * its [Parent] is set according to its actual position in the schema tree.
		 *
		 * However, the referenced schema itself (schema[Reference]) is not a true child of the reference wrapper.
		 * It may be reused in multiple places and must not participate in the local parent-child tree structure,
		 * as this would create cycles or misleading ancestry.
		 *
		 * Therefore, for all referenced schemas, we set their [Parent] to the root schema.
		 * This makes it clear that referenced schemas are "global definitions" and not true children of any particular usage site.
		 * This approach avoids cycles, enables correct standalone schema naming, and preserves the logical structure of the schema tree.
		 */
		if (Object.hasOwnProperty.call(schema as JSONSchema, Reference)) {
			log.accumulate(schema, 'Linking referenced schema');
			const referenceSchema = (schema as JSONSchema)[Reference];
			assert(referenceSchema, 'Reference schema must be defined');
			link(referenceSchema, root, root);
		}

		// Handle cycles
		if (Object.prototype.hasOwnProperty.call(schema as JSONSchema, Parent)) {
			log.accumulate(schema, `Schema already linked: ${safeStringify(schema)}`);
			return schema as LinkedJSONSchema;
		}

		// Add a reference to this schema's parent
		Object.defineProperty(schema, Parent, {
			enumerable: false,
			value: parent,
			writable: false,
		});

		// Arrays
		if (Array.isArray(schema)) {
			log.accumulate(schema, `Linking array schema: ${safeStringify(schema)}`);
			schema.forEach((child) => link(child, schema, root));
		}

		// Objects
		for (const value of Object.values(schema as JSONSchema)) {
			log.accumulate(
				schema,
				`Linking object schema value: ${safeStringify(value)}`
			);
			link(value, schema, root);
		}

		return schema as LinkedJSONSchema;
	} catch (error) {
		log.accumulate(schema, 'Error', error);
		throw new Error('Linker failed');
	} finally {
		const logs = log.flush(schema);
		if (logs && logs?.length > 0) {
			log.debug(...logs);
		}
	}
}
