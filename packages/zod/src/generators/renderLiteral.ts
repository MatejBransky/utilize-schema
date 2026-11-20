import { isPlainObject } from '@utilize/json-schema';

import { shapeKey, ts } from '../utils';

/**
 * Renders a JSON value as a Zod schema that matches it by deep equality.
 *
 * `z.literal()` compares primitives and accepts several of them at once, but
 * it compares objects and arrays by identity. JSON Schema `const` and `enum`
 * compare by deep equality, so composite values are rendered as an exact tuple
 * or a strict object instead.
 */
export function renderLiteral(value: unknown): string {
	if (Array.isArray(value)) {
		if (value.length === 0) {
			return ts`z.tuple([])`;
		}

		return ts`z.tuple([
  ${value.map(renderLiteral).join(`,\n  `)}
])`;
	}

	if (isPlainObject(value)) {
		const entries = Object.entries(value);

		if (entries.length === 0) {
			return ts`z.strictObject({})`;
		}

		return ts`z.strictObject({
  ${entries.map(([key, entry]) => `${shapeKey(key)}: ${renderLiteral(entry)}`).join(`,\n  `)}
})`;
	}

	return ts`z.literal(${JSON.stringify(value)})`;
}
