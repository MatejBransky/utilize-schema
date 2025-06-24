import { Meta } from '@utilize/json-schema';

import { createGenerator } from './createGenerator';

import { resolveName } from '../resolveName';
import { ts } from '../utils';

export const generator = createGenerator(
	(schema) => '$ref' in schema,
	(schema, context) => {
		const metadata = schema[Meta];
		const reference = metadata.reference;

		if (!reference) {
			console.warn(
				`Reference schema at "${metadata.filePath}#/${metadata.path.join('/')}" must have a reference "${schema.$ref}"`
			);
			return ts`z.unknown()`;
		}

		if (!reference[Meta].resolvedName) {
			reference[Meta].resolvedName = resolveName({
				schema: reference,
				usedNames: context.usedNames,
			});
		}

		return reference[Meta].resolvedName;
	}
);
