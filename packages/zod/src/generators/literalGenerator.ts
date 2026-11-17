import { isKeywordApplicable } from '@utilize/json-schema';

import { createGenerator } from './createGenerator';
import { renderLiteral } from './renderLiteral';

export const generator = createGenerator<{ const: unknown }>(
	(schema, context) => schema.const !== undefined && isKeywordApplicable(context.dialect, 'const'),
	(schema) => {
		return renderLiteral(schema.const);
	}
);
