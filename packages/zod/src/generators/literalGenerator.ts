import { isKeywordApplicable } from '@utilize/json-schema';

import { createGenerator } from './createGenerator';
import { renderLiteral } from './renderLiteral';

export const literalGenerator = createGenerator<{ const: unknown }>(
	(schema, dialect) => schema.const !== undefined && isKeywordApplicable(dialect, 'const'),
	(schema) => {
		return renderLiteral(schema.const);
	}
);
