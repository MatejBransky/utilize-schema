import { escapeTemplateText, stringLiteral } from './literals';

/**
 * A JSON Schema `patternProperties` key is an unanchored ECMA-262 regular
 * expression. This module converts the subset that a TypeScript key type can
 * describe exactly: literals, escaped literals, character classes and
 * alternation groups, with optional `^` and `$` anchors.
 *
 * A pattern with no quantifier or wildcard matches a finite set of keys when it
 * is anchored at both ends, and a template-literal type otherwise. Anything
 * else returns `undefined`, so the caller keeps the plain index signature.
 */

/** A larger expansion would produce a huge union; the index signature is safer. */
const MAX_EXPANDED_KEYS = 200;

export interface PatternKeys {
	/** Type expression for every key the pattern matches. */
	keyType: string;
	/** Concrete keys when the pattern is anchored at both ends. */
	keys?: string[];
}

type Node =
	| { kind: 'literal'; value: string }
	| { kind: 'class'; values: string[] }
	| { kind: 'alternation'; options: Node[] }
	| { kind: 'sequence'; parts: Node[] }
	| { kind: 'wildcard' };

interface Cursor {
	source: string;
	index: number;
}

export function patternKeys(pattern: string): PatternKeys | undefined {
	const parsed = parsePattern(pattern);

	if (parsed === undefined) {
		return undefined;
	}

	const { startAnchored, endAnchored, node } = parsed;
	const finite = startAnchored && endAnchored;
	const keys = finite ? expandKeys(node) : undefined;

	if (finite && keys === undefined) {
		return undefined;
	}

	const parts: Node[] = [];

	if (!startAnchored) {
		parts.push({ kind: 'wildcard' });
	}
	parts.push(node);
	if (!endAnchored) {
		parts.push({ kind: 'wildcard' });
	}

	return {
		keyType: renderNode(parts.length === 1 ? node : { kind: 'sequence', parts }),
		keys,
	};
}

function parsePattern(
	pattern: string
): { startAnchored: boolean; endAnchored: boolean; node: Node } | undefined {
	const { startAnchored, endAnchored, body } = anchorsOf(pattern);

	// An empty body matches every key unless both anchors make it the empty key.
	if (body.length === 0 && !(startAnchored && endAnchored)) {
		return undefined;
	}

	const cursor: Cursor = { source: body, index: 0 };
	const node = parseAlternation(cursor);

	if (node === undefined || cursor.index !== body.length) {
		return undefined;
	}

	// `^` and `$` bind to one alternative, so `^a|b$` is not `^(a|b)$`.
	if ((startAnchored || endAnchored) && node.kind === 'alternation') {
		return undefined;
	}

	return { startAnchored, endAnchored, node };
}

interface PatternAnchors {
	startAnchored: boolean;
	endAnchored: boolean;
	body: string;
}

function anchorsOf(pattern: string): PatternAnchors {
	const startAnchored = pattern.startsWith('^');
	let body = startAnchored ? pattern.slice(1) : pattern;
	const endAnchored = endsWithDollar(body);

	if (endAnchored) {
		body = body.slice(0, -1);
	}

	return { startAnchored, endAnchored, body };
}

/** `$` is an anchor only when it is the last character and not escaped. */
function endsWithDollar(source: string): boolean {
	if (!source.endsWith('$')) {
		return false;
	}

	let backslashes = 0;

	for (let index = source.length - 2; index >= 0 && source[index] === '\\'; index--) {
		backslashes++;
	}

	return backslashes % 2 === 0;
}

function parseAlternation(cursor: Cursor): Node | undefined {
	const options: Node[] = [];
	let option = parseSequence(cursor);

	if (option === undefined) {
		return undefined;
	}
	options.push(option);

	while (cursor.source[cursor.index] === '|') {
		cursor.index++;
		option = parseSequence(cursor);

		if (option === undefined) {
			return undefined;
		}
		options.push(option);
	}

	return options.length === 1 ? options[0] : { kind: 'alternation', options };
}

function parseSequence(cursor: Cursor): Node | undefined {
	const parts: Node[] = [];

	while (cursor.index < cursor.source.length) {
		const character = cursor.source[cursor.index];

		if (character === '|' || character === ')') {
			break;
		}

		const atom = parseAtom(cursor);

		if (atom === undefined) {
			return undefined;
		}
		parts.push(atom);
	}

	return { kind: 'sequence', parts };
}

