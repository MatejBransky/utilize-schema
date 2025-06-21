/* eslint-disable */
import { assert } from 'vitest';
import { z } from 'zod/v4';

const CoreSchemaMetaSchemaBase = z.object({
	foo: z.string(),
});

const CoreSchemaMetaSchemaItems = CoreSchemaMetaSchemaBase.extend({
	get items(): z.ZodUnion<
		[typeof CoreSchemaMetaSchema, z.ZodArray<typeof CoreSchemaMetaSchema>]
	> {
		return z.union([
			CoreSchemaMetaSchema,
			z.array(CoreSchemaMetaSchema).min(1),
		]);
	},
});

export const CoreSchemaMetaSchema = z.union([
	CoreSchemaMetaSchemaItems,
	z.boolean(),
]);

const d = CoreSchemaMetaSchema.parse({});
assert(typeof d !== 'boolean');
const items = d.items;
assert(typeof items !== 'boolean');
assert(!Array.isArray(items));
items;
