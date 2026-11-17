import { createGenerator } from './createGenerator';
import { renderLiteral } from './renderLiteral';

export const generator = createGenerator<{ const: unknown }>(
	(schema) => schema.const !== undefined,
	(schema) => {
		return renderLiteral(schema.const);
	}
);
