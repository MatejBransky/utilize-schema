import { Meta } from '@utilize/json-schema';
import type { CustomNameResolver } from '@utilize/json-schema';

import { stripTypeScriptTypes } from 'node:module';

/**
 * Names the root schema of the `Root.json` document `Root`. Suite schemas
 * often have an `$id` or `title`, which would otherwise name it, so the
 * evaluated module could not be looked up by one name.
 */
export const nameRootSchema: CustomNameResolver = (schema) =>
	schema[Meta]?.parent === null && schema[Meta]?.fileName === 'Root.json' ? 'Root' : undefined;

/**
 * Runs generated code in memory and returns its `Root` declaration. The
 * TypeScript syntax is stripped and the code runs as a function body with
 * `scope` (for example `{ z }`) in scope, which keeps the suite fast: hundreds
 * of schemas compile without touching the filesystem.
 */
function evaluateModule<T>(names: string[], body: string, values: unknown[]): T {
	// fallow-ignore-next-line security-sink -- the suite evaluates generated code in memory; no input comes from outside the test process
	const evaluate = new Function(...names, body) as (...args: unknown[]) => T;

	return evaluate(...values);
}

export function evaluateGeneratedCode<T>(code: string, scope: Record<string, unknown>): T {
	const names = Object.keys(scope);
	const values = Object.values(scope);

	// A boolean root schema is emitted as a bare expression.
	if (!code.includes('export ')) {
		return evaluateModule<T>(names, `return ${code}`, values);
	}

	// `stripTypeScriptTypes` removes type-only declarations but keeps the ESM
	// `export const` syntax, which the function body cannot contain.
	const javascript = stripTypeScriptTypes(code, { mode: 'strip' }).replaceAll(
		/^export const /gm,
		'const '
	);

	return evaluateModule<T>(names, `${javascript}\nreturn Root;`, values);
}
