/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable prefer-const */
import { z } from 'zod';

// Helper schemas
const nonNegativeInteger = z.number().int().min(0);
const nonNegativeIntegerDefault0 = z.intersection(
	nonNegativeInteger,
	z.number().default(0)
);
const simpleTypes = z.enum([
	'array',
	'boolean',
	'integer',
	'null',
	'number',
	'object',
	'string',
]);
const stringArray = z.array(z.string()).default([]);

// Forward declaration for self-reference
let JSONSchemaDraft7ZodSchema: z.ZodType<any>;

const schemaArray = z.lazy(() => z.array(JSONSchemaDraft7ZodSchema).min(1));

// Main schema
JSONSchemaDraft7ZodSchema = z.lazy(() =>
	z.union([
		z.object({
			$schema: z.string().optional(),
			$id: z.string().optional(),
			title: z.string().optional(),
			definitions: z
				.object({
					schemaArray: schemaArray.optional(),
					nonNegativeInteger: nonNegativeInteger.optional(),
					nonNegativeIntegerDefault0: nonNegativeIntegerDefault0.optional(),
					simpleTypes: simpleTypes.optional(),
					stringArray: stringArray.optional(),
				})
				.optional(),
			type: z
				.union([
					z.string(),
					z.array(z.string()).min(1),
					z.boolean(),
					z.array(z.boolean()).min(1),
				])
				.optional(),
			properties: z.record(z.string(), z.any()).optional(),
			$ref: z.string().optional(),
			$comment: z.string().optional(),
			description: z.string().optional(),
			default: z.any().optional(),
			readOnly: z.boolean().default(false).optional(),
			writeOnly: z.boolean().default(false).optional(),
			examples: z.array(z.any()).optional(),
			multipleOf: z.number().optional(),
			maximum: z.number().optional(),
			exclusiveMaximum: z.number().optional(),
			minimum: z.number().optional(),
			exclusiveMinimum: z.number().optional(),
			maxLength: nonNegativeInteger.optional(),
			minLength: nonNegativeIntegerDefault0.optional(),
			pattern: z.string().optional(),
			additionalItems: z.lazy(() => JSONSchemaDraft7ZodSchema).optional(),
			items: z
				.union([z.lazy(() => JSONSchemaDraft7ZodSchema), schemaArray])
				.optional(),
			maxItems: nonNegativeInteger.optional(),
			minItems: nonNegativeIntegerDefault0.optional(),
			uniqueItems: z.boolean().default(false).optional(),
			contains: z.lazy(() => JSONSchemaDraft7ZodSchema).optional(),
			maxProperties: nonNegativeInteger.optional(),
			minProperties: nonNegativeIntegerDefault0.optional(),
			required: stringArray.optional(),
			additionalProperties: z.lazy(() => JSONSchemaDraft7ZodSchema).optional(),
			patternProperties: z
				.object({
					propertyNames: z.string().optional(),
				})
				.catchall(z.lazy(() => JSONSchemaDraft7ZodSchema))
				.default({})
				.optional(),
			dependencies: z
				.object({})
				.catchall(
					z.union([z.lazy(() => JSONSchemaDraft7ZodSchema), stringArray])
				)
				.optional(),
			propertyNames: z.lazy(() => JSONSchemaDraft7ZodSchema).optional(),
			const: z.any().optional(),
			enum: z.array(z.any()).min(1).optional(),
			format: z.string().optional(),
			contentMediaType: z.string().optional(),
			contentEncoding: z.string().optional(),
			if: z.lazy(() => JSONSchemaDraft7ZodSchema).optional(),
			then: z.lazy(() => JSONSchemaDraft7ZodSchema).optional(),
			else: z.lazy(() => JSONSchemaDraft7ZodSchema).optional(),
			allOf: schemaArray.optional(),
			anyOf: schemaArray.optional(),
			oneOf: schemaArray.optional(),
			not: z.lazy(() => JSONSchemaDraft7ZodSchema).optional(),
		}),
		z.boolean(),
	])
);

export { JSONSchemaDraft7ZodSchema };

