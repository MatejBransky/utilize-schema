import { basename, dirname } from 'node:path';

import { generate as generateEffect } from '@utilize/effect';
import { Meta, parse, type JSONSchema, type ParsedJSONSchema } from '@utilize/json-schema';
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
		const { root } = await parse(schema, {
			cwd: dirname(fileName),
			fileName: basename(fileName),
		});
		return generate(root, target);
	} catch (error) {
		return {
			text: 'export {};\n',
			diagnostics: [diagnostic(messageOf(error), content, 0, 0)],
		};
	}
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
	return {
		messageText: message,
		start: Math.min(start, Buffer.byteLength(content, 'utf8')),
		length,
		code: 1,
	};
}

function messageOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
