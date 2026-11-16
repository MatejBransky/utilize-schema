import { isPlainObject } from '@utilize/json-schema';
import Ajv from 'ajv';
import AjvDraft04 from 'ajv-draft-04';
import Ajv2019 from 'ajv/dist/2019';
import Ajv2020 from 'ajv/dist/2020';

import type { ParsedFile, Problem } from './bundle';

let draft04: AjvDraft04 | undefined;
let draft7: Ajv | undefined;
let draft2019: Ajv | undefined;
let draft2020: Ajv | undefined;

export function validateSchemas(parsedFiles: ParsedFile[]): Problem[] {
	const problems: Problem[] = [];

	for (const parsed of parsedFiles) {
		if (parsed.schema === undefined) {
			continue;
		}

		const schema = parsed.schema;

		if (!isPlainObject(schema) && typeof schema !== 'boolean') {
			problems.push({
				fileId: parsed.file.id,
				severity: 'error',
				message: 'A JSON Schema must be an object or a boolean.',
			});
			continue;
		}

		const ajv = getAjv(schema);

		try {
			const valid = ajv.validateSchema(schema);

			if (!valid) {
				for (const error of ajv.errors ?? []) {
					problems.push({
						fileId: parsed.file.id,
						severity: 'error',
						message: `${error.instancePath || '(root)'} ${error.message ?? 'is invalid'}`,
					});
				}
			}
		} catch (error) {
			const fallback = validateWithoutSchemaUri(schema);

			if (!fallback) {
				problems.push({
					fileId: parsed.file.id,
					severity: 'error',
					message: `Could not validate against $schema: ${
						error instanceof Error ? error.message : String(error)
					}`,
				});
			}
		}
	}

	return problems;
}

function validateWithoutSchemaUri(schema: unknown): boolean {
	try {
		if (!isPlainObject(schema)) {
			return true;
		}

		const clone = { ...schema };
		delete clone.$schema;

		return getDraft7().validateSchema(clone) === true;
	} catch {
		return false;
	}
}

function getAjv(schema: unknown): Ajv {
	const uri = isPlainObject(schema) && typeof schema.$schema === 'string' ? schema.$schema : '';

	if (/draft-04/.test(uri)) {
		draft04 ??= new AjvDraft04({
			strict: false,
			allErrors: true,
			validateFormats: false,
		});
		return draft04 as unknown as Ajv;
	}

	if (/2020-12/.test(uri)) {
		draft2020 ??= new Ajv2020({
			strict: false,
			allErrors: true,
			validateFormats: false,
		});
		return draft2020;
	}

	if (/2019-09/.test(uri)) {
		draft2019 ??= new Ajv2019({
			strict: false,
			allErrors: true,
			validateFormats: false,
		});
		return draft2019;
	}

	return getDraft7();
}

function getDraft7(): Ajv {
	draft7 ??= new Ajv({
		strict: false,
		allErrors: true,
		validateFormats: false,
	});

	return draft7;
}
