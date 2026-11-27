import Ajv from 'ajv';
import type { ErrorObject } from 'ajv';
import Ajv2019 from 'ajv/dist/2019.js';
import Ajv2020 from 'ajv/dist/2020.js';
import draft06MetaSchema from 'ajv/dist/refs/json-schema-draft-06.json' with { type: 'json' };

import type { DialectId } from '../dialect';
import { isJSONSchema } from '../model';
import type { JSONSchema } from '../model';
import type {
	SchemaValidationContext,
	SchemaValidationFinding,
	SchemaValidator,
} from '../validation';

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

const missingDraft04Message =
	'Validating a draft-04 document needs the optional "ajv-draft-04" package, because Ajv 8 dropped draft-04. Install it, or pass another validator.';

// One instance per draft, because the meta-schemas and keyword sets differ.
// Ajv caches compiled schemas, so reusing them keeps validation cheap. The
// promise is cached too, so the lazy `ajv-draft-04` import runs once.
const instances = new Map<DialectId, Promise<Ajv>>();

/**
 * Validates a schema document against the meta-schema of the dialect the parser
 * resolved for it. This is the built-in validator behind the CLIs'
 * `--validate` flag; pass another `SchemaValidator` when Ajv is not wanted.
 */
export const ajvValidator: SchemaValidator = validate;

async function validate(
	schema: unknown,
	context: SchemaValidationContext
): Promise<SchemaValidationFinding[]> {
	if (!isJSONSchema(schema)) {
		return [{ pointer: '', message: 'must be an object or a boolean', keyword: 'type' }];
	}

	// Every dialect from draft-06 on allows a boolean document. Draft-04 defines
	// a schema as an object only, so a boolean root has no meta-schema to pass.
	if (typeof schema === 'boolean') {
		return context.dialect === 'draft-04'
			? [{ pointer: '', message: 'must be object', keyword: 'type' }]
			: [];
	}

	const ajv = await ajvFor(context.dialect);
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

async function ajvFor(dialect: DialectId): Promise<Ajv> {
	const cached = instances.get(dialect);

	if (cached) {
		return cached;
	}

	const created = createAjv(dialect);
	instances.set(dialect, created);

	try {
		return await created;
	} catch (error) {
		// A missing optional package should not poison the next attempt.
		instances.delete(dialect);
		throw error;
	}
}

async function createAjv(dialect: DialectId): Promise<Ajv> {
	switch (dialect) {
		case 'draft-04':
			return createDraft04();
		case 'draft-06':
			return createDraft06();
		case 'draft-07':
			return new Ajv(ajvOptions);
		case '2019-09':
			return new Ajv2019(ajvOptions);
		case '2020-12':
			return new Ajv2020(ajvOptions);
	}
}

/**
 * Draft-04 is the only dialect that needs an extra package: Ajv 8 removed it,
 * so the companion `ajv-draft-04` supplies its vocabulary and meta-schema. It
 * is imported only when a draft-04 document is validated, so every other
 * dialect works with `ajv` alone.
 */
async function createDraft04(): Promise<Ajv> {
	try {
		const { default: AjvDraft04 } = await import('ajv-draft-04');

		return new AjvDraft04(ajvOptions);
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		throw new Error(`${missingDraft04Message}\n${reason}`, { cause: error });
	}
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
