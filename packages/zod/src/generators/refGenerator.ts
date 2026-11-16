import { Meta } from '@utilize/json-schema';

import { createGenerator } from './createGenerator';

import { unsupportedCycleError } from '../errors';
import { isPropertyBacked } from '../isPropertyBacked';
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

		// A recursive reference outside an object property cannot be emitted as
		// a getter. Fail at generation time instead of producing code that
		// throws "Cannot access X before initialization" when imported.
		if (metadata.isCircular && !isPropertyBacked(schema)) {
			throw unsupportedCycleError([schema]);
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
