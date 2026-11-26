import { allocateName } from './resolveName';

/**
 * Target-neutral runtime source for JSON Schema formats that need structural
 * validation rather than a single regular expression.
 */

const exactEnd = String.raw`(?![\s\S])`;
const dateSource = String.raw`(?:(?:\d\d[2468][048]|\d\d[13579][26]|\d\d0[48]|[02468][048]00|[13579][26]00)-02-29|\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\d|30)|(?:02)-(?:0[1-9]|1\d|2[0-8])))`;

const patterns = new Map<string, string>([
	[
		'time',
		String.raw`^(?:(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:[zZ]|[+-](?:[01]\d|2[0-3]):[0-5]\d)${exactEnd}`,
	],
	['json-pointer', String.raw`^(?:\/(?:[^~]|~[01])*)?${exactEnd}`],
	['relative-json-pointer', String.raw`^(?:0|[1-9][0-9]*)(?:#|\/(?:[^~]|~[01])*)?${exactEnd}`],
]);

export function formatPattern(format: string): string | undefined {
	return patterns.get(format);
}

/** Allocates one reusable constant name per format within a generated module. */
export function formatNameFor(
	format: string,
	formatNames: Map<string, string>,
	usedNames: Set<string>
): string {
	const existing = formatNames.get(format);

	if (existing !== undefined) {
		return existing;
	}

	const name = allocateName(formatConstantBase(format), usedNames);

	formatNames.set(format, name);
	return name;
}

/** `date-time` becomes `formatDateTime`, so one constant covers a format. */
export function formatConstantBase(format: string): string {
	const pascal = format.replaceAll(/[^a-zA-Z0-9]+(.)?/g, (_, next: string | undefined) =>
		next === undefined ? '' : next.toUpperCase()
	);

	return `format${pascal.charAt(0).toUpperCase()}${pascal.slice(1)}`;
}

const ipRuntime = String.raw`
const ipv4Part = '(?:25[0-5]|2[0-4]\\d|1\\d{2}|[1-9]?\\d)';
const ipv4Pattern = new RegExp('^' + ipv4Part + '(?:\\.' + ipv4Part + '){3}' + ${JSON.stringify(exactEnd)}, 'u');
function isIPv4(value: string) {
	return ipv4Pattern.test(value);
}
function isIPv6(value: string) {
	if (/[\]/?#\s%]/.test(value)) return false;
	try {
		new URL('http://[' + value + ']');
		return true;
	} catch {
		return false;
	}
}`;

