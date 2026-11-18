import { Result, Schema, SchemaIssue } from 'effect';
import { z } from 'zod';

export interface RuntimeIssue {
	/** JSON path of the value that failed, for example `$.items[0].sku`. */
	path: string;
	message: string;
}

export interface RuntimeResult {
	ok: boolean;
	/** The decoded value. Defaults inserted by the generated schema show up here. */
	value?: unknown;
	issues: RuntimeIssue[];
	/** Set when the validator itself could not run. */
	error?: string;
}

export interface RuntimeCode {
	zod?: string;
	effect?: string;
}

export interface RuntimeResults {
	zod: RuntimeResult;
	effect: RuntimeResult;
}

/**
 * Evaluates the JavaScript emitted from the generated TypeScript module.
 *
 * The generators emit one `export const` per standalone schema and declare the
 * root schema last, so the returned object is ordered and its last entry is the
 * validator for the edited schema. The emitted module only imports `z` from
 * `zod` or `Schema` from `effect`, which are supplied by this function.
 */
export function evaluateModule(source: string): Record<string, unknown> {
	const names = Array.from(
		source.matchAll(/^[ \t]*export[ \t]+(?:const|let|var|function|class)[ \t]+([\w$]+)/gm),
		(name) => name[1]!
	);

	if (names.length === 0) {
		throw new Error('The generated module does not export a schema.');
	}

	const body = source
		.replace(/^[ \t]*import\b[\s\S]*?from[ \t]*['"][^'"]+['"][ \t]*;?[ \t]*$/gm, '')
		.replace(/^[ \t]*export[ \t]+(?=(?:const|let|var|function|class)\b)/gm, '');

	// The generated code comes from the generators in this repository, but it
	// still runs as code in the page: only feed it strings from those generators.
	const factory = new Function('z', 'Schema', `${body}\nreturn { ${names.join(', ')} };`);

	return factory(z, Schema) as Record<string, unknown>;
}

export function rootValidator(module: Record<string, unknown>): unknown {
	const names = Object.keys(module);

	return names.length > 0 ? module[names.at(-1)!] : undefined;
}

export function validateWithZod(schema: unknown, data: unknown): RuntimeResult {
	const result = (schema as z.ZodType).safeParse(data);

	if (result.success) {
		return { ok: true, value: result.data, issues: [] };
	}

	return {
		ok: false,
		issues: result.error.issues.map((issue) => ({
			path: formatPath(issue.path),
			message: issue.message,
		})),
	};
}

export function validateWithEffect(schema: unknown, data: unknown): RuntimeResult {
	const result = Schema.decodeUnknownResult(schema as never)(data);

	if (Result.isSuccess(result)) {
		return { ok: true, value: result.success, issues: [] };
	}

	const formatted = SchemaIssue.makeFormatterStandardSchemaV1()(result.failure.issue);

	return {
		ok: false,
		issues: formatted.issues.map((issue) => ({
			path: formatPath(issue.path),
			message: issue.message,
		})),
	};
}

export function validate(
	zodModule: Record<string, unknown>,
	effectModule: Record<string, unknown>,
	data: unknown
): RuntimeResults {
	return {
		zod: safely(() => validateWithZod(rootValidator(zodModule), data)),
		effect: safely(() => validateWithEffect(rootValidator(effectModule), data)),
	};
}

function safely(run: () => RuntimeResult): RuntimeResult {
	try {
		return run();
	} catch (error) {
		return {
			ok: false,
			issues: [],
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

function formatPath(path: ReadonlyArray<PathSegment> | undefined): string {
	if (!path || path.length === 0) {
		return '$';
	}

	return path.reduce<string>((current, segment) => {
		const key = isPathKey(segment) ? segment.key : segment;

		if (typeof key === 'number') {
			return `${current}[${key}]`;
		}

		const name = String(key);

		return /^[A-Za-z_$][\w$]*$/.test(name)
			? `${current}.${name}`
			: `${current}[${JSON.stringify(name)}]`;
	}, '$');
}

type PathSegment = PropertyKey | { readonly key: PropertyKey };

function isPathKey(segment: PathSegment): segment is { readonly key: PropertyKey } {
	return typeof segment === 'object' && segment !== null && 'key' in segment;
}
