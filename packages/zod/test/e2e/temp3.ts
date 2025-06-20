import { z } from 'zod/v4';

export const NonNegativeInteger = z.int().min(0);
export type NonNegativeInteger = z.infer<typeof NonNegativeInteger>;

export const NonNegativeIntegerDefault0 = z.intersection(
	NonNegativeInteger,
	z.number().default(0)
);
export type NonNegativeIntegerDefault0 = z.infer<
	typeof NonNegativeIntegerDefault0
>;

export const SchemaArray = z.array(CoreSchemaMetaSchema).min(1);
export type SchemaArray = z.infer<typeof SchemaArray>;

export const CoreSchemaMetaSchema = z
	.union([
		z.object({
			$id: z.string().optional(),
			maxLength: NonNegativeInteger.optional(),
			minLength: NonNegativeIntegerDefault0.optional(),
			items: z.union([CoreSchemaMetaSchema, SchemaArray]).default(true),
		}),
		z.boolean(),
	])
	.meta({ title: 'Core schema meta-schema' });
export type CoreSchemaMetaSchema = z.infer<typeof CoreSchemaMetaSchema>;