const hostnameRuntime = String.raw`
const hostnameLabelPattern = new RegExp('^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?' + ${JSON.stringify(exactEnd)}, 'u');
const disallowedIdnaPattern = /[\u0640\u07FA\u302E\u302F\u3031-\u3035\u303B]/u;
const combiningMarkPattern = /^\p{M}/u;
const rtlLetterPattern = /(?=\p{L})(?:\p{Script=Hebrew}|\p{Script=Arabic}|\p{Script=Syriac}|\p{Script=Thaana}|\p{Script=Nko}|\p{Script=Samaritan}|\p{Script=Mandaic}|\p{Script=Adlam})/u;
const ltrLetterPattern = /^\p{L}/u;
const rtlAnyPattern = new RegExp('(?:' + rtlLetterPattern.source + '|[\u0660-\u0669])', 'u');
const extendedEuropeanDigitPattern = /[0-9\u06F0-\u06F9]/;
const arabicDigitPattern = /[\u0660-\u0669]/;
const extendedArabicDigitPattern = /[\u06F0-\u06F9]/;
const viramaPattern = /[\u094D\u09CD\u0A4D\u0ACD\u0B4D\u0BCD\u0C4D\u0CCD\u0D4D\u0DCA]/u;
const joiningContextPattern = /[\u0621-\u063A\u0640-\u064A]\u200C[\u0621-\u063A\u0640-\u064A]/u;
function isHost(value: string, idn: boolean) {
	let hostname = value;
	if (idn) {
		if (value === '' || /[\s\u0000-\u0020\u007F/\\?#@:\[\]%]/.test(value)) return false;
		try {
			hostname = new URL('http://' + value).hostname;
		} catch {
			return false;
		}
	} else if (value.length > 253 || !/^[A-Za-z0-9.-]+$/.test(value)) {
		return false;
	}
	if (hostname.length > 253 || hostname.endsWith('.')) return false;
	const labels = hostname.split('.');
	if (labels.some((label: string) => !hostnameLabelPattern.test(label) || !isAsciiIdnaLabel(label))) return false;
	const decoded = labels.map((label: string) => label.startsWith('xn--') ? decodePunycode(label.slice(4)) : label);
	if (decoded.some((label: string | null) => label === null)) return false;
	const bidi = decoded.some((label: string | null) => label !== null && rtlAnyPattern.test(label));
	return !bidi || decoded.every((label: string | null) => label !== null && isBidiLabel(label));
}
function isAsciiIdnaLabel(label: string) {
	const lower = label.toLowerCase();
	if (lower.startsWith('xn--')) return isALabel(lower);
	return !(label.length >= 4 && label.slice(2, 4) === '--');
}
function isALabel(label: string) {
	if (!label.startsWith('xn--') || label.length <= 4) return false;
	const decoded = decodePunycode(label.slice(4));
	if (decoded === null || !/[^\x00-\x7F]/.test(decoded)) return false;
	if (decoded.normalize('NFC') !== decoded || combiningMarkPattern.test(decoded)) return false;
	const structural = decoded.replace(/[\u200C\u200D\u00B7\u0375\u05F3\u05F4\u30FB\u06FD\u06FE\u0F0B\u3007-]/g, '');
	if (disallowedIdnaPattern.test(decoded) || /[\p{C}\p{Z}\p{P}\p{S}]/u.test(structural)) return false;
	if (!isIdnaContext(decoded)) return false;
	try {
		return new URL('http://' + decoded).hostname === label;
	} catch {
		return false;
	}
}
function decodePunycode(input: string) {
	const delimiter = input.lastIndexOf('-');
	const basic = delimiter === -1 ? '' : input.slice(0, delimiter);
	if ([...basic].some((char: string) => (char.codePointAt(0) ?? 0) >= 128)) return null;
	const output = [...basic];
	let position = basic.length + (delimiter === -1 ? 0 : 1);
	let index = 0;
	let n = 128;
	let bias = 72;
	while (position < input.length) {
		const oldIndex = index;
		let weight = 1;
		for (let key = 36; ; key += 36) {
			if (position >= input.length) return null;
			const code = input.charCodeAt(position++);
			const digit = code >= 65 && code <= 90 ? code - 65 : code >= 97 && code <= 122 ? code - 97 : code >= 48 && code <= 57 ? code - 22 : null;
			if (digit === null) return null;
			index += digit * weight;
			const threshold = key <= bias ? 1 : key >= bias + 26 ? 26 : key - bias;
			if (digit < threshold) break;
			weight *= 36 - threshold;
		}
		const length = output.length + 1;
		bias = adaptBias(index - oldIndex, length, oldIndex === 0);
		n += Math.floor(index / length);
		index %= length;
		if (n > 0x10FFFF) return null;
		output.splice(index++, 0, String.fromCodePoint(n));
	}
	return output.join('');
}
function adaptBias(delta: number, points: number, firstTime: boolean) {
	delta = firstTime ? Math.floor(delta / 700) : delta >> 1;
	delta += Math.floor(delta / points);
	let key = 0;
	while (delta > 455) {
		delta /= 35;
		key += 36;
	}
	return key + Math.floor((36 * delta) / (delta + 38));
}
function isIdnaContext(label: string) {
	if (label.length >= 4 && label.slice(2, 4) === '--') return false;
	if (label.includes('\u00B7') && !/l\u00B7l/.test(label)) return false;
	if (label.includes('\u0375') && !/\u0375\p{Script=Greek}/u.test(label)) return false;
	if (/[\u05F3\u05F4]/.test(label) && !/\p{Script=Hebrew}[\u05F3\u05F4]/u.test(label)) return false;
	if (label.includes('\u30FB') && !/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(label)) return false;
	if (arabicDigitPattern.test(label) && extendedArabicDigitPattern.test(label)) return false;
	for (let index = 0; index < label.length; index++) {
		if (label[index] === '\u200D' && (index === 0 || !viramaPattern.test(label[index - 1]))) return false;
		if (label[index] === '\u200C') {
			if (index > 0 && viramaPattern.test(label[index - 1])) continue;
			if (!joiningContextPattern.test(label.slice(Math.max(0, index - 1), index + 2))) return false;
		}
	}
	return true;
}
function isBidiLabel(label: string) {
	const first = [...label][0] ?? '';
	const last = [...label].at(-1) ?? '';
	const rtl = rtlLetterPattern.test(first);
	const ltr = !rtl && ltrLetterPattern.test(first);
	if (rtl) {
		if (!rtlLetterPattern.test(last) && !extendedEuropeanDigitPattern.test(last) && !arabicDigitPattern.test(last)) return false;
		return !(extendedEuropeanDigitPattern.test(label) && arabicDigitPattern.test(label));
	}
	if (ltr) {
		return !rtlAnyPattern.test(label) && (ltrLetterPattern.test(last) || extendedEuropeanDigitPattern.test(last));
	}
	return false;
}`;

