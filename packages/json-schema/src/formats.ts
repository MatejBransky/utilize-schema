/**
 * Runtime validators for the JSON Schema formats that need structural
 * validation rather than a single regular expression.
 *
 * Generated Zod and Effect schemas import these instead of inlining a copy of
 * each validator, so a file that asserts a few formats stays small.
 */

/** Returns whether `value` satisfies a JSON Schema `format`. */
export type FormatValidator = (value: string) => boolean;

const exactEnd = String.raw`(?![\s\S])`;
const dateSource = String.raw`(?:(?:\d\d[2468][048]|\d\d[13579][26]|\d\d0[48]|[02468][048]00|[13579][26]00)-02-29|\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\d|30)|(?:02)-(?:0[1-9]|1\d|2[0-8])))`;

const dateTimePattern = new RegExp(
	`^(${dateSource})[Tt]((?:[01]\\d|2[0-3]):[0-5]\\d):([0-5]\\d|60)(?:\\.\\d+)?([zZ]|[+-](?:[01]\\d|2[0-3]):[0-5]\\d)${exactEnd}`,
	'u'
);

const timePattern = new RegExp(
	`^((?:[01]\\d|2[0-3]):[0-5]\\d):([0-5]\\d|60)(?:\\.\\d+)?([zZ]|[+-](?:[01]\\d|2[0-3]):[0-5]\\d)${exactEnd}`,
	'u'
);

/**
 * `60` names the second that is `23:59:60` in UTC, so the value's own offset
 * decides whether a local time spells it: `15:59:60-08:00` does,
 * `23:59:60+01:00` does not.
 */
function matchesLeapSecond(
	match: RegExpExecArray,
	hourMinuteGroup: number,
	secondsGroup: number,
	zoneGroup: number
): boolean {
	if (match[secondsGroup] !== '60') {
		return true;
	}

	const hourMinute = match[hourMinuteGroup] ?? '';
	const rawOffset = match[zoneGroup] ?? '';
	const hour = Number(hourMinute.slice(0, 2));
	const minute = Number(hourMinute.slice(3, 5));
	const offset =
		rawOffset.toLowerCase() === 'z'
			? 0
			: (rawOffset[0] === '-' ? -1 : 1) *
				(Number(rawOffset.slice(1, 3)) * 60 + Number(rawOffset.slice(4, 6)));

	return (hour * 60 + minute - offset + 1440) % 1440 === 23 * 60 + 59;
}

/** RFC 3339 `date-time`, including calendar dates and leap seconds. */
export function formatDateTime(value: string): boolean {
	const match = dateTimePattern.exec(value);

	return match !== null && matchesLeapSecond(match, 2, 3, 4);
}

/** RFC 3339 `time`, which requires an offset. */
export function formatTime(value: string): boolean {
	const match = timePattern.exec(value);

	return match !== null && matchesLeapSecond(match, 1, 2, 3);
}

