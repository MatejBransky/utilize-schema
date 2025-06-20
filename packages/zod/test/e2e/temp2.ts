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

export const SchemaArray = z
	.array(z.lazy<typeof CoreSchemaMetaSchema>(() => CoreSchemaMetaSchema))
	.min(1);
export type SchemaArray = z.infer<typeof SchemaArray>;

export const StringArray = z.array(z.string()).default([]);
export type StringArray = z.infer<typeof StringArray>;

export const SimpleTypes = z.enum([
	'array',
	'boolean',
	'integer',
	'null',
	'number',
	'object',
	'string',
]);
export type SimpleTypes = z.infer<typeof SimpleTypes>;

export const CoreSchemaMetaSchema = z
	.union([
		z.object({
			$id: z.string().optional(),
			$schema: z.string().url().optional(),
			$ref: z.string().optional(),
			$comment: z.string().optional(),
			title: z.string().optional(),
			description: z.string().optional(),
			default: z.unknown().optional(),
			readOnly: z.boolean().default(false),
			writeOnly: z.boolean().default(false),
			examples: z.array(z.unknown()).optional(),
			multipleOf: z.number().gt(0).optional(),
			maximum: z.number().optional(),
			exclusiveMaximum: z.number().optional(),
			minimum: z.number().optional(),
			exclusiveMinimum: z.number().optional(),
			maxLength: NonNegativeInteger.optional(),
			minLength: NonNegativeIntegerDefault0.optional(),
			pattern: z.string().optional(),
			get additionalItems() {
				return CoreSchemaMetaSchema.optional();
			},
			get items() {
				return z.union([CoreSchemaMetaSchema, SchemaArray]).default(true);
			},
			maxItems: NonNegativeInteger.optional(),
			minItems: NonNegativeIntegerDefault0.optional(),
			uniqueItems: z.boolean().default(false),
			get contains() {
				return CoreSchemaMetaSchema.optional();
			},
			maxProperties: NonNegativeInteger.optional(),
			minProperties: NonNegativeIntegerDefault0.optional(),
			required: StringArray.optional(),
			get additionalProperties() {
				return CoreSchemaMetaSchema.optional();
			},
			get definitions() {
				return z.record(z.string(), CoreSchemaMetaSchema).default({});
			},
			get properties() {
				return z.object({}).catchall(CoreSchemaMetaSchema).default({});
			},
			get patternProperties() {
				return z.object({}).catchall(CoreSchemaMetaSchema).default({});
			},
			get dependencies() {
				return z.union([CoreSchemaMetaSchema, StringArray]).optional();
			},
			get propertyNames() {
				return CoreSchemaMetaSchema.optional();
			},
			const: z.unknown().optional(),
			enum: z.array(z.unknown()).min(1).optional(),
			type: z.union([SimpleTypes, z.array(SimpleTypes).min(1)]).optional(),
			format: z.string().optional(),
			contentMediaType: z.string().optional(),
			contentEncoding: z.string().optional(),
			get if() {
				return CoreSchemaMetaSchema.optional();
			},
			get then() {
				return CoreSchemaMetaSchema.optional();
			},
			get else() {
				return CoreSchemaMetaSchema.optional();
			},
			allOf: SchemaArray.optional(),
			anyOf: SchemaArray.optional(),
			oneOf: SchemaArray.optional(),
			get not() {
				return CoreSchemaMetaSchema.optional();
			},
		}),
		z.boolean(),
	])
	.default(true)
	.meta({ title: 'Core schema meta-schema' });
export type CoreSchemaMetaSchema = z.infer<typeof CoreSchemaMetaSchema>;
