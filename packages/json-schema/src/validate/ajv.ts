import Ajv from 'ajv';
import type { ErrorObject } from 'ajv';
import AjvDraft04 from 'ajv-draft-04';
import Ajv2019 from 'ajv/dist/2019.js';
import Ajv2020 from 'ajv/dist/2020.js';
import draft06MetaSchema from 'ajv/dist/refs/json-schema-draft-06.json' with { type: 'json' };

import type { DialectId } from '../dialect';
import { isJSONSchema } from '../model';
import type { JSONSchema } from '../model';
import type { SchemaValidationContext, SchemaValidationFinding } from '../validation';

/** A validator that finishes synchronously, as Ajv does. */
export type SyncSchemaValidator = (
	schema: unknown,
	context: SchemaValidationContext
) => SchemaValidationFinding[];

const ajvOptions = {
	strict: false,
	allErrors: true,
	validateFormats: false,
} as const;

/** Meta-schema each dialect is checked against. The dialect is resolved by the parser. */
const metaSchemas: Record<DialectId, string> = {
	'draft-04': 'http://json-schema.org/draft-04/schema#',
	'draft-06': 'http://json-schema.org/draft-06/schema#',
	'draft-07': 'http://json-schema.org/draft-07/schema#',
	'2019-09': 'https://json-schema.org/draft/2019-09/schema',
	'2020-12': 'https://json-schema.org/draft/2020-12/schema',
};

// One instance per draft, because the meta-schemas and keyword sets differ.
// Ajv caches compiled schemas, so reusing them keeps validation cheap.
const factories: Record<DialectId, () => Ajv> = {
	'draft-04': () => new AjvDraft04(ajvOptions),
	'draft-06': createDraft06,
	'draft-07': () => new Ajv(ajvOptions),
	'2019-09': () => new Ajv2019(ajvOptions),
	'2020-12': () => new Ajv2020(ajvOptions),
};

const instances = new Map<DialectId, Ajv>();

/**
 * Validates a schema document against the meta-schema of the dialect the parser
 * resolved for it. This is the built-in validator behind the CLIs'
 * `--validate` flag; pass another `SchemaValidator` when Ajv is not wanted.
 */
export const ajvValidator: SyncSchemaValidator = (schema, context) => validate(schema, context);

function validate(schema: unknown, context: SchemaValidationContext): SchemaValidationFinding[] {
	if (!isJSONSchema(schema)) {
		return [{ pointer: '', message: 'must be an object or a boolean', keyword: 'type' }];
	}

	const ajv = ajvFor(context.dialect);
	const valid = ajv.validateSchema(withDialectMetaSchema(schema, context.dialect));

	if (valid === true) {
		return [];
	}

	if (valid === false) {
		return findingsOf(ajv.errors ?? []);
	}

	throw new TypeError('The schema validator must finish synchronously.');
}

/** Drops repeated errors and the combinator wrappers that only restate them. */
function findingsOf(errors: ErrorObject[]): SchemaValidationFinding[] {
	const seen = new Set<string>();
	const findings: SchemaValidationFinding[] = [];

	for (const error of errors) {
		if (restatesAnotherError(error, errors)) {
			continue;
		}

		const finding = toFinding(error);
		const key = `${finding.pointer}\u0000${finding.message}\u0000${finding.keyword ?? ''}`;

		if (!seen.has(key)) {
			seen.add(key);
			findings.push(finding);
		}
	}

	return findings;
}

const COMBINATORS = new Set(['allOf', 'anyOf', 'oneOf']);

/**
 * The `anyOf` branch that matches arrays and the branch that matches a single
 * type both fail for a bad `type`, so Ajv reports the wrapper next to the
 * useful leaf errors. Keep the leaves.
 */
function restatesAnotherError(error: ErrorObject, errors: ErrorObject[]): boolean {
	return (
		COMBINATORS.has(error.keyword) &&
		errors.some(
			(other) =>
				other !== error &&
				other.instancePath === error.instancePath &&
				!COMBINATORS.has(other.keyword)
		)
	);
}

/**
 * Points the document at the meta-schema of its resolved dialect. A declared
 * `$schema` can disagree with `--dialect`, and Ajv refuses to validate a
 * document whose `$schema` it does not have loaded, so the resolved dialect
 * wins here just as it does in the generators.
 */
function withDialectMetaSchema(
	schema: JSONSchema | boolean,
	dialect: DialectId
): JSONSchema | boolean {
	if (typeof schema === 'boolean') {
		return schema;
	}

	return { ...schema, $schema: metaSchemas[dialect] };
}

function ajvFor(dialect: DialectId): Ajv {
	const cached = instances.get(dialect);

	if (cached) {
		return cached;
	}

	const created = factories[dialect]();
	instances.set(dialect, created);

	return created;
}

/** Ajv 8 ships the draft-06 meta-schema as data rather than registering it. */
function createDraft06(): Ajv {
	const ajv = new Ajv(ajvOptions);
	ajv.addMetaSchema(draft06MetaSchema);

	return ajv;
}

function toFinding(error: ErrorObject): SchemaValidationFinding {
	return {
		pointer: error.instancePath,
		message: error.message ?? 'is invalid',
		keyword: error.keyword,
	};
}
