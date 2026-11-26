import { init as initLexer, parse as parseImports } from 'es-module-lexer';

import type {
	Result as EffectResult,
	Schema as EffectSchema,
	SchemaIssue as EffectSchemaIssue,
} from 'effect';
import type { z as ZodNamespace, ZodType } from 'zod';

import type { RuntimeTargetId } from './targets';

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

const PACKAGES_GLOBAL = '__utilizePlaygroundPackages';
const runtimeModules = new Map<string, Promise<Record<string, unknown>>>();
const packageExports = new Map<string, Record<string, unknown>>();
const packageUrls = new Map<string, string>();

/**
 * Generated modules read the selected package through this immutable bridge.
 * Getters let the runtime expose packages lazily without leaving writable slots
 * that generated code could replace before another target runs.
 */
const packages = Object.create(null) as Record<string, Record<string, unknown>>;

for (const name of ['zod', 'effect']) {
	Object.defineProperty(packages, name, {
		enumerable: true,
		get: () => packageExports.get(name),
	});
}

Object.freeze(packages);
Object.defineProperty(globalThis, PACKAGES_GLOBAL, {
	value: packages,
	writable: false,
	configurable: false,
	enumerable: false,
});

/**
 * Loads the JavaScript emitted for a generated module as a real ES module.
 *
 * Only the import specifiers are rewritten, at the positions `es-module-lexer`
 * reports: each package is swapped for a small module that re-exports what the
 * playground supplies. Everything else, including how the module exports its
 * declarations, keeps its ES module meaning.
 */
export async function loadModule(javascript: string): Promise<Record<string, unknown>> {
	await initLexer;

	const [imports] = parseImports(javascript);
	let source = '';
	let position = 0;

	for (const entry of imports) {
		if (entry.d !== -1 || entry.n === undefined) {
			throw new Error(
				'The generated module uses a dynamic import, which the playground does not run.'
			);
		}

		source += javascript.slice(position, entry.s) + (await packageUrl(entry.n));
		position = entry.e;
	}

	source += javascript.slice(position);

	return (await import(/* @vite-ignore */ moduleUrl(source))) as Record<string, unknown>;
}

/** The generators export the root schema under its resolved name. */
export function rootValidator(module: Record<string, unknown>, rootName: string): unknown {
	if (!Object.hasOwn(module, rootName)) {
		throw new Error(`The generated module does not export the root schema "${rootName}".`);
	}

	return module[rootName];
}

/** Runs the root schema of a loaded module on the data. Never throws. */
export async function validateModule(
	target: RuntimeTargetId,
	module: Record<string, unknown>,
	rootName: string,
	data: unknown
): Promise<RuntimeResult> {
	return safely(async () => validators[target](rootValidator(module, rootName), data));
}

export async function validateWithZod(schema: unknown, data: unknown): Promise<RuntimeResult> {
	await runtimeModule('zod');
	const result = (schema as ZodType).safeParse(data);

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

export async function validateWithEffect(schema: unknown, data: unknown): Promise<RuntimeResult> {
	const { Result, Schema, SchemaIssue } = (await runtimeModule('effect')) as {
		Result: typeof EffectResult;
		Schema: typeof EffectSchema;
		SchemaIssue: typeof EffectSchemaIssue;
	};

	// The default, `"first"`, stops at the first issue and hides the rest.
	const result = Schema.decodeUnknownResult(schema as never, { errors: 'all' })(data);

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

async function safely(run: () => RuntimeResult | Promise<RuntimeResult>): Promise<RuntimeResult> {
	try {
		return await run();
	} catch (error) {
		return {
			ok: false,
			issues: [],
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

function formatPath(path: readonly PathSegment[] | undefined): string {
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

const validators: Record<
	RuntimeTargetId,
	(schema: unknown, data: unknown) => Promise<RuntimeResult>
> = {
	zod: validateWithZod,
	effect: validateWithEffect,
};

/** Imports only the runtime requested by the current validator. */
function runtimeModule(name: string): Promise<Record<string, unknown>> {
	let module = runtimeModules.get(name);

	if (!module) {
		module =
			name === 'zod'
				? import('zod')
				: name === 'effect'
					? import('effect')
					: Promise.reject(new Error(`Unknown runtime package "${name}".`));
		runtimeModules.set(name, module);
		module.catch(() => {
			if (runtimeModules.get(name) === module) {
				runtimeModules.delete(name);
			}
		});
	}

	return module;
}

async function packageUrl(name: string): Promise<string> {
	if (name !== 'zod' && name !== 'effect') {
		throw new Error(
			`The generated module imports "${name}", which the playground does not provide.`
		);
	}

	let exports = packageExports.get(name);

	if (!exports) {
		const module = await runtimeModule(name);

		if (name === 'zod') {
			const { z } = module as { z: typeof ZodNamespace };
			exports = Object.freeze({ z });
		} else {
			const { Schema } = module as { Schema: typeof EffectSchema };
			exports = Object.freeze({ Schema });
		}

		packageExports.set(name, exports);
	}

	let url = packageUrls.get(name);

	if (!url) {
		const source = Object.keys(exports)
			.map(
				(exportName) =>
					`export const ${exportName} = globalThis.${PACKAGES_GLOBAL}[${JSON.stringify(name)}].${exportName};`
			)
			.join('\n');

		url = moduleUrl(source);
		packageUrls.set(name, url);
	}

	return url;
}

/** A `data:` URL works for `import()` in browsers, workers and Node alike. */
function moduleUrl(source: string): string {
	// The URL replaces a specifier inside its original quotes, so no quote may
	// stay unescaped. `encodeURIComponent` leaves `'` as it is.
	return `data:text/javascript;charset=utf-8,${encodeURIComponent(source).replaceAll("'", '%27')}`;
}