const emailRuntime = String.raw`
const emailAtext = /[A-Za-z0-9!#$%&'*+\-/=?^_\x60{|}~]/;
const emailAtomPattern = new RegExp('^' + emailAtext.source + '+(?:\\.' + emailAtext.source + '+)*' + ${JSON.stringify(exactEnd)}, 'u');
const emailDomainPattern = new RegExp('^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*' + ${JSON.stringify(exactEnd)}, 'u');
const idnLocalAtext = new RegExp('^(?:' + emailAtext.source + '|[^\\x00-\\x7F])+$', 'u');
const idnQuotedChar = /^(?:[\x20-\x21\x23-\x5B\x5D-\x7F]|[^\x00-\x7F])$/u;
function isEmail(value: string, idn: boolean) {
	if (!idn && /[^\x00-\x7F]/.test(value)) return false;
	let local;
	let domain;
	if (value.startsWith('"')) {
		let escaped = false;
		let close = -1;
		for (let index = 1; index < value.length; index++) {
			const char = value[index];
			if (escaped) {
				if (!idn && (char.charCodeAt(0) < 32 || char.charCodeAt(0) > 126)) return false;
				escaped = false;
			} else if (char === '\\') {
				escaped = true;
			} else if (char === '"') {
				close = index;
				break;
			} else if (idn ? !idnQuotedChar.test(char) : char.charCodeAt(0) < 32 || char.charCodeAt(0) > 126) {
				return false;
			}
		}
		if (close === -1 || escaped || value[close + 1] !== '@') return false;
		local = value.slice(0, close + 1);
		domain = value.slice(close + 2);
	} else {
		const at = value.indexOf('@');
		if (at <= 0 || value.indexOf('@', at + 1) !== -1) return false;
		local = value.slice(0, at);
		domain = value.slice(at + 1);
		const atoms = local.split('.');
		if (atoms.some((atom: string) => atom === '' || !(idn ? idnLocalAtext.test(atom) : emailAtomPattern.test(atom)))) return false;
	}
	if (domain === '' || new TextEncoder().encode(local).byteLength > 64) return false;
	if (domain.startsWith('[')) return isEmailDomainLiteral(domain);
	return idn ? isHost(domain, true) : emailDomainPattern.test(domain);
}
function isEmailDomainLiteral(domain: string) {
	if (!domain.endsWith(']')) return false;
	const literal = domain.slice(1, -1);
	if (/^ipv6:/i.test(literal)) return isIPv6(literal.slice(5));
	return isIPv4(literal);
}`;

