import type { Rule } from './rules';
import { traverse } from './traverse';
import type {
	LinkedJSONSchema,
	NormalizedJSONSchema,
} from './types/JSONSchema';

export type NormalizeOptions = {
	rootSchema: LinkedJSONSchema;
	fileName: string;
	rules: Map<string, Rule>;
};

/**
 * Normalizes a JSON Schema (draft 7) by applying a series of transformation rules.
 */
export function normalize({
	rootSchema,
	fileName,
	rules,
}: NormalizeOptions): NormalizedJSONSchema {
	rules.forEach((rule) =>
		traverse({
			schema: rootSchema,
			callback: (schema, key) => rule({ schema, fileName, key }),
		})
	);
	return rootSchema as NormalizedJSONSchema;
}
