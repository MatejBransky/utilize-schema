import {
	expectDefined,
	isParsedJSONSchemaObject,
	Meta,
	schemaRecord,
	withSourceMeta,
} from '@utilize/json-schema';
import type { ParsedJSONSchemaObject } from '@utilize/json-schema';

import type { RenderNested, TypeContext } from './context';
import { TYPE_KEYWORDS } from './constants';
import { UnresolvedReferenceError } from '../errors';
import { intersection } from './operators';

export function renderReference(
	schema: ParsedJSONSchemaObject,
	context: TypeContext,
	level: number,
	render: RenderNested
): string {
	const ref = expectDefined(schema.$ref, 'Expected a $ref string');
	const resolved = schema[Meta]?.reference;

	if (resolved === undefined) {
		throw new UnresolvedReferenceError(ref);
	}

	if (!isParsedJSONSchemaObject(resolved)) {
		return render(resolved, context, level);
	}

	const name = context.nameOf(resolved, ref);
	const siblings = referenceSiblings(schema);

	if (siblings === undefined) {
		return name;
	}

	const siblingType = render(siblings, context, level);

	return siblingType === 'unknown' ? name : intersection([name, siblingType]);
}

/**
 * A `$ref` ignores annotations, but newer drafts let it combine with sibling
 * keywords. Those siblings are intersected with the referenced type.
 */
function referenceSiblings(schema: ParsedJSONSchemaObject): ParsedJSONSchemaObject | undefined {
	const record = schemaRecord(schema);
	const keys = Object.keys(schema).filter(
		(keyword) => keyword !== '$ref' && TYPE_KEYWORDS.has(keyword) && record[keyword] !== undefined
	);

	if (keys.length === 0) {
		return undefined;
	}

	const sibling = Object.fromEntries(keys.map((key) => [key, record[key]]));

	return withSourceMeta(schema, sibling);
}