const uriRuntime = String.raw`
const pct = '%[0-9A-Fa-f]{2}';
const unreserved = 'A-Za-z0-9._~';
const subDelims = "!$&'()*+,;=";
const ucschar = '\\u{00A0}-\\u{D7FF}\\u{F900}-\\u{FDCF}\\u{FDF0}-\\u{FFEF}\\u{10000}-\\u{1FFFD}\\u{20000}-\\u{2FFFD}\\u{30000}-\\u{3FFFD}\\u{40000}-\\u{4FFFD}\\u{50000}-\\u{5FFFD}\\u{60000}-\\u{6FFFD}\\u{70000}-\\u{7FFFD}\\u{80000}-\\u{8FFFD}\\u{90000}-\\u{9FFFD}\\u{A0000}-\\u{AFFFD}\\u{B0000}-\\u{BFFFD}\\u{C0000}-\\u{CFFFD}\\u{D0000}-\\u{DFFFD}\\u{E1000}-\\u{EFFFD}';
const iprivate = '\\u{E000}-\\u{F8FF}\\u{F0000}-\\u{FFFFD}\\u{100000}-\\u{10FFFD}';
function componentPattern(kind: string, iri: boolean) {
	const extra = iri ? ucschar : '';
	const chars = unreserved + subDelims + extra + '-';
	let allowed = '[' + chars + ']|' + pct;
	if (kind === 'path' || kind === 'query' || kind === 'fragment') allowed += '|[:@]';
	if (kind === 'path') allowed += '|/';
	if (kind === 'query' || kind === 'fragment') allowed += '|[/?]';
	if (kind === 'userinfo') allowed += '|:';
	if ((kind === 'query' || kind === 'fragment') && iri) allowed += '|[' + iprivate + ']';
	return new RegExp('^(?:' + allowed + ')*' + ${JSON.stringify(exactEnd)}, 'u');
}
const uriPatterns = {
	path: componentPattern('path', false),
	query: componentPattern('query', false),
	fragment: componentPattern('fragment', false),
	userinfo: componentPattern('userinfo', false),
	regName: componentPattern('regName', false),
};
const iriPatterns = {
	path: componentPattern('path', true),
	query: componentPattern('query', true),
	fragment: componentPattern('fragment', true),
	userinfo: componentPattern('userinfo', true),
	regName: componentPattern('regName', true),
};
const ipvFuturePattern = new RegExp('^[vV][0-9A-Fa-f]+\\.[' + unreserved + subDelims + ':-]+' + ${JSON.stringify(exactEnd)}, 'u');
const portPattern = new RegExp('^[0-9]*' + ${JSON.stringify(exactEnd)}, 'u');
function isUri(value: string, relative: boolean, iri: boolean) {
	const patterns = iri ? iriPatterns : uriPatterns;
	const hashIndex = value.indexOf('#');
	if (hashIndex !== -1 && value.indexOf('#', hashIndex + 1) !== -1) return false;
	const beforeFragment = hashIndex === -1 ? value : value.slice(0, hashIndex);
	const fragment = hashIndex === -1 ? '' : value.slice(hashIndex + 1);
	if (!patterns.fragment.test(fragment)) return false;
	const queryIndex = beforeFragment.indexOf('?');
	const beforeQuery = queryIndex === -1 ? beforeFragment : beforeFragment.slice(0, queryIndex);
	const query = queryIndex === -1 ? '' : beforeFragment.slice(queryIndex + 1);
	if (!patterns.query.test(query)) return false;
	const colonIndex = beforeQuery.indexOf(':');
	const slashIndex = beforeQuery.indexOf('/');
	let hasScheme = false;
	let schemeEnd = 0;
	if (colonIndex !== -1 && (slashIndex === -1 || colonIndex < slashIndex)) {
		if (!/^[A-Za-z][A-Za-z0-9+.-]*$/.test(beforeQuery.slice(0, colonIndex))) return false;
		hasScheme = true;
		schemeEnd = colonIndex + 1;
	} else if (!relative) {
		return false;
	}
	const hierarchy = beforeQuery.slice(schemeEnd);
	if (hierarchy.startsWith('//')) {
		const pathStart = hierarchy.indexOf('/', 2);
		const authority = pathStart === -1 ? hierarchy.slice(2) : hierarchy.slice(2, pathStart);
		const path = pathStart === -1 ? '' : hierarchy.slice(pathStart);
		if (!isAuthority(authority, iri) || !patterns.path.test(path)) return false;
	} else if (!patterns.path.test(hierarchy)) {
		return false;
	}
	return true;
}
function isAuthority(authority: string, iri: boolean) {
	const patterns = iri ? iriPatterns : uriPatterns;
	const atIndex = authority.indexOf('@');
	let hostPort = authority;
	if (atIndex !== -1) {
		if (authority.indexOf('@', atIndex + 1) !== -1) return false;
		if (!patterns.userinfo.test(authority.slice(0, atIndex))) return false;
		hostPort = authority.slice(atIndex + 1);
	}
	if (hostPort.startsWith('[')) {
		const closeIndex = hostPort.indexOf(']');
		if (closeIndex === -1) return false;
		const host = hostPort.slice(1, closeIndex);
		const rest = hostPort.slice(closeIndex + 1);
		if (rest !== '' && (!rest.startsWith(':') || !portPattern.test(rest.slice(1)))) return false;
		return ipvFuturePattern.test(host) || isIPv6(host);
	}
	const colonIndex = hostPort.indexOf(':');
	if (colonIndex !== -1) {
		if (hostPort.indexOf(':', colonIndex + 1) !== -1) return false;
		if (!portPattern.test(hostPort.slice(colonIndex + 1))) return false;
		hostPort = hostPort.slice(0, colonIndex);
	}
	return patterns.regName.test(hostPort);
}`;

