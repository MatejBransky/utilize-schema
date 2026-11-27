import { Meta } from '@utilize/json-schema';
import type { CustomNameResolver } from '@utilize/json-schema';
import { formats } from '@utilize/json-schema/formats';

import { stripTypeScriptTypes } from 'node:module';

const FORMAT_IMPORT_PATTERN =
	/^import\s*\{([^}]*)\}\s*from\s*['"]@utilize\/json-schema\/formats['"];\s*$/gm;

const formatValidators = new Map<string, (value: string) => boolean>();
for (const validator of Object.values(formats)) {
	formatValidators.set(validator.name, validator);
}

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
	const evaluate = createFunction<T>(names, body);

	return evaluate(...values);
}

function createFunction<T>(names: string[], body: string): (...args: unknown[]) => T {
	// fallow-ignore-next-line security-sink -- the suite evaluates generated code in memory; no input comes from outside the test process
	const generated = new Function(...names, body);

	if (!isCallable<T>(generated)) {
		throw new TypeError('Generated code did not evaluate to a function');
	}

	return generated;
}

type FunctionLike = { readonly call: unknown };

function isCallable<T>(value: FunctionLike): value is FunctionLike & ((...args: unknown[]) => T) {
	return typeof value === 'function';
}

export function evaluateGeneratedCode<T>(code: string, scope: Record<string, unknown>): T {
	code = bindFormatImports(code, scope);

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

/**
 * Turns the format-validator import into function arguments, so the generated
 * module can run in memory without resolving a package. Aliases keep working:
 * `formatEmail as formatEmail1` binds `formatEmail1`.
 */
function bindFormatImports(code: string, scope: Record<string, unknown>): string {
	return code.replaceAll(FORMAT_IMPORT_PATTERN, (_, specifiers: string) => {
		for (const specifier of specifiers.split(',')) {
			const [imported, alias] = specifier.trim().split(/\s+as\s+/);

			if (imported === undefined) {
				continue;
			}

			const validator = formatValidators.get(imported);

			if (validator === undefined) {
				throw new Error(`Unknown format validator: ${imported}`);
			}

			scope[alias ?? imported] = validator;
		}

		return '';
	});
}