function parseAtom(cursor: Cursor): Node | undefined {
	const character = cursor.source[cursor.index];

	if (character === undefined) {
		return undefined;
	}

	if (character === '(') {
		return parseGroup(cursor);
	}
	if (character === '[') {
		return parseClass(cursor);
	}
	if (character === '\\') {
		const value = parseEscape(cursor, false);

		return value === undefined ? undefined : { kind: 'literal', value };
	}
	if (UNSUPPORTED_ATOMS.has(character)) {
		return undefined;
	}

	cursor.index++;
	return { kind: 'literal', value: character };
}

const UNSUPPORTED_ATOMS = new Set(['.', '^', '$', '*', '+', '?', '{']);

function parseGroup(cursor: Cursor): Node | undefined {
	cursor.index++; // (

	if (cursor.source[cursor.index] === '?') {
		if (cursor.source[cursor.index + 1] !== ':') {
			return undefined;
		}
		cursor.index += 2;
	}

	const group = parseAlternation(cursor);

	if (group === undefined || cursor.source[cursor.index] !== ')') {
		return undefined;
	}
	cursor.index++;

	return group;
}

function parseClass(cursor: Cursor): Node | undefined {
	cursor.index++; // [

	if (cursor.source[cursor.index] === '^') {
		return undefined;
	}

	const values = new Set<string>();

	while (cursor.index < cursor.source.length) {
		if (cursor.source[cursor.index] === ']') {
			cursor.index++;
			return { kind: 'class', values: [...values] };
		}

		const item = parseClassItem(cursor);

		if (item === undefined) {
			return undefined;
		}
		item.forEach((value) => values.add(value));

		if (values.size > MAX_EXPANDED_KEYS) {
			return undefined;
		}
	}

	return undefined;
}

function parseClassItem(cursor: Cursor): string[] | undefined {
	const start = parseClassAtom(cursor);

	if (start === undefined) {
		return undefined;
	}

	const separator = cursor.source[cursor.index];
	const end = cursor.source[cursor.index + 1];

	if (start !== '-' && separator === '-' && end !== undefined && end !== ']') {
		cursor.index++; // -
		const last = parseClassAtom(cursor);

		return last === undefined ? undefined : expandRange(start, last);
	}

	return [start];
}

function parseClassAtom(cursor: Cursor): string | undefined {
	const character = cursor.source[cursor.index];

	if (character === undefined || character === ']') {
		return undefined;
	}

	if (character === '\\') {
		return parseEscape(cursor, true);
	}

	cursor.index++;
	return character;
}

const SIMPLE_ESCAPES = new Map([
	['n', '\n'],
	['r', '\r'],
	['t', '\t'],
	['f', '\f'],
	['v', '\v'],
]);

const UNSUPPORTED_ESCAPES = new Set(['d', 'D', 's', 'S', 'w', 'W', 'p', 'P', 'B', 'c', 'k']);

function parseEscape(cursor: Cursor, inClass: boolean): string | undefined {
	cursor.index++; // \
	const character = cursor.source[cursor.index];

	if (character === undefined) {
		return undefined;
	}
	cursor.index++;

	switch (character) {
		case 'x':
			return readHex(cursor, 2);
		case 'u':
			return readUnicode(cursor);
		case 'b':
			return inClass ? '\b' : undefined;
		case '0':
			return parseNullEscape(cursor);
		default:
			return parseSimpleEscape(character);
	}
}

function parseSimpleEscape(character: string): string | undefined {
	if (UNSUPPORTED_ESCAPES.has(character)) {
		return undefined;
	}

	const simple = SIMPLE_ESCAPES.get(character);

	if (simple !== undefined) {
		return simple;
	}

	return isDigit(character) ? undefined : character;
}

function parseNullEscape(cursor: Cursor): string | undefined {
	const next = cursor.source[cursor.index];

	return next !== undefined && isDigit(next) ? undefined : '\0';
}

function isDigit(character: string): boolean {
	return character >= '0' && character <= '9';
}

