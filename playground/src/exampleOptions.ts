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
}

export const exampleGeneratorOptions: Record<string, ExampleGeneratorOptions> = {
	'format-map': {
		zod: {
			formatMap: {
				'phone-number': String.raw`z.string().regex(/^\d{3}-\d{4}$/)`,
			},
		},
	},
	'custom-resolver': {
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
};
