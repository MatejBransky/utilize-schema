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
