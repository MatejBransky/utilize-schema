import { basename, dirname, isAbsolute, resolve } from 'node:path';

import { generate as generateEffect } from '@utilize/effect';
import { Meta, parse } from '@utilize/json-schema';
import type { JSONSchema, ParsedJSONSchema } from '@utilize/json-schema';
import { generate as generateTypeScript } from '@utilize/typescript';
import { generate as generateZod } from '@utilize/zod';

export type Target = 'zod' | 'effect' | 'typescript';

export interface MapperOptions {
	/** Runtime schema to generate. Defaults to `zod`. */
	target?: Target;
}

export interface MapperDiagnostic {
	messageText: string;
	/** UTF-8 byte offset in the original file. */
	start: number;
	/** UTF-8 byte length in the original file. */
	length: number;
	code: number;
}

export interface SchemaModule {
	text: string;
	diagnostics?: MapperDiagnostic[];
	/** Files read while resolving `$ref`s. Bundlers should watch them. */
	dependencies?: string[];
}

const targets = new Set<Target>(['zod', 'effect', 'typescript']);

/**
 * Generates the virtual TypeScript module for one `.jsonschema` file. The
 * module exports the generated declarations and, for runtime targets, the root
 * schema as its default export.
 */
export async function schemaModule(
	fileName: string,
	content: string,
	options: MapperOptions = {}
): Promise<SchemaModule> {
	const target = options.target ?? 'zod';

	if (!targets.has(target)) {
		return {
			text: 'export {};\n',
			diagnostics: [diagnostic(`Unknown target "${String(target)}".`, content, 0, 0)],
		};
	}

	let schema: JSONSchema;

	try {
		schema = JSON.parse(content) as JSONSchema;
	} catch (error) {
		return {
			text: 'export {};\n',
			diagnostics: [jsonDiagnostic(content, error)],
		};
	}

	try {
		const { root, referencedSchemas } = await parse(schema, {
			cwd: dirname(fileName),
			fileName: basename(fileName),
		});

		// `issues` holds dialect warnings (`keywordPolicy: 'warn'`). The protocol
		// has no warning channel, and turning them into diagnostics would report
		// errors for schemas the CLI accepts with only a warning.
		return withDependencies(generate(root, target), referencedSchemas, dirname(fileName));
	} catch (error) {
		return {
			text: 'export {};\n',
			diagnostics: [diagnostic(messageOf(error), content, 0, 0)],
		};
	}
}

/**
 * Records the external files `parse` read, so a bundler can watch them. Their
 * `filePath` meta is relative to the schema file (absolute when the referenced
 * file lives outside that directory).
 */
function withDependencies(
	generated: SchemaModule,
	referencedSchemas: readonly ParsedJSONSchema[],
	cwd: string
): SchemaModule {
	const files = new Set<string>();

	for (const schema of referencedSchemas) {
		const filePath =
			typeof schema === 'object' && schema !== null ? schema[Meta]?.filePath : undefined;

		if (!filePath || filePath === '#') {
			continue;
		}

		files.add(isAbsolute(filePath) ? filePath : resolve(cwd, filePath));
	}

	return files.size > 0 ? { ...generated, dependencies: [...files] } : generated;
}

function generate(root: ParsedJSONSchema, target: Target): SchemaModule {
	switch (target) {
		case 'zod': {
			const code = generateZod(root, { importZod: true });
			const rootName = rootDeclarationName(root);

			// A boolean root has no declaration: the generator returns the
			// expression alone, so the module declares it here.
			if (rootName === undefined) {
				return {
					text: `import { z } from 'zod';\nexport const Root = ${code};\nexport default Root;\n`,
				};
			}

			return { text: `${code}\nexport default ${rootName};\n` };
		}
		case 'effect': {
			const code = generateEffect(root, { importEffect: true });
			const rootName = rootDeclarationName(root) ?? 'Root';

			return { text: `${code}\nexport default ${rootName};\n` };
		}
		case 'typescript':
			return { text: generateTypeScript(root) };
	}
}

function rootDeclarationName(root: ParsedJSONSchema): string | undefined {
	return typeof root === 'object' && root !== null ? root[Meta].resolvedName : undefined;
}

function jsonDiagnostic(content: string, error: unknown): MapperDiagnostic {
	const message = messageOf(error);
	const position = /position (\d+)/.exec(message);
	const offset = position ? Number(position[1]) : 0;
	const prefix = content.slice(0, offset);

	return diagnostic(message, content, Buffer.byteLength(prefix, 'utf8'), 1);
}

function diagnostic(
	message: string,
	content: string,
	start: number,
	length: number
): MapperDiagnostic {
	// TypeScript rejects the whole transform when a diagnostic ends past the
	// content, which is exactly what a parse error at the end of the file
	// reports (for example an unterminated object while typing).
	const total = Buffer.byteLength(content, 'utf8');
	const safeStart = Math.min(start, total);

	return {
		messageText: message,
		start: safeStart,
		length: Math.min(length, total - safeStart),
		code: 1,
	};
}

function messageOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
