import { assert } from 'vitest';
import { z } from 'zod/v4';

const CoreSchemaMetaSchemaBase = z.object({
	$id: z.string().optional(),
	$schema: z.string().url().optional(),
});

type CoreSchemaMetaSchemaInput =
	| boolean
	| (z.input<typeof CoreSchemaMetaSchemaBase> & {
			items: CoreSchemaMetaSchemaInput | CoreSchemaMetaSchemaInput[];
			additionalItems?: CoreSchemaMetaSchemaInput;
	  });

type CoreSchemaMetaSchemaOutput =
	| boolean
	| (z.output<typeof CoreSchemaMetaSchemaBase> & {
			items?: CoreSchemaMetaSchemaOutput | CoreSchemaMetaSchemaOutput[];
			additionalItems?: CoreSchemaMetaSchemaOutput;
	  });

export const CoreSchemaMetaSchema: z.ZodType<
	CoreSchemaMetaSchemaInput,
	CoreSchemaMetaSchemaOutput
> = z.union([
	CoreSchemaMetaSchemaBase.extend({
		get items() {
			return z
				.union([CoreSchemaMetaSchema, z.array(CoreSchemaMetaSchema).min(1)])
				.default(true);
		},
		get additionalItems() {
			return CoreSchemaMetaSchema.optional();
		},
	}),
	z.boolean(),
]);
export type CoreSchemaMetaSchema = z.infer<typeof CoreSchemaMetaSchema>;

export type InferCoreSchemaMetaSchema = z.output<typeof CoreSchemaMetaSchema>;

const d = CoreSchemaMetaSchema.parse({});

assert(typeof d !== 'boolean');
assert(typeof d.items !== 'boolean' && !Array.isArray(d.items));
