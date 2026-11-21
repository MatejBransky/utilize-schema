import { dialectOf, type ParsedJSONSchemaObject } from '@utilize/json-schema';

import { createGenerator } from './createGenerator';
import { areMutuallyExclusive } from './exclusiveBranches';
import { generateSchema } from './generateSchema';
import { generator as objectGenerator } from './objectGenerator';
import { composedSchemaParts } from './schemaParts';
import { selectGenerator } from './selectGenerator';

import { isResolvedByCaller, ts } from '../utils';

export const generator = createGenerator<
	ParsedJSONSchemaObject & {
		oneOf: ParsedJSONSchemaObject[];
		discriminator?: string;
	}
>(
	(schema) => Array.isArray(schema.oneOf),
	(schema, context) => {
		const subschemas = schema.oneOf.map((subschema) => generateSchema(subschema, context));

		const discriminable = schema.oneOf.every(
			(subschema) =>
				typeof subschema === 'object' &&
				subschema !== null &&
				selectGenerator(subschema, dialectOf(subschema, context.dialect)) === objectGenerator &&
				composedSchemaParts(subschema) === undefined
		);

		if (schema.discriminator && discriminable) {
			return ts`z.discriminatedUnion('${schema.discriminator}', [${subschemas.join(', ')}])`;
		}

		if (subschemas.length === 0) {
			return ts`z.never()`;
		}

		if (subschemas.length === 1) {
			return subschemas[0]!;
		}

		const exclusive = areMutuallyExclusive(schema.oneOf, {
			dialect: context.dialect,
			isOpaque: (node) => isResolvedByCaller(context.customSchemaResolver, node),
		});

		if (exclusive) {
			return ts`z.union([${subschemas.join(', ')}])`;
		}

		// `oneOf` matches exactly one branch, while `z.union()` accepts a value
		// that matches several. The helper parses every branch once, on the
		// original input, and returns the winning result.
		context.usesOneOf = true;

		return ts`oneOfSchema([${subschemas.join(', ')}])`;
	}
);
