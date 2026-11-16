import { isPlainObject } from '@utilize/json-schema';

import { ts } from '../utils';

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
  ${entries.map(([key, entry]) => `${propertyKey(key)}: ${renderLiteral(entry)}`).join(`,\n  `)}
})`;
	}

	return ts`z.literal(${JSON.stringify(value)})`;
}

function propertyKey(key: string) {
	// A computed key is the only way to create an own `__proto__` property.
	return key === '__proto__' ? `[${JSON.stringify(key)}]` : JSON.stringify(key);
}
