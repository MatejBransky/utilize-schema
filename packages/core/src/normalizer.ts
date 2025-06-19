import type { DereferenceTrace } from './dereference';
import type { Rule } from './rules';
import { traverse } from './traverse';
import type {
	JSONSchema,
	LinkedJSONSchema,
	NormalizedJSONSchema,
} from './types/JSONSchema';

// FIXME: Update type once you know what `options` are needed
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type NormalizeOptions = any;

type NormalizeArgs = {
	rootSchema: LinkedJSONSchema;
	dereferenceTrace: DereferenceTrace;
	fileName: string;
	rules: Map<string, Rule>;
	options?: NormalizeOptions;
};

/**
 * Normalizes a JSON Schema (draft 7) by applying a series of transformation rules.
 */
export function normalize({
	rootSchema,
	dereferenceTrace,
	fileName,
	rules,
	options,
}: NormalizeArgs): NormalizedJSONSchema {
	const visitedRefSchemas = new Set<JSONSchema>();
	rules.forEach((rule) =>
		traverse({
			schema: rootSchema,
			callback: (schema, key) =>
				rule({
					schema,
					fileName,
					options,
					key,
					dereferenceTrace,
					visitedRefSchemas,
				}),
		})
	);
	return rootSchema as NormalizedJSONSchema;
}
