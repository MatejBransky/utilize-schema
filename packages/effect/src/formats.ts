/**
 * Checks the Effect generator emits when `formatMode` is `assert`.
 *
 * The supported names match the Zod generator's `formatToZodMethod` map, so a
 * schema validates the same set of formats in both targets. A format without an
 * entry stays an annotation, which is what JSON Schema prescribes for formats
 * an implementation does not know.
 *
 * Where Zod has a helper, the pattern is kept close to that helper's behaviour
 * so switching targets does not change which values pass.
 */

/** Calendar date with leap years. Same shape as Zod's `iso.date` regex, which
 * also accepts year 0000 that `Date` would map into 1900. */
const dateSource = String.raw`(?:(?:\d\d[2468][048]|\d\d[13579][26]|\d\d0[48]|[02468][048]00|[13579][26]00)-02-29|\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\d|30)|(?:02)-(?:0[1-9]|1\d|2[0-8])))`;

/** `hh:mm` with optional seconds, matching `z.iso.time()`: no time zone. */
const timeSource = String.raw`(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?`;

/** The qualified form `z.iso.datetime()` accepts: seconds plus `Z`. */
const qualifiedTimeSource = String.raw`(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?Z`;

/** Formats that are a single regular expression. */
const patterns: Record<string, string> = {
	email: String.raw`^[^\s@]+@[^\s@]+\.[^\s@]+$`,
	// The leading lookahead demands one anchor (a pictograph, a regional
	// indicator or a keycap), because `\p{Emoji_Component}` alone covers ZWJ
	// and modifiers, which are not emoji on their own.
	emoji: String.raw`^(?=[\s\S]*[\p{Extended_Pictographic}\p{Regional_Indicator}\u20E3])[\p{Extended_Pictographic}\p{Emoji_Component}]+$`,
	base64: String.raw`^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$`,
	base64url: String.raw`^(?:[A-Za-z0-9_-]{4})*(?:[A-Za-z0-9_-]{2,3})?$`,
	nanoid: String.raw`^[A-Za-z0-9_-]{21}$`,
	cuid: String.raw`^c[^\s-]{8,}$`,
	cuid2: String.raw`^[a-z][a-z0-9]*$`,
	ulid: String.raw`^[0-9A-HJKMNP-TV-Z]{26}$`,
	ipv4: String.raw`^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$`,
	date: `^${dateSource}$`,
	time: `^${timeSource}$`,
	'date-time': `^${dateSource}T${qualifiedTimeSource}$`,
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
			if (!Object.hasOwn(patterns, format)) {
				return undefined;
			}

			return patternCheck(patterns[format]!);
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

/**
 * The URL parser stops at `]`, so `::1]/x` would be accepted as a bracketed
 * host, and it tolerates whitespace, so `::1\n` would be accepted too. Reject
 * both before handing the value to it.
 */
const ipv6Body = `if (/[\\]\\/?#\\s]/.test(value)) {
			return 'Invalid IPv6 address';
		}
		try {
			new URL('http://[' + value + ']');
			return undefined;
		} catch {
			return 'Invalid IPv6 address';
		}`;

const cidrv6Body = `const [address, prefix] = value.split('/');
		if (prefix === undefined || !/^\\d{1,3}$/.test(prefix) || Number(prefix) > 128) {
			return 'Invalid IPv6 CIDR';
		}
		if (/[\\]\\/?#\\s]/.test(address)) {
			return 'Invalid IPv6 CIDR';
		}
		try {
			new URL('http://[' + address + ']');
			return undefined;
		} catch {
			return 'Invalid IPv6 CIDR';
		}`;
