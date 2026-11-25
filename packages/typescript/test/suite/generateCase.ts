import { type DialectId, type JSONSchema, Meta, parse } from '@utilize/json-schema';

import { generate } from '../../src/generator';

import type { SuiteCase } from '@utilize/test-utils/suite/loadSuite';

export interface InstanceLine {
	/** Position of the instance in the suite case. */
	index: number;
	valid: boolean;
	/** 1-based line of the `const` declaration that must type-check. */
	line: number;
	/** 1-based line of the directive that must be consumed, for invalid instances. */
	directiveLine?: number;
}

export interface CaseModule {
	code: string;
	/** Last line that belongs to the generated schema declarations. */
	schemaLines: number;
	instances: InstanceLine[];
}

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
	const { root } = await parse(testCase.schema as JSONSchema, {
		cwd: __dirname + '/',
		fileName: 'Root.json',
		externalSchemas: testCase.externalSchemas,
		dialect,
	});

	const code = generate(root, {
		customNameResolver: (schema) =>
			schema[Meta]?.parent === null && schema[Meta]?.fileName === 'Root.json' ? 'Root' : undefined,
	});

	const lines = code.trimEnd().split('\n');
	const schemaLines = lines.length;
	const instances: InstanceLine[] = [];

	for (const [index, suiteTest] of testCase.tests.entries()) {
		let directiveLine: number | undefined;

		if (!suiteTest.valid) {
			lines.push(`// @ts-expect-error -- invalid instance ${index}`);
			directiveLine = lines.length;
		}

		lines.push(`const instance${index}: Root = ${JSON.stringify(suiteTest.data)};`);
		instances.push({ index, valid: suiteTest.valid, line: lines.length, directiveLine });
	}

	return { code: `${lines.join('\n')}\n`, schemaLines, instances };
}
