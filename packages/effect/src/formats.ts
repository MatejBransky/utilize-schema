/**
 * Checks the Effect generator emits when `formatMode` is `assert`.
 *
 * The supported names match the Zod generator's `formatToZodMethod` map, so a
 * schema validates the same set of formats in both targets. A format without an
 * entry stays an annotation, which is what JSON Schema prescribes for formats
 * an implementation does not know.
 *
 * The patterns are practical rather than the full RFC grammar. They reject the
 * values people actually pass by mistake, and the suite covers the stricter
 * cases separately.
 */

/** Formats that are a single regular expression. */
const patterns: Record<string, string> = {
	email: String.raw`^[^\s@]+@[^\s@]+\.[^\s@]+$`,
	emoji: String.raw`^(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|\u200d|\ufe0f)+$`,
	base64: String.raw`^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$`,
	base64url: String.raw`^[A-Za-z0-9_-]*$`,
	nanoid: String.raw`^[A-Za-z0-9_-]{21}$`,
	cuid: String.raw`^c[^\s-]{8,}$`,
	cuid2: String.raw`^[a-z][a-z0-9]*$`,
	ulid: String.raw`^[0-9A-HJKMNP-TV-Z]{26}$`,
	ipv4: String.raw`^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$`,
	time: String.raw`^\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$`,
	'date-time': String.raw`^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$`,
	duration: String.raw`^P(?!$)(?:\d+Y)?(?:\d+M)?(?:\d+W)?(?:\d+D)?(?:T(?=\d)(?:\d+H)?(?:\d+M)?(?:\d+S)?)?$`,
};

const cidrv4 = String.raw`^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)/(?:3[0-2]|[12]?\d)$`;

/** Returns a `Schema.*` check for a format, or `undefined` for an unknown one. */
export function formatCheck(format: string): string | undefined {
	switch (format) {
		case 'uuid': {
			return 'Schema.isUUID()';
		}
		case 'url':
		case 'uri': {
			return filter(
				`try {
			new URL(value);
			return undefined;
		} catch {
			return 'Invalid ${format}';
		}`
			);
		}
		case 'date': {
			return filter(dateBody);
		}
		case 'ipv6': {
			return filter(ipv6Body);
		}
		case 'cidrv4': {
			return patternCheck(cidrv4);
		}
		case 'cidrv6': {
			return filter(cidrv6Body);
		}
		default: {
			const source = patterns[format];

			return source === undefined ? undefined : patternCheck(source);
		}
	}
}

function patternCheck(source: string) {
	return `Schema.isPattern(new RegExp(${JSON.stringify(source)}, 'u'))`;
}

function filter(body: string) {
	// The value type is explicit: the check is emitted as a standalone constant,
	// so it no longer sits in a position where `Schema.String` could infer it.
	return `Schema.makeFilter<string>((value) => {
		${body}
	})`;
}

const dateBody = `const match = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(value);
		if (!match) {
			return 'Invalid date';
		}
		const year = Number(match[1]);
		const month = Number(match[2]);
		const day = Number(match[3]);
		const date = new Date(Date.UTC(year, month - 1, day));
		return date.getUTCFullYear() === year &&
			date.getUTCMonth() === month - 1 &&
			date.getUTCDate() === day
			? undefined
			: 'Invalid date';`;

const ipv6Body = `try {
			new URL('http://[' + value + ']');
			return undefined;
		} catch {
			return 'Invalid IPv6 address';
		}`;

const cidrv6Body = `const [address, prefix] = value.split('/');
		if (prefix === undefined || !/^\\d{1,3}$/.test(prefix) || Number(prefix) > 128) {
			return 'Invalid IPv6 CIDR';
		}
		try {
			new URL('http://[' + address + ']');
			return undefined;
		} catch {
			return 'Invalid IPv6 CIDR';
		}`;
