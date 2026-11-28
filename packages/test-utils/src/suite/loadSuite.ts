import { isJSONSchema, isPlainObject } from '@utilize/json-schema';
import type { JSONSchema } from '@utilize/json-schema';

import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

export interface SuiteTest {
	description: string;
	data: unknown;
	valid: boolean;
}

export interface SuiteCase {
	description: string;
	schema: JSONSchema | boolean;
	tests: SuiteTest[];
	/** Dialects this case applies to, see `validation/README.md` in the suite. */
	compatibility?: string;
	/** Behavior the case needs, e.g. whether `format` must assert or only annotate. */
	tags?: string[];
	/** Schemas that must be available at their retrieval URI before validating. */
	externalSchemas?: Record<string, JSONSchema | boolean>;
}

export interface SuiteFile {
	name: string;
	description: string;
	cases: SuiteCase[];
}

const require = createRequire(import.meta.url);

/** The `validation/tests` directory of the installed JSON Schema Test Suite. */
export const suiteDirectory = join(
	dirname(require.resolve('json-schema-test-suite/package.json')),
	'validation',
	'tests'
);

/**
 * Reads every test file of the official JSON Schema Test Suite. Only the
 * top-level `validation/tests` files are read; `optional/` and `proposals/`
 * cover features that are not part of the released specification.
 */
export function loadSuiteFiles(): SuiteFile[] {
	const files = readdirSync(suiteDirectory).filter((file) => file.endsWith('.json'));

	files.sort();

	return files.map((name) => {
		const file: unknown = JSON.parse(readFileSync(join(suiteDirectory, name), 'utf8'));

		if (
			!isPlainObject(file) ||
			typeof file.description !== 'string' ||
			!Array.isArray(file.tests)
		) {
			throw new TypeError(`${name} is not a JSON Schema Test Suite file`);
		}

		const cases: SuiteCase[] = [];

		for (const value of file.tests) {
			if (!isSuiteCase(value)) {
				throw new TypeError(`${name} contains an invalid test case`);
			}

			cases.push(value);
		}

		return { name, description: file.description, cases };
	});
}

function isSuiteCase(value: unknown): value is SuiteCase {
	if (!isPlainObject(value)) {
		return false;
	}

	return (
		typeof value.description === 'string' &&
		isJSONSchema(value.schema) &&
		Array.isArray(value.tests) &&
		value.tests.every(isSuiteTest) &&
		(value.compatibility === undefined || typeof value.compatibility === 'string') &&
		(value.tags === undefined ||
			(Array.isArray(value.tags) && value.tags.every((tag) => typeof tag === 'string'))) &&
		(value.externalSchemas === undefined || isExternalSchemas(value.externalSchemas))
	);
}

function isSuiteTest(value: unknown): value is SuiteTest {
	return (
		isPlainObject(value) &&
		typeof value.description === 'string' &&
		'data' in value &&
		typeof value.valid === 'boolean'
	);
}

function isExternalSchemas(value: unknown): value is Record<string, JSONSchema | boolean> {
	return isPlainObject(value) && Object.values(value).every(isJSONSchema);
}

/** The key used by `knownFailures` to identify a single test case. */
export function suiteCaseKey(file: SuiteFile, testCase: SuiteCase) {
	return `${file.name} :: ${testCase.description}`;
}
