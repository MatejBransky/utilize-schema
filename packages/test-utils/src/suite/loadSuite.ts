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
		const file = JSON.parse(readFileSync(join(suiteDirectory, name), 'utf8')) as {
			description: string;
			tests: SuiteCase[];
		};

		return { name, description: file.description, cases: file.tests };
	});
}

/** The key used by `knownFailures` to identify a single test case. */
export function suiteCaseKey(file: SuiteFile, testCase: SuiteCase) {
	return `${file.name} :: ${testCase.description}`;
}
