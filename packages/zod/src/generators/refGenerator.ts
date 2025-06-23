import { assert, Meta } from '@utilize/json-schema';

import { createGenerator } from './createGenerator';

import { resolveName } from '../resolveName';

export const generator = createGenerator(
	(schema) => '$ref' in schema,
	(schema, context) => {
		const metadata = schema[Meta];
		const reference = metadata.reference;

		assert(reference, 'Reference schema must have a reference');

		if (!reference[Meta].resolvedName) {
			reference[Meta].resolvedName = resolveName({
				schema: reference,
				usedNames: context.usedNames,
			});
		}

		return reference[Meta].resolvedName;
	}
);
