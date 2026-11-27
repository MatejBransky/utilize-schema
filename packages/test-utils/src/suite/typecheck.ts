import { expectDefined } from '@utilize/json-schema';

import { commandOutput } from '../process';

import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const tsc = join(dirname(require.resolve('typescript/package.json')), 'bin/tsc');

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

export interface TypecheckModule {
	key: string;
	module: CaseModule;
}

export interface TypecheckResults {
	/** Cases whose generated declarations do not compile. */
	invalidModules: Map<string, string[]>;
	/** Valid instances that the generated type rejects. */
	validRejected: Map<string, number[]>;
	/** Invalid instances that the generated type accepts. */
	invalidAccepted: Map<string, number[]>;
	/** Diagnostics that could not be attributed to an instance or the schema. */
	unattributed: string[];
}

const DIAGNOSTIC = /^(.*)\((\d+),(\d+)\): error (TS\d+): (.*)$/;

/**
 * Appends one typed constant per suite instance to generated declarations.
 * Valid instances are plain declarations; invalid instances get a
 * `@ts-expect-error` directive, so a single `tsc` run checks both directions.
 */
export function appendInstances(
	code: string,
	tests: readonly { valid: boolean; data: unknown }[]
): CaseModule {
	const lines = code.trimEnd().split('\n');
	const schemaLines = lines.length;
	const instances: InstanceLine[] = [];

	for (const [index, suiteTest] of tests.entries()) {
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

/**
 * Type-checks every case module in one compiler run. A module is a self
 * contained file with the generated declarations followed by one constant per
 * suite instance, so the diagnostics map straight back to a case and an
 * instance.
 */
export async function typecheckCases(modules: TypecheckModule[]): Promise<TypecheckResults> {
	const directory = await mkdtemp(join(__dirname, '__suite__-'));
	const byPath = new Map<string, TypecheckModule>();
	const files: string[] = [];
	const results: TypecheckResults = {
		invalidModules: new Map(),
		validRejected: new Map(),
		invalidAccepted: new Map(),
		unattributed: [],
	};

	try {
		for (const [index, entry] of modules.entries()) {
			const file = join(directory, `case-${index}.ts`);

			byPath.set(file, entry);
			files.push(file);
			await writeFile(file, entry.module.code);
		}

		const diagnostics = compile(files);

		for (const diagnostic of diagnostics) {
			const entry = byPath.get(resolve(diagnostic.file));

			if (entry === undefined) {
				results.unattributed.push(`${diagnostic.file}: ${diagnostic.message}`);
				continue;
			}

			const { module } = entry;

			if (diagnostic.line <= module.schemaLines) {
				push(results.invalidModules, entry.key, diagnostic.message);
				continue;
			}

			const byDeclaration = module.instances.find((instance) => instance.line === diagnostic.line);

			if (byDeclaration !== undefined) {
				if (byDeclaration.valid) {
					push(results.validRejected, entry.key, byDeclaration.index);
				}
				// An invalid instance that fails to compile is the expected outcome.
				continue;
			}

			const byDirective = module.instances.find(
				(instance) => instance.directiveLine === diagnostic.line
			);

			if (byDirective !== undefined) {
				if (diagnostic.code === 'TS2578') {
					push(results.invalidAccepted, entry.key, byDirective.index);
				} else {
					results.unattributed.push(`${entry.key}: ${diagnostic.message}`);
				}
				continue;
			}

			results.unattributed.push(`${entry.key}:${diagnostic.line}: ${diagnostic.message}`);
		}
	} finally {
		await rm(directory, { recursive: true, force: true });
	}

	return results;
}

interface Diagnostic {
	file: string;
	line: number;
	code: string;
	message: string;
}

function compile(files: string[]): Diagnostic[] {
	try {
		execFileSync(
			process.execPath,
			[
				tsc,
				'--ignoreConfig',
				'--noEmit',
				'--strict',
				'--skipLibCheck',
				'--module',
				'esnext',
				'--moduleResolution',
				'bundler',
				'--target',
				'esnext',
				...files,
			],
			{ encoding: 'utf8', stdio: 'pipe' }
		);

		return [];
	} catch (error) {
		const output = commandOutput(error);
		const text = `${output.stdout}${output.stderr}`;

		return text
			.split('\n')
			.map((line) => DIAGNOSTIC.exec(line.trim()))
			.filter((match): match is RegExpExecArray => match !== null)
			.map((match) => ({
				file: expectDefined(match[1]),
				line: Number(match[2]),
				code: expectDefined(match[4]),
				message: expectDefined(match[5]),
			}));
	}
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
	const values = map.get(key);

	if (values === undefined) {
		map.set(key, [value]);
	} else if (!values.includes(value)) {
		values.push(value);
	}
}
