import { assert, Meta } from '@utilize/json-schema';

import { createGenerator } from './createGenerator';

import { resolveName } from '../resolveName';

export const generator = createGenerator(
	(schema) => '$ref' in schema,
	(schema, context) => {
		const metadata = schema[Meta];
		const reference = metadata.reference;

		assert(
			reference,
			`Reference schema at "${metadata.path.join('/')}" must have a reference "${schema.$ref}"`
		);

		if (!reference[Meta].resolvedName) {
			reference[Meta].resolvedName = resolveName({
				schema: reference,
				usedNames: context.usedNames,
			});
		}

		return reference[Meta].resolvedName;
	}
);
