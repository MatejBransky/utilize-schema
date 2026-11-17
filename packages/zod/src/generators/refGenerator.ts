import { Meta } from '@utilize/json-schema';

import { createGenerator } from './createGenerator';

import { resolveName } from '../resolveName';
import { ts } from '../utils';

export const generator = createGenerator(
	(schema) => '$ref' in schema,
	(schema, context) => {
		const metadata = schema[Meta];
		const reference = metadata.reference;

		if (reference === undefined || reference === null) {
			console.warn(
				`Reference schema at "${metadata.filePath}#/${metadata.path.join('/')}" must have a reference "${schema.$ref}"`
			);
			return ts`z.unknown()`;
		}

		if (typeof reference === 'boolean') {
			return reference ? ts`z.any()` : ts`z.never()`;
		}

		if (!reference[Meta].resolvedName) {
			reference[Meta].resolvedName = resolveName({
				schema: reference,
				usedNames: context.usedNames,
			});
		}

		const name = reference[Meta].resolvedName;

		if (metadata.isCircular && context.lazyRefs.has(schema)) {
			return ts`z.lazy(() => ${name})`;
		}

		return name;
	}
);
