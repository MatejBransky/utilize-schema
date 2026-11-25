/**
 * Helpers that generated schemas import when `runtimeImport` is set, instead
 * of declaring their own copy in every generated file.
 */
import { z } from 'zod';

/**
 * Accepts a value that matches exactly one of the schemas, like JSON Schema
 * `oneOf`. Every schema parses the original input, and the result of the only
 * matching schema is returned.
 */
export function oneOfSchema<T extends z.ZodType>(
	options: readonly T[]
): z.ZodType<z.output<T>, z.input<T>> {
	function matchingResults(value: unknown): z.output<T>[] {
		const matches: z.output<T>[] = [];

		for (const option of options) {
			const result = option.safeParse(value);

			if (result.success) {
				matches.push(result.data);

				if (matches.length > 1) {
					break;
				}
			}
		}

		return matches;
	}

	return z.any().transform((value, ctx) => {
		const matches = matchingResults(value);

		if (matches.length !== 1) {
			ctx.addIssue({
				code: 'custom',
				message: 'Value must match exactly one "oneOf" schema.',
			});

			return z.NEVER;
		}

		return matches[0]!;
	}) as z.ZodType<z.output<T>, z.input<T>>;
}
