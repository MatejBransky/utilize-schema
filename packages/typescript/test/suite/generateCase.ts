import { Meta, parse } from '@utilize/json-schema';
import type { DialectId } from '@utilize/json-schema';
import { appendInstances } from '@utilize/test-utils/suite/typecheck';
import type { CaseModule } from '@utilize/test-utils/suite/typecheck';

import { generate } from '../../src/generator';

import type { SuiteCase } from '@utilize/test-utils/suite/loadSuite';

/**
 * Generates the types for a suite case and appends one typed constant per
 * instance. Valid instances are plain declarations; invalid instances get a
 * `@ts-expect-error` directive, so a single `tsc` run checks both directions.
 *
 * The root is always named `Root`, because suite schemas often have a `title` or
 * `$id` that would otherwise become the declaration name.
 */
export async function renderCaseModule(
	testCase: SuiteCase,
	dialect?: DialectId
): Promise<CaseModule> {
	const { root } = await parse(testCase.schema, {
		cwd: __dirname + '/',
		fileName: 'Root.json',
		externalSchemas: testCase.externalSchemas,
		dialect,
	});

	const code = generate(root, {
		customNameResolver: (schema) =>
			schema[Meta]?.parent === null && schema[Meta]?.fileName === 'Root.json' ? 'Root' : undefined,
	});

	return appendInstances(code, testCase.tests);
}
