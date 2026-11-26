import { init as initLexer, parse as parseImports } from 'es-module-lexer';

import type {
	Result as EffectResult,
	Schema as EffectSchema,
	SchemaIssue as EffectSchemaIssue,
} from 'effect';
import type { z as ZodNamespace } from 'zod';

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

/** The namespace object exported by a generated ES module. */
export interface GeneratedModule {
	readonly namespace: object;
}

type RuntimeSchema = object | ((...args: never[]) => void);

interface ZodRuntime {
	readonly z: typeof ZodNamespace;
}

interface EffectRuntime {
	readonly Result: typeof EffectResult;
	readonly Schema: typeof EffectSchema;
	readonly SchemaIssue: typeof EffectSchemaIssue;
}

type RuntimeModule = ZodRuntime | EffectRuntime;
type RuntimePackageName = 'zod' | 'effect';

interface ZodPackage {
	readonly z: typeof ZodNamespace;
}

interface EffectPackage {
	readonly Schema: typeof EffectSchema;
}

type RuntimePackage = ZodPackage | EffectPackage;

interface PackageBridge {
	readonly zod: ZodPackage | undefined;
	readonly effect: EffectPackage | undefined;
}

const PACKAGES_GLOBAL = '__utilizePlaygroundPackages';
const runtimeModules = new Map<RuntimePackageName, Promise<RuntimeModule>>();
const packageUrls = new Map<RuntimePackageName, string>();
let zodPackage: ZodPackage | undefined;
let effectPackage: EffectPackage | undefined;

/**
 * Generated modules read the selected package through this immutable bridge.
 * Getters let the runtime expose packages lazily without leaving writable slots
 * that generated code could replace before another target runs.
 */
const packages: PackageBridge = {
	get zod() {
		return zodPackage;
	},
	get effect() {
		return effectPackage;
	},
};

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
export async function loadModule(javascript: string): Promise<GeneratedModule> {
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

	const namespace: unknown = await import(/* @vite-ignore */ moduleUrl(source));

	if (typeof namespace !== 'object' || namespace === null) {
		throw new Error('The generated module did not produce an export object.');
	}

	return { namespace };
}

/** The generators export the root schema under its resolved name. */
export function rootValidator(module: GeneratedModule, rootName: string): RuntimeSchema {
	const descriptor = Object.getOwnPropertyDescriptor(module.namespace, rootName);

	if (!descriptor) {
		throw new Error(`The generated module does not export the root schema "${rootName}".`);
	}

	const schema: unknown = descriptor.get ? descriptor.get() : descriptor.value;

	if (!isRuntimeSchema(schema)) {
		throw new Error(`The generated root schema "${rootName}" is not a runtime schema.`);
	}

	return schema;
}

function isRuntimeSchema(value: unknown): value is RuntimeSchema {
	return (typeof value === 'object' && value !== null) || typeof value === 'function';
}

/** Runs the root schema of a loaded module on the data. Never throws. */
export async function validateModule(
	target: RuntimeTargetId,
	module: GeneratedModule,
	rootName: string,
	data: unknown
): Promise<RuntimeResult> {
	return safely(async () => validators[target](rootValidator(module, rootName), data));
}

export async function validateWithZod(schema: unknown, data: unknown): Promise<RuntimeResult> {
	const { z } = await runtimeModule('zod');

	if (!(schema instanceof z.ZodType)) {
		throw new Error('The generated root is not a Zod schema.');
	}

	const result = schema.safeParse(data);

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
	const { Result, Schema, SchemaIssue } = await runtimeModule('effect');

	if (!isEffectValidator(schema, Schema.isSchema)) {
		throw new Error('The generated root is not an Effect schema.');
	}

	// The default, `"first"`, stops at the first issue and hides the rest.
	const result = Schema.decodeUnknownResult(schema, { errors: 'all' })(data);

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

/** Generated Effect validators are schemas without decoding-service requirements. */
function isEffectValidator(
	schema: unknown,
	isSchema: (value: unknown) => value is EffectSchema.Top
): schema is EffectSchema.ConstraintDecoder<unknown> {
	return isSchema(schema);
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
function runtimeModule(name: 'zod'): Promise<ZodRuntime>;
function runtimeModule(name: 'effect'): Promise<EffectRuntime>;
function runtimeModule(name: RuntimePackageName): Promise<RuntimeModule>;
function runtimeModule(name: RuntimePackageName): Promise<RuntimeModule> {
	let module = runtimeModules.get(name);

	if (!module) {
		module = name === 'zod' ? import('zod') : import('effect');
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

	let exports: RuntimePackage;

	if (name === 'zod') {
		zodPackage ??= Object.freeze({ z: (await runtimeModule('zod')).z });
		exports = zodPackage;
	} else {
		effectPackage ??= Object.freeze({ Schema: (await runtimeModule('effect')).Schema });
		exports = effectPackage;
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