/** RFC 3339 duration syntax, including its ordering and component dependencies. */
export function formatDuration(value: string): boolean {
	const match =
		/^P(?:(\d+)W|(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?(?:T(?=\d)(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?)$/.exec(
			value
		);

	if (match === null) {
		return false;
	}

	if (match[1] !== undefined) {
		return true;
	}

	if (match.slice(2).every((part) => part === undefined)) {
		return false;
	}

	if (match[2] !== undefined && match[3] === undefined && match[4] !== undefined) {
		return false;
	}

	if (match[5] !== undefined && match[6] === undefined && match[7] !== undefined) {
		return false;
	}

	return true;
}

const ipv4Part = String.raw`(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)`;
const ipv4Pattern = new RegExp(`^${ipv4Part}(?:\\.${ipv4Part}){3}${exactEnd}`, 'u');

function isIPv4(value: string): boolean {
	return ipv4Pattern.test(value);
}

function isIPv6(value: string): boolean {
	if (/[\]/?#\s%]/.test(value)) {
		return false;
	}

	try {
		new URL(`http://[${value}]`);
		return true;
	} catch {
		return false;
	}
}

const hostnameLabelPattern = new RegExp(
	`^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?${exactEnd}`,
	'u'
);
const disallowedIdnaPattern = /[\u0640\u07FA\u302E\u302F\u3031-\u3035\u303B]/u;
const combiningMarkPattern = /^\p{M}/u;
const rtlLetterPattern =
	/(?=\p{L})(?:\p{Script=Hebrew}|\p{Script=Arabic}|\p{Script=Syriac}|\p{Script=Thaana}|\p{Script=Nko}|\p{Script=Samaritan}|\p{Script=Mandaic}|\p{Script=Adlam})/u;
const ltrLetterPattern = /^\p{L}/u;
const rtlAnyPattern = new RegExp(`(?:${rtlLetterPattern.source}|[\u0660-\u0669])`, 'u');
const extendedEuropeanDigitPattern = /[0-9\u06F0-\u06F9]/;
const arabicDigitPattern = /[\u0660-\u0669]/;
const extendedArabicDigitPattern = /[\u06F0-\u06F9]/;
const viramaPattern = /[\u094D\u09CD\u0A4D\u0ACD\u0B4D\u0BCD\u0C4D\u0CCD\u0D4D\u0DCA]/u;
const joiningContextPattern = /[\u0621-\u063A\u0640-\u064A]\u200C[\u0621-\u063A\u0640-\u064A]/u;

function isHost(value: string, idn: boolean, aLabelRules: boolean): boolean {
	const hostname = hostnameFor(value, idn);

	return hostname !== undefined && isHostname(hostname, aLabelRules);
}

function hostnameFor(value: string, idn: boolean): string | undefined {
	if (!idn) {
		return value.length > 253 || !/^[A-Za-z0-9.-]+$/.test(value) ? undefined : value;
	}

	if (value === '' || /[\s\u0000-\u0020\u007F/\\?#@:[\]%]/.test(value)) {
		return undefined;
	}

	try {
		return new URL(`http://${value}`).hostname;
	} catch {
		return undefined;
	}
}

function isHostname(hostname: string, aLabelRules: boolean): boolean {
	if (hostname.length > 253 || hostname.endsWith('.')) {
		return false;
	}

	const labels = hostname.split('.');

	if (
		labels.some(
			(label) => !hostnameLabelPattern.test(label) || (aLabelRules && !isAsciiIdnaLabel(label))
		)
	) {
		return false;
	}

	if (!aLabelRules) {
		return true;
	}

	const decoded = labels.map((label) =>
		label.startsWith('xn--') ? decodePunycode(label.slice(4)) : label
	);

	if (decoded.some((label) => label === null)) {
		return false;
	}

	const bidi = decoded.some((label) => label !== null && rtlAnyPattern.test(label));

	return !bidi || decoded.every((label) => label !== null && isBidiLabel(label));
}

function isAsciiIdnaLabel(label: string): boolean {
	const lower = label.toLowerCase();

	if (lower.startsWith('xn--')) {
		return isALabel(lower);
	}

	return !(label.length >= 4 && label.slice(2, 4) === '--');
}

function isALabel(label: string): boolean {
	if (!label.startsWith('xn--') || label.length <= 4) {
		return false;
	}

	const decoded = decodePunycode(label.slice(4));

	return decoded !== null && isDecodedALabel(decoded, label);
}

function isDecodedALabel(decoded: string, label: string): boolean {
	if (!/[^\u0000-\u007F]/.test(decoded)) {
		return false;
	}

	if (decoded.normalize('NFC') !== decoded || combiningMarkPattern.test(decoded)) {
		return false;
	}

	const structural = decoded.replaceAll(
		/[\u200C\u200D\u00B7\u0375\u05F3\u05F4\u30FB\u06FD\u06FE\u0F0B\u3007-]/g,
		''
	);

	if (disallowedIdnaPattern.test(decoded) || /[\p{C}\p{Z}\p{P}\p{S}]/u.test(structural)) {
		return false;
	}

	if (!isIdnaContext(decoded)) {
		return false;
	}

	try {
		return new URL(`http://${decoded}`).hostname === label;
	} catch {
		return false;
	}
}

function decodePunycode(input: string): string | null {
	const delimiter = input.lastIndexOf('-');
	const basic = delimiter === -1 ? '' : input.slice(0, delimiter);

	if (Array.from(basic).some((char) => (char.codePointAt(0) ?? 0) >= 128)) {
		return null;
	}

	const output = Array.from(basic);
	let position = basic.length + (delimiter === -1 ? 0 : 1);
	let index = 0;
	let n = 128;
	let bias = 72;

	while (position < input.length) {
		const oldIndex = index;
		const decoded = decodePunycodeDelta(input, position, index, bias);

		if (decoded === undefined) {
			return null;
		}

		index = decoded.delta;
		position = decoded.position;

		const length = output.length + 1;
		bias = adaptBias(index - oldIndex, length, oldIndex === 0);
		n += Math.floor(index / length);
		index %= length;

		// U+10FFFF, the highest Unicode code point.
		if (n > 1_114_111) {
			return null;
		}

		output.splice(index++, 0, String.fromCodePoint(n));
	}

	return output.join('');
}

function decodePunycodeDelta(
	input: string,
	start: number,
	startIndex: number,
	bias: number
): { delta: number; position: number } | undefined {
	let delta = startIndex;
	let weight = 1;
	let position = start;

	for (let key = 36; ; key += 36) {
		if (position >= input.length) {
			return undefined;
		}

		const digit = punycodeDigit(input.charCodeAt(position++));

		if (digit === undefined) {
			return undefined;
		}

		delta += digit * weight;

		const threshold = key <= bias ? 1 : key >= bias + 26 ? 26 : key - bias;

		if (digit < threshold) {
			return { delta, position };
		}

		weight *= 36 - threshold;
	}
}

function punycodeDigit(code: number): number | undefined {
	if (code >= 65 && code <= 90) {
		return code - 65;
	}

	if (code >= 97 && code <= 122) {
		return code - 97;
	}

	if (code >= 48 && code <= 57) {
		return code - 22;
	}

	return undefined;
}

function adaptBias(delta: number, points: number, firstTime: boolean): number {
	delta = firstTime ? Math.floor(delta / 700) : delta >> 1;
	delta += Math.floor(delta / points);

	let key = 0;

	while (delta > 455) {
		delta /= 35;
		key += 36;
	}

	return key + Math.floor((36 * delta) / (delta + 38));
}

function isIdnaContext(label: string): boolean {
	if (label.length >= 4 && label.slice(2, 4) === '--') {
		return false;
	}

	if (arabicDigitPattern.test(label) && extendedArabicDigitPattern.test(label)) {
		return false;
	}

	return hasValidIdnaPunctuation(label) && hasValidIdnaJoiners(label);
}

function hasValidIdnaPunctuation(label: string): boolean {
	if (label.includes('\u00B7') && !/l\u00B7l/.test(label)) {
		return false;
	}

	if (label.includes('\u0375') && !/\u0375\p{Script=Greek}/u.test(label)) {
		return false;
	}

	if (/[\u05F3\u05F4]/.test(label) && !/\p{Script=Hebrew}[\u05F3\u05F4]/u.test(label)) {
		return false;
	}

	return (
		!label.includes('\u30FB') ||
		/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(label)
	);
}

function hasValidIdnaJoiners(label: string): boolean {
	for (let index = 0; index < label.length; index++) {
		if (
			label[index] === '\u200D' &&
			(index === 0 || !viramaPattern.test(label.charAt(index - 1)))
		) {
			return false;
		}

		if (label[index] === '\u200C' && !isIdnaZwnjContext(label, index)) {
			return false;
		}
	}

	return true;
}

function isIdnaZwnjContext(label: string, index: number): boolean {
	if (index > 0 && viramaPattern.test(label.charAt(index - 1))) {
		return true;
	}

	return joiningContextPattern.test(label.slice(Math.max(0, index - 1), index + 2));
}

function isBidiLabel(label: string): boolean {
	const first = Array.from(label)[0] ?? '';
	const last = Array.from(label).at(-1) ?? '';

	if (rtlLetterPattern.test(first)) {
		return isRtlLabel(label, last);
	}

	if (ltrLetterPattern.test(first)) {
		return isLtrLabel(label, last);
	}

	return false;
}

function isRtlLabel(label: string, last: string): boolean {
	if (
		!rtlLetterPattern.test(last) &&
		!extendedEuropeanDigitPattern.test(last) &&
		!arabicDigitPattern.test(last)
	) {
		return false;
	}

	return !(extendedEuropeanDigitPattern.test(label) && arabicDigitPattern.test(label));
}

function isLtrLabel(label: string, last: string): boolean {
	return (
		!rtlAnyPattern.test(label) &&
		(ltrLetterPattern.test(last) || extendedEuropeanDigitPattern.test(last))
	);
}

const emailAtext = /[A-Za-z0-9!#$%&'*+\-/=?^_\u0060{|}~]/;
const emailAtomPattern = new RegExp(
	`^${emailAtext.source}+(?:\\.${emailAtext.source}+)*${exactEnd}`,
	'u'
);
const emailDomainPattern = new RegExp(
	`^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*${exactEnd}`,
	'u'
);
const idnLocalAtext = new RegExp(`^(?:${emailAtext.source}|[^\\u0000-\\u007F])+$`, 'u');
const idnQuotedChar = /^(?:[\u0020-\u0021\u0023-\u005B\u005D-\u007F]|[^\u0000-\u007F])$/u;

interface EmailParts {
	local: string;
	domain: string;
}

function isEmail(value: string, idn: boolean): boolean {
	if (!idn && /[^\u0000-\u007F]/.test(value)) {
		return false;
	}

	const parts = splitEmail(value, idn);

	if (parts === undefined) {
		return false;
	}

	const { local, domain } = parts;

	if (domain === '' || new TextEncoder().encode(local).byteLength > 64) {
		return false;
	}

	if (domain.startsWith('[')) {
		return isEmailDomainLiteral(domain);
	}

	return idn ? isHost(domain, true, true) : emailDomainPattern.test(domain);
}

function splitEmail(value: string, idn: boolean): EmailParts | undefined {
	return value.startsWith('"') ? splitQuotedEmail(value, idn) : splitPlainEmail(value, idn);
}

function splitQuotedEmail(value: string, idn: boolean): EmailParts | undefined {
	const close = quotedLocalEnd(value, idn);

	if (close === -1 || value[close + 1] !== '@') {
		return undefined;
	}

	return { local: value.slice(0, close + 1), domain: value.slice(close + 2) };
}

/** Index of the closing quote, or `-1` when the quoted local part is not terminated. */
function quotedLocalEnd(value: string, idn: boolean): number {
	let escaped = false;

	for (let index = 1; index < value.length; index++) {
		const char = value.charAt(index);

		if (escaped) {
			if (!idn && !isAsciiQuotedChar(char)) {
				return -1;
			}

			escaped = false;
		} else if (char === '\\') {
			escaped = true;
		} else if (char === '"') {
			return index;
		} else if (!isQuotedEmailChar(char, idn)) {
			return -1;
		}
	}

	return -1;
}

function isQuotedEmailChar(char: string, idn: boolean): boolean {
	return idn ? idnQuotedChar.test(char) : isAsciiQuotedChar(char);
}

function isAsciiQuotedChar(char: string): boolean {
	return char.charCodeAt(0) >= 32 && char.charCodeAt(0) <= 126;
}

function splitPlainEmail(value: string, idn: boolean): EmailParts | undefined {
	const at = value.indexOf('@');

	if (at <= 0 || value.indexOf('@', at + 1) !== -1) {
		return undefined;
	}

	const local = value.slice(0, at);
	const atoms = local.split('.');

	if (
		atoms.some(
			(atom) => atom === '' || !(idn ? idnLocalAtext.test(atom) : emailAtomPattern.test(atom))
		)
	) {
		return undefined;
	}

	return { local, domain: value.slice(at + 1) };
}

function isEmailDomainLiteral(domain: string): boolean {
	if (!domain.endsWith(']')) {
		return false;
	}

	const literal = domain.slice(1, -1);

	if (/^ipv6:/i.test(literal)) {
		return isIPv6(literal.slice(5));
	}

	return isIPv4(literal);
}

const pct = '%[0-9A-Fa-f]{2}';
const unreserved = 'A-Za-z0-9._~';
const subDelims = "!$&'()*+,;=";
const ucschar = String.raw`\u{00A0}-\u{D7FF}\u{F900}-\u{FDCF}\u{FDF0}-\u{FFEF}\u{10000}-\u{1FFFD}\u{20000}-\u{2FFFD}\u{30000}-\u{3FFFD}\u{40000}-\u{4FFFD}\u{50000}-\u{5FFFD}\u{60000}-\u{6FFFD}\u{70000}-\u{7FFFD}\u{80000}-\u{8FFFD}\u{90000}-\u{9FFFD}\u{A0000}-\u{AFFFD}\u{B0000}-\u{BFFFD}\u{C0000}-\u{CFFFD}\u{D0000}-\u{DFFFD}\u{E1000}-\u{EFFFD}`;
const iprivate = String.raw`\u{E000}-\u{F8FF}\u{F0000}-\u{FFFFD}\u{100000}-\u{10FFFD}`;

type ComponentKind = 'path' | 'query' | 'fragment' | 'userinfo' | 'regName';

function componentPattern(kind: ComponentKind, iri: boolean): RegExp {
	const extra = iri ? ucschar : '';
	const chars = unreserved + subDelims + extra + '-';

	return new RegExp(`^(?:[${chars}]|${pct}${componentSuffix(kind, iri)})*${exactEnd}`, 'u');
}

function componentSuffix(kind: ComponentKind, iri: boolean): string {
	const queryExtra = (kind === 'query' || kind === 'fragment') && iri ? `|[${iprivate}]` : '';

	return componentKindSuffix(kind) + queryExtra;
}

function componentKindSuffix(kind: ComponentKind): string {
	switch (kind) {
		case 'path': {
			return '|[:@]|/';
		}
		case 'query':
		case 'fragment': {
			return '|[:@]|[/?]';
		}
		case 'userinfo': {
			return '|:';
		}
		case 'regName': {
			return '';
		}
	}
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
const ipvFuturePattern = new RegExp(
	`^[vV][0-9A-Fa-f]+\\.[${unreserved}${subDelims}:-]+${exactEnd}`,
	'u'
);
const portPattern = new RegExp(`^[0-9]*${exactEnd}`, 'u');

function isUri(value: string, relative: boolean, iri: boolean): boolean {
	const patterns = iri ? iriPatterns : uriPatterns;
	const parts = splitUri(value);

	if (parts === undefined) {
		return false;
	}

	if (!patterns.fragment.test(parts.fragment) || !patterns.query.test(parts.query)) {
		return false;
	}

	const schemeEnd = schemeEndFor(parts.beforeQuery, relative);

	return schemeEnd !== undefined && isHierarchy(parts.beforeQuery.slice(schemeEnd), iri);
}

function splitUri(
	value: string
): { beforeQuery: string; query: string; fragment: string } | undefined {
	const hashIndex = value.indexOf('#');

	if (hashIndex !== -1 && value.indexOf('#', hashIndex + 1) !== -1) {
		return undefined;
	}

	const beforeFragment = hashIndex === -1 ? value : value.slice(0, hashIndex);
	const fragment = hashIndex === -1 ? '' : value.slice(hashIndex + 1);
	const queryIndex = beforeFragment.indexOf('?');
	const beforeQuery = queryIndex === -1 ? beforeFragment : beforeFragment.slice(0, queryIndex);
	const query = queryIndex === -1 ? '' : beforeFragment.slice(queryIndex + 1);

	return { beforeQuery, query, fragment };
}

function schemeEndFor(beforeQuery: string, relative: boolean): number | undefined {
	const colonIndex = beforeQuery.indexOf(':');
	const slashIndex = beforeQuery.indexOf('/');

	if (colonIndex !== -1 && (slashIndex === -1 || colonIndex < slashIndex)) {
		return /^[A-Za-z][A-Za-z0-9+.-]*$/.test(beforeQuery.slice(0, colonIndex))
			? colonIndex + 1
			: undefined;
	}

	return relative ? 0 : undefined;
}

function isHierarchy(hierarchy: string, iri: boolean): boolean {
	const patterns = iri ? iriPatterns : uriPatterns;

	if (!hierarchy.startsWith('//')) {
		return patterns.path.test(hierarchy);
	}

	const pathStart = hierarchy.indexOf('/', 2);
	const authority = pathStart === -1 ? hierarchy.slice(2) : hierarchy.slice(2, pathStart);
	const path = pathStart === -1 ? '' : hierarchy.slice(pathStart);

	return isAuthority(authority, iri) && patterns.path.test(path);
}

function isAuthority(authority: string, iri: boolean): boolean {
	const patterns = iri ? iriPatterns : uriPatterns;
	const hostPort = authorityHost(authority, patterns.userinfo);

	if (hostPort === undefined) {
		return false;
	}

	return hostPort.startsWith('[')
		? isBracketedHost(hostPort)
		: isRegNameHost(hostPort, patterns.regName);
}

function authorityHost(authority: string, userinfoPattern: RegExp): string | undefined {
	const atIndex = authority.indexOf('@');

	if (atIndex === -1) {
		return authority;
	}

	if (authority.indexOf('@', atIndex + 1) !== -1) {
		return undefined;
	}

	return userinfoPattern.test(authority.slice(0, atIndex))
		? authority.slice(atIndex + 1)
		: undefined;
}

function isBracketedHost(hostPort: string): boolean {
	const closeIndex = hostPort.indexOf(']');

	if (closeIndex === -1) {
		return false;
	}

	const host = hostPort.slice(1, closeIndex);
	const rest = hostPort.slice(closeIndex + 1);

	if (rest !== '' && (!rest.startsWith(':') || !portPattern.test(rest.slice(1)))) {
		return false;
	}

	return ipvFuturePattern.test(host) || isIPv6(host);
}

function isRegNameHost(hostPort: string, regNamePattern: RegExp): boolean {
	const colonIndex = hostPort.indexOf(':');

	if (colonIndex === -1) {
		return regNamePattern.test(hostPort);
	}

	if (
		hostPort.indexOf(':', colonIndex + 1) !== -1 ||
		!portPattern.test(hostPort.slice(colonIndex + 1))
	) {
		return false;
	}

	return regNamePattern.test(hostPort.slice(0, colonIndex));
}

const literalToken = `[${unreserved}${subDelims}:@/\\-]|${pct}|[${ucschar}${iprivate}]`;
const literalPattern = new RegExp(`^(?:${literalToken})*${exactEnd}`, 'u');
const varcharToken = `[A-Za-z0-9_]|${pct}|\\.`;
const varcharPattern = new RegExp(`^(?:${varcharToken})+${exactEnd}`, 'u');

/** RFC 6570 `uri-template`. */
export function formatUriTemplate(value: string): boolean {
	let index = 0;

	while (index < value.length) {
		const open = value.indexOf('{', index);
		const close = value.indexOf('}', index);

		if (close !== -1 && (open === -1 || close < open)) {
			return false;
		}

		if (open === -1) {
			return literalPattern.test(value.slice(index));
		}

		if (!literalPattern.test(value.slice(index, open))) {
			return false;
		}

		const expressionEnd = value.indexOf('}', open + 1);

		if (expressionEnd === -1 || value.slice(open + 1, expressionEnd).includes('{')) {
			return false;
		}

		if (!isTemplateExpression(value.slice(open + 1, expressionEnd))) {
			return false;
		}

		index = expressionEnd + 1;
	}

	return true;
}

function isTemplateExpression(expression: string): boolean {
	const body = expression.replace(/^[+#./;?&]/, '');

	if (body === '') {
		return false;
	}

	return body.split(',').every(isVarspec);
}

function isVarspec(varspec: string): boolean {
	if (varspec === '') {
		return false;
	}

	const modifierIndex = varspec.search(/[:*]/);
	const name = modifierIndex === -1 ? varspec : varspec.slice(0, modifierIndex);
	const modifier = modifierIndex === -1 ? '' : varspec.slice(modifierIndex);

	return hasValidVarspecName(name) && hasValidVarspecModifier(modifier);
}

function hasValidVarspecName(name: string): boolean {
	return (
		varcharPattern.test(name) &&
		!name.startsWith('.') &&
		!name.endsWith('.') &&
		!name.includes('..')
	);
}

function hasValidVarspecModifier(modifier: string): boolean {
	return modifier === '' || modifier === '*' || /^:[1-9][0-9]{0,3}$/.test(modifier);
}

/** A valid ECMAScript regular expression in unicode mode. */
export function formatRegex(value: string): boolean {
	try {
		new RegExp(value, 'u');
		return true;
	} catch {
		return false;
	}
}

export function formatEmail(value: string): boolean {
	return isEmail(value, false);
}

export function formatIdnEmail(value: string): boolean {
	return isEmail(value, true);
}

export function formatHostname(value: string): boolean {
	return isHost(value, false, true);
}

/** Hostname rules used by draft-04 and draft-06, before IDNA A-label checks. */
export function formatHostnameLegacy(value: string): boolean {
	return isHost(value, false, false);
}

export function formatIdnHostname(value: string): boolean {
	return isHost(value, true, true);
}

export function formatUri(value: string): boolean {
	return isUri(value, false, false);
}

export function formatUriReference(value: string): boolean {
	return isUri(value, true, false);
}

export function formatIri(value: string): boolean {
	return isUri(value, false, true);
}

export function formatIriReference(value: string): boolean {
	return isUri(value, true, true);
}

/** Every structural format validator, keyed by JSON Schema `format`. */
export const formats = {
	'date-time': formatDateTime,
	time: formatTime,
	duration: formatDuration,
	email: formatEmail,
	'idn-email': formatIdnEmail,
	hostname: formatHostname,
	'hostname-legacy': formatHostnameLegacy,
	'idn-hostname': formatIdnHostname,
	uri: formatUri,
	'uri-reference': formatUriReference,
	iri: formatIri,
	'iri-reference': formatIriReference,
	'uri-template': formatUriTemplate,
	regex: formatRegex,
} satisfies Record<string, FormatValidator>;
