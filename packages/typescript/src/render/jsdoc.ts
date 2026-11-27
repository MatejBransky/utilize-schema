import { isParsedJSONSchemaObject, toSafeString } from '@utilize/json-schema';
import type { ParsedJSONSchema, ParsedJSONSchemaObject } from '@utilize/json-schema';

import { indent } from './constants';
import { escapeComment } from './text';

/**
 * JSDoc for annotations that describe the value rather than constrain it.
 * Validation keywords are intentionally omitted: they cannot be expressed in a
 * TypeScript type, so repeating them in a comment would imply guarantees the
 * type does not make.
 *
 * `declarationName` is the name of the emitted declaration. A title that would
 * only repeat it is left out, because the generator derives that name from the
 * title in the first place.
 */
export function renderJsDoc(
	schema: ParsedJSONSchema | undefined,
	level = 0,
	declarationName?: string
): string[] {
	if (!isParsedJSONSchemaObject(schema)) {
		return [];
	}

	const lines = jsDocText(schema, declarationName);
	const tags = jsDocTags(schema);

	if (lines.length > 0 && tags.length > 0) {
		lines.push('');
	}
	lines.push(...tags);

	if (lines.length === 0) {
		return [];
	}

	const prefix = indent(level);

	return [
		`${prefix}/**`,
		...lines.map((line) => `${prefix} * ${escapeComment(line)}`.trimEnd()),
		`${prefix} */`,
	];
}

function jsDocText(schema: ParsedJSONSchemaObject, declarationName?: string): string[] {
	const lines: string[] = [];
	const title = typeof schema.title === 'string' ? schema.title.trim() : '';
	const description = typeof schema.description === 'string' ? schema.description.trim() : '';
	const titleRepeatsName =
		declarationName !== undefined && title.length > 0 && toSafeString(title) === declarationName;

	for (const text of [titleRepeatsName ? '' : title, description]) {
		if (text.length > 0) {
			lines.push(...text.split('\n'));
		}
	}

	return lines;
}

function jsDocTags(schema: ParsedJSONSchemaObject): string[] {
	const tags: string[] = [];

	if (schema.deprecated === true) {
		tags.push('@deprecated');
	}
	if (schema.default !== undefined) {
		tags.push(`@default ${JSON.stringify(schema.default)}`);
	}
	if (typeof schema.format === 'string') {
		tags.push(`@format ${schema.format}`);
	}
	if (Array.isArray(schema.examples)) {
		for (const example of schema.examples) {
			tags.push(`@example ${JSON.stringify(example)}`);
		}
	}

	return tags;
}
