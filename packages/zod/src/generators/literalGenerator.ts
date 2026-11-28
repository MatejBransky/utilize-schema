import { isKeywordApplicable } from '@utilize/json-schema';
import type { ParsedJSONSchemaObject } from '@utilize/json-schema';

import { createGenerator } from './createGenerator';
import type { ExpressionGenerator } from './createGenerator';
import { renderLiteral } from './renderLiteral';

export type LiteralSchema = ParsedJSONSchemaObject & { const: unknown };

export const literalGenerator: ExpressionGenerator = createGenerator<LiteralSchema>(
	(schema, dialect): schema is LiteralSchema =>
		schema.const !== undefined && isKeywordApplicable(dialect, 'const'),
	(schema) => {
		return renderLiteral(schema.const);
	}
);