function readHex(cursor: Cursor, length: number): string | undefined {
	const text = cursor.source.slice(cursor.index, cursor.index + length);

	if (text.length !== length || !/^[\dA-Fa-f]+$/.test(text)) {
		return undefined;
	}
	cursor.index += length;

	return String.fromCodePoint(Number.parseInt(text, 16));
}

function readUnicode(cursor: Cursor): string | undefined {
	if (cursor.source[cursor.index] !== '{') {
		return readHex(cursor, 4);
	}

	const closing = cursor.source.indexOf('}', cursor.index + 1);

	if (closing === -1) {
		return undefined;
	}

	const text = cursor.source.slice(cursor.index + 1, closing);

	if (!/^[\dA-Fa-f]{1,6}$/.test(text)) {
		return undefined;
	}

	const code = Number.parseInt(text, 16);

	if (code > 0x10_ff_ff) {
		return undefined;
	}
	cursor.index = closing + 1;

	return String.fromCodePoint(code);
}

function expandRange(start: string, end: string): string[] | undefined {
	if (Array.from(start).length !== 1 || Array.from(end).length !== 1) {
		return undefined;
	}

	const from = start.codePointAt(0);
	const to = end.codePointAt(0);

	if (from === undefined || to === undefined || to < from) {
		return undefined;
	}

	const length = to - from + 1;

	if (length > MAX_EXPANDED_KEYS) {
		return undefined;
	}

	return Array.from({ length }, (_, index) => String.fromCodePoint(from + index));
}

function expandKeys(node: Node): string[] | undefined {
	switch (node.kind) {
		case 'literal':
			return [node.value];
		case 'class':
			return [...new Set(node.values)];
		case 'wildcard':
			return undefined;
		case 'alternation':
			return expandAlternation(node.options);
		case 'sequence':
			return expandSequence(node.parts);
	}
}

function expandAlternation(options: Node[]): string[] | undefined {
	const keys = new Set<string>();

	for (const option of options) {
		const expanded = expandKeys(option);

		if (expanded === undefined) {
			return undefined;
		}
		expanded.forEach((key) => keys.add(key));

		if (keys.size > MAX_EXPANDED_KEYS) {
			return undefined;
		}
	}

	return [...keys];
}

function expandSequence(parts: Node[]): string[] | undefined {
	let keys = [''];

	for (const part of parts) {
		const expanded = expandKeys(part);

		if (expanded === undefined) {
			return undefined;
		}

		const next: string[] = [];

		for (const prefix of keys) {
			for (const suffix of expanded) {
				next.push(prefix + suffix);
			}
		}

		if (next.length > MAX_EXPANDED_KEYS) {
			return undefined;
		}
		keys = next;
	}

	return keys;
}

function renderNode(node: Node): string {
	switch (node.kind) {
		case 'literal':
			return stringLiteral(node.value);
		case 'class':
			return unionOf(node.values.map(stringLiteral));
		case 'alternation':
			return unionOf(node.options.map(renderNode));
		case 'sequence':
			return renderSequence(node.parts);
		case 'wildcard':
			return 'string';
	}
}

function renderSequence(parts: Node[]): string {
	const flat = flattenSequence(parts);
	const [only] = flat;

	if (only !== undefined && flat.length === 1) {
		return renderNode(only);
	}

	let literal = '';
	let allLiteral = true;

	for (const part of flat) {
		if (part.kind !== 'literal') {
			allLiteral = false;
			break;
		}
		literal += part.value;
	}

	if (allLiteral) {
		return stringLiteral(literal);
	}

	let template = '';

	for (const part of flat) {
		if (part.kind === 'literal') {
			template += escapeTemplateText(part.value);
			continue;
		}

		const type = renderNode(part);

		if (type === 'never') {
			return 'never';
		}
		template += `\${${type}}`;
	}

	return `\`${template}\``;
}

/** Nested sequences concatenate, so their literal runs belong to the outer one. */
function flattenSequence(parts: Node[]): Node[] {
	const flat: Node[] = [];

	for (const part of parts) {
		if (part.kind === 'sequence') {
			flat.push(...flattenSequence(part.parts));
		} else {
			flat.push(part);
		}
	}

	return flat;
}

function unionOf(types: string[]): string {
	const unique = [...new Set(types.filter((type) => type !== 'never'))];

	if (unique.length === 0) {
		return 'never';
	}

	return unique.join(' | ');
}
