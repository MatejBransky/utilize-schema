import type { CustomSchemaResolver as EffectCustomSchemaResolver } from '@utilize/effect';
import type { CustomSchemaResolver as TypeScriptCustomSchemaResolver } from '@utilize/typescript';
import type { CustomSchemaResolver as ZodCustomSchemaResolver, FormatMap } from '@utilize/zod';

/** Generator options an example needs to demonstrate a compile-time feature. */
export interface ExampleGeneratorOptions {
	zod?: {
		formatMap?: FormatMap;
		customSchemaResolver?: ZodCustomSchemaResolver;
	};
	effect?: {
		customSchemaResolver?: EffectCustomSchemaResolver;
	};
	typescript?: {
		customSchemaResolver?: TypeScriptCustomSchemaResolver;
	};
	/** Applied after generation, like the `format` hook on `compile()`. */
	format?: (code: string) => string | Promise<string>;
}

const exampleGeneratorOptions = new Map<string, ExampleGeneratorOptions>([
	[
		'format-map',
		{
			zod: {
				formatMap: {
					'phone-number': String.raw`z.string().regex(/^\d{3}-\d{4}$/)`,
				},
			},
		},
	],
	[
		'formatter-hook',
		{
			format: (code) => `// formatted by the example format hook\n${code.trim()}\n`,
		},
	],
	[
		'custom-resolver',
		{
			zod: {
				customSchemaResolver: (schema) =>
					schema.format === 'date-time' ? 'z.iso.datetime({ offset: true })' : undefined,
			},
			effect: {
				customSchemaResolver: (schema) =>
					schema.format === 'date-time' ? 'Schema.String' : undefined,
			},
			typescript: {
				customSchemaResolver: (schema) => (schema.format === 'date-time' ? 'Date' : undefined),
			},
		},
	],
]);

export function generatorOptionsFor(id: string): ExampleGeneratorOptions | undefined {
	return exampleGeneratorOptions.get(id);
}
