import { isPlainObject } from '@utilize/json-schema';

import { protoInputCheck } from './protoProperty';

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
		const shape =
			entries.length === 0
				? ts`z.strictObject({})`
				: ts`z.strictObject({
  ${entries.map(([key, entry]) => `${shapeKey(key)}: ${renderLiteral(entry)}`).join(`,\n  `)}
})`;

		// Zod's object parser skips an own `__proto__`, so the shape alone would
		// accept any value for it. Validate it on the raw input instead.
		if (!Object.hasOwn(value, '__proto__')) {
			return shape;
		}

		return ts`z.any().superRefine((value, ctx) => {
  ${protoInputCheck({
		required: true,
		valueExpressions: [renderLiteral(value['__proto__'])],
	})}
}).pipe(${shape})`;
	}

	return ts`z.literal(${JSON.stringify(value)})`;
}
