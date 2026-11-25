import { type CustomNameResolver, Meta } from '@utilize/json-schema';

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
export function evaluateGeneratedCode<T>(code: string, scope: Record<string, unknown>): T {
	const names = Object.keys(scope);
	const values = Object.values(scope);

	// A boolean root schema is emitted as a bare expression.
	if (!code.includes('export ')) {
		// fallow-ignore-next-line security-sink -- the suite evaluates generated code in memory; no input comes from outside the test process
		return new Function(...names, `return ${code}`)(...values) as T;
	}

	// `stripTypeScriptTypes` removes type-only declarations but keeps the ESM
	// `export const` syntax, which the function body cannot contain.
	const javascript = stripTypeScriptTypes(code, { mode: 'strip' }).replace(
		/^export const /gm,
		'const '
	);

	// fallow-ignore-next-line security-sink -- the suite evaluates generated code in memory; no input comes from outside the test process
	return new Function(...names, `${javascript}\nreturn Root;`)(...values) as T;
}
