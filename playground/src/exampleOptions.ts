import type { FormatMap } from '@utilize/zod';

/** Generator options an example needs to demonstrate a compile-time feature. */
export interface ExampleGeneratorOptions {
	zod?: {
		formatMap?: FormatMap;
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
};
