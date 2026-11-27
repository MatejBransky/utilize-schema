import { expectDefined } from '@utilize/json-schema';

export function union(types: string[]): string {
	const unique = [...new Set(types.filter((type) => type !== 'never'))];

	if (unique.length === 0) {
		return 'never';
	}

	if (unique.includes('unknown')) {
		return 'unknown';
	}

	return unique.join(' | ');
}

export function intersection(types: string[]): string {
	const unique = [...new Set(types.filter((type) => type !== 'unknown'))];

	if (unique.includes('never')) {
		return 'never';
	}

	if (unique.length === 0) {
		return 'unknown';
	}

	if (unique.length === 1) {
		return expectDefined(unique[0]);
	}

	return unique.map(parenthesize).join(' & ');
}

export function parenthesize(type: string): string {
	return hasTopLevelOperator(type) ? `(${type})` : type;
}

/**
 * True when `type` combines at a depth of zero with `|` or `&`, so it has to be
 * parenthesized before it becomes an intersection member or an optional tuple
 * element. An object or tuple body may contain unions of its own; those are
 * already delimited and must not be wrapped.
 */
const CHARACTER_QUOTE = 1;
const CHARACTER_OPEN = 2;
const CHARACTER_CLOSE = 3;
const CHARACTER_OPERATOR = 4;
const CHARACTER_KINDS = new Uint8Array(128);

CHARACTER_KINDS[34] = CHARACTER_QUOTE;
CHARACTER_KINDS[39] = CHARACTER_QUOTE;
CHARACTER_KINDS[123] = CHARACTER_OPEN;
CHARACTER_KINDS[91] = CHARACTER_OPEN;
CHARACTER_KINDS[40] = CHARACTER_OPEN;
CHARACTER_KINDS[60] = CHARACTER_OPEN;
CHARACTER_KINDS[125] = CHARACTER_CLOSE;
CHARACTER_KINDS[93] = CHARACTER_CLOSE;
CHARACTER_KINDS[41] = CHARACTER_CLOSE;
CHARACTER_KINDS[62] = CHARACTER_CLOSE;
CHARACTER_KINDS[124] = CHARACTER_OPERATOR;
CHARACTER_KINDS[38] = CHARACTER_OPERATOR;

function hasTopLevelOperator(type: string): boolean {
	let depth = 0;
	let quote: number | undefined;

	for (let index = 0; index < type.length; index++) {
		const code = type.charCodeAt(index);

		if (quote !== undefined) {
			if (code === 92) {
				index++;
			} else {
				quote = updatedQuote(code, quote);
			}

			continue;
		}

		const kind = CHARACTER_KINDS[code];

		if (kind === CHARACTER_QUOTE) {
			quote = code;
		} else if (kind === CHARACTER_OPEN) {
			depth++;
		} else if (kind === CHARACTER_CLOSE) {
			depth = Math.max(0, depth - 1);
		} else if (kind === CHARACTER_OPERATOR && depth === 0) {
			return true;
		}
	}

	return false;
}

function updatedQuote(code: number, quote: number): number | undefined {
	return code === quote ? undefined : quote;
}