const uriTemplateRuntime = String.raw`
const pct = '%[0-9A-Fa-f]{2}';
const unreserved = 'A-Za-z0-9._~';
const subDelims = "!$&'()*+,;=";
const ucschar = '\\u{00A0}-\\u{D7FF}\\u{F900}-\\u{FDCF}\\u{FDF0}-\\u{FFEF}\\u{10000}-\\u{1FFFD}\\u{20000}-\\u{2FFFD}\\u{30000}-\\u{3FFFD}\\u{40000}-\\u{4FFFD}\\u{50000}-\\u{5FFFD}\\u{60000}-\\u{6FFFD}\\u{70000}-\\u{7FFFD}\\u{80000}-\\u{8FFFD}\\u{90000}-\\u{9FFFD}\\u{A0000}-\\u{AFFFD}\\u{B0000}-\\u{BFFFD}\\u{C0000}-\\u{CFFFD}\\u{D0000}-\\u{DFFFD}\\u{E1000}-\\u{EFFFD}';
const iprivate = '\\u{E000}-\\u{F8FF}\\u{F0000}-\\u{FFFFD}\\u{100000}-\\u{10FFFD}';
const literalToken = '[' + unreserved + subDelims + ':@/\\-]|' + pct + '|[' + ucschar + iprivate + ']';
const literalPattern = new RegExp('^(?:' + literalToken + ')*' + ${JSON.stringify(exactEnd)}, 'u');
const varcharToken = '[A-Za-z0-9_\\-]|' + pct + '|\\.';
function isUriTemplate(value: string) {
	let index = 0;
	while (index < value.length) {
		const open = value.indexOf('{', index);
		const close = value.indexOf('}', index);
		if (close !== -1 && (open === -1 || close < open)) return false;
		if (open === -1) return literalPattern.test(value.slice(index));
		if (!literalPattern.test(value.slice(index, open))) return false;
		const expressionEnd = value.indexOf('}', open + 1);
		if (expressionEnd === -1 || value.slice(open + 1, expressionEnd).includes('{')) return false;
		if (!isTemplateExpression(value.slice(open + 1, expressionEnd))) return false;
		index = expressionEnd + 1;
	}
	return true;
}
function isTemplateExpression(expression: string) {
	let body = expression;
	if (/^[+#./;?&]/.test(body)) body = body.slice(1);
	if (body === '') return false;
	const varcharPattern = new RegExp('^(?:' + varcharToken + ')+' + ${JSON.stringify(exactEnd)}, 'u');
	for (const varspec of body.split(',')) {
		if (varspec === '') return false;
		const modifierIndex = varspec.search(/[:*]/);
		const name = modifierIndex === -1 ? varspec : varspec.slice(0, modifierIndex);
		const modifier = modifierIndex === -1 ? '' : varspec.slice(modifierIndex);
		if (!varcharPattern.test(name) || name.startsWith('.') || name.endsWith('.') || name.includes('..')) return false;
		if (modifier === '' || modifier === '*') continue;
		if (/^:[1-9][0-9]{0,3}$/.test(modifier)) continue;
		return false;
	}
	return true;
}`;

const dateTimePattern = String.raw`^(${dateSource})[Tt]((?:[01]\d|2[0-3]):[0-5]\d):([0-5]\d|60)(?:\.\d+)?([zZ]|[+-](?:[01]\d|2[0-3]):[0-5]\d)${exactEnd}`;

const dateTimeBody = `
const match = new RegExp(${JSON.stringify(dateTimePattern)}, 'u').exec(value);
if (match === null) return false;
if (match[3] !== '60') return true;
const [hour, minute] = match[2].split(':').map(Number);
const zone = match[4];
const offset = zone.toLowerCase() === 'z' ? 0 : (zone[0] === '-' ? -1 : 1) * (Number(zone.slice(1, 3)) * 60 + Number(zone.slice(4, 6)));
return (hour * 60 + minute - offset + 1440) % 1440 === 23 * 60 + 59;`;

const regexBody = String.raw`
try {
	new RegExp(value, 'u');
	return true;
} catch {
	return false;
}`;

export function formatBody(format: string): string | undefined {
	switch (format) {
		case 'date-time':
			return dateTimeBody;
		case 'email':
		case 'idn-email':
			return `${emailRuntime}\n${ipRuntime}\n${hostnameRuntime}\nreturn isEmail(value, ${format === 'idn-email'});`;
		case 'hostname':
		case 'idn-hostname':
			return `${hostnameRuntime}\nreturn isHost(value, ${format === 'idn-hostname'});`;
		case 'iri':
		case 'iri-reference':
		case 'uri':
		case 'uri-reference':
			return `${ipRuntime}\n${uriRuntime}\nreturn isUri(value, ${format.endsWith('reference')}, ${format.startsWith('iri')});`;
		case 'uri-template':
			return `${uriTemplateRuntime}\nreturn isUriTemplate(value);`;
		case 'regex':
			return regexBody;
		default:
			return undefined;
	}
}
