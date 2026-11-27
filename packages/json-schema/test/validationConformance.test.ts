import { readFileSync, readdirSync } from 'node:fs';
import { expect, test } from 'vitest';

import { createJsonSchemaValidator } from '../src/runtime';
import type { RuntimeSchemaBundle } from '../src/runtimeSchema';
import { isPlainObject } from '../src/utils';

type Dialect = 2019 | 2020;
type SchemaDocument = RuntimeSchemaBundle['documents'][string];

interface SuiteCase {
	description: string;
	schema: SchemaDocument;
	tests: { description: string; data: unknown; valid: boolean }[];
	compatibility?: string;
	tags?: string[];
	externalSchemas?: Record<string, SchemaDocument>;
}

const directory = new URL(
	'../../test-utils/node_modules/json-schema-test-suite/validation/tests/',
	import.meta.url
);
const files = readdirSync(directory).filter(
	(file) => file.endsWith('.json') && !file.startsWith('format-')
);

function compatible(compatibility: string | undefined, dialect: Dialect): boolean {
	if (compatibility === undefined) {
		return true;
	}

	let valid = true;
	for (const raw of compatibility.split(',')) {
		const match = /^(<=|=)?(\d+)$/.exec(raw.trim());
		if (match === null) {
			throw new Error(`Unsupported compatibility: ${compatibility}`);
		}

		const [, operator = '', digits] = match;
		const version = Number(digits);
		valid =
			operator === '<='
				? dialect <= version
				: operator === '='
					? dialect === version
					: dialect >= version;
		if (dialect <= version) {
			break;
		}
	}

	return valid;
}

function isSuiteFile(value: unknown): value is { tests: SuiteCase[] } {
	return isPlainObject(value) && Array.isArray(value.tests);
}

for (const dialect of [2019, 2020] as const) {
	test(`official advanced fixtures: ${dialect}`, () => {
		const rootUri = 'https://suite.test/root.json';
		const failures: string[] = [];
		let cases = 0;
		let instances = 0;

		for (const file of files) {
			const parsed: unknown = JSON.parse(readFileSync(new URL(file, directory), 'utf8'));
			if (!isSuiteFile(parsed)) {
				throw new TypeError(`${file} is not a JSON Schema Test Suite file`);
			}

			for (const suiteCase of parsed.tests) {
				if (
					!compatible(suiteCase.compatibility, dialect) ||
					suiteCase.tags?.includes('format-assertion')
				) {
					continue;
				}

				cases += 1;
				instances += suiteCase.tests.length;
				const validate = createJsonSchemaValidator(
					{
						rootUri,
						documents: { [rootUri]: suiteCase.schema, ...suiteCase.externalSchemas },
						dialect: dialect === 2019 ? '2019-09' : '2020-12',
					},
					'annotate'
				);

				for (const suiteTest of suiteCase.tests) {
					if (validate(suiteTest.data, rootUri) !== suiteTest.valid) {
						failures.push(`${file} :: ${suiteCase.description} :: ${suiteTest.description}`);
					}
				}
			}
		}

		console.log(`${dialect}: ${cases} cases, ${instances} instances, ${failures.length} failures`);
		expect(failures).toEqual([]);
	}, 120_000);
}
