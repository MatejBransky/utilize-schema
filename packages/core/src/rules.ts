import { dequal } from 'dequal';

import type { DereferencedPaths } from './dereference';
import { type LinkedJSONSchema } from './types/JSONSchema';

// FIXME: Update type once you know what `options` are needed
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RuleOptions = any;

type RuleParams = {
	schema: LinkedJSONSchema;
	fileName: string;
	options: RuleOptions;
	key: string | null;
	dereferencedPaths: DereferencedPaths;
};

export type Rule = (params: RuleParams) => void;

export const rules = new Map<string, Rule>();

// Boolean schemas (true/false) are not currently supported.
// No investigation has been done yet to estimate the required effort for full support.
rules.set('Unsupported boolean schemas', ({ schema }) => {
	if (typeof schema === 'boolean') {
		throw new Error(
			'Boolean schemas (true/false) are not supported in this pipeline.'
		);
	}
});

rules.set('Transform definitions to $defs', ({ schema, fileName }) => {
	if (
		schema.definitions &&
		schema.$defs &&
		!dequal(schema.definitions, schema.$defs)
	) {
		throw ReferenceError(
			`Schema must define either definitions or $defs, not both. Given id=${schema.$id} in ${fileName}`
		);
	}
	if (schema.definitions) {
		schema.$defs = schema.definitions;
		delete schema.definitions;
	}
});
