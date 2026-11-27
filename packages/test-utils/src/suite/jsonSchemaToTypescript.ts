import { Parent } from 'json-schema-to-typescript/dist/src/types/JSONSchema.js';
import { compile } from 'json-schema-to-typescript';

import { suiteDirectory } from './loadSuite';
import { appendInstances } from './typecheck';

import type { CaseModule } from './typecheck';
import type { SuiteCase } from './loadSuite';

/**
 * Compiles one suite case with json-schema-to-typescript and appends the suite
 * instances, so the same `tsc --strict` pass can score it next to
 * `@utilize/typescript`.
 *
 * The options match the competitor's own conformance runner: no banner, no
 * Prettier pass, the root declaration forced to `Root`, and remote references
 * served from the case's `externalSchemas` instead of the network.
 */
export async function renderJsonSchemaToTypescriptCase(testCase: SuiteCase): Promise<CaseModule> {
	if (typeof testCase.schema === 'boolean') {
		throw new Error('json-schema-to-typescript requires an object schema');
	}

	// json-schema-to-typescript types its input as draft-04 `JSONSchema4`, but
	// its resolver accepts the newer keywords the suite contains. The guard
	// bridges the stale input type while the original schema is passed through.
	if (!isInputSchema(testCase.schema)) {
		throw new TypeError('json-schema-to-typescript needs a plain object schema');
	}

	const code = await compile(testCase.schema, 'Root', {
		bannerComment: '',
		format: false,
		cwd: `${suiteDirectory}/`,
		customName: (schema) => (isRootSchema(schema) ? 'Root' : undefined),
		$refOptions: {
			resolve: {
				file: false,
				http: false,
				suite: createResolver(testCase.externalSchemas),
			},
		},
	});

	return appendInstances(code, testCase.tests);
}

function isInputSchema(value: unknown): value is Parameters<typeof compile>[0] {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The linked root schema has `Parent` set to `null`; every nested schema has a parent. */
function isRootSchema(value: unknown): value is { [Parent]: null } {
	return (
		typeof value === 'object' &&
		value !== null &&
		Object.getOwnPropertyDescriptor(value, Parent)?.value === null
	);
}

function createResolver(externalSchemas: SuiteCase['externalSchemas']) {
	return {
		order: 1,
		canRead: /^https?:\/\//i,
		read: (file: { url: string }) => {
			const url = file.url.split('#')[0] ?? file.url;
			const schema = externalSchemas?.[url];

			if (schema === undefined) {
				throw new Error(`remote ${url} is not part of the test case`);
			}

			return structuredClone(schema);
		},
	};
}
