import { dateSource, exactEnd } from './formatSources';

const jsonPointerPattern = new RegExp(`^(?:\\/(?:[^~]|~[01])*)?${exactEnd}`, 'u');
const relativeJsonPointerPattern = new RegExp(
	`^(?:0|[1-9][0-9]*)(?:#|\\/(?:[^~]|~[01])*)?${exactEnd}`,
	'u'
);
const emojiPattern = new RegExp(
	String.raw`^(?=[\s\S]*[\p{Extended_Pictographic}\p{Regional_Indicator}\u20E3])[\p{Extended_Pictographic}\p{Emoji_Component}]+$`,
	'u'
);
const base64Pattern = new RegExp(
	String.raw`^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$`,
	'u'
);
const base64UrlPattern = new RegExp(
	String.raw`^(?:[A-Za-z0-9_-]{4})*(?:[A-Za-z0-9_-]{2,3})?$`,
	'u'
);
const nanoidPattern = new RegExp(String.raw`^[A-Za-z0-9_-]{21}$`, 'u');
const cuidPattern = new RegExp(String.raw`^c[^\s-]{8,}$`, 'u');
const cuid2Pattern = new RegExp(String.raw`^[a-z][a-z0-9]*$`, 'u');
const ulidPattern = new RegExp(String.raw`^[0-9A-HJKMNP-TV-Z]{26}$`, 'u');
const cidrv4Pattern = new RegExp(
	String.raw`^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)/(?:3[0-2]|[12]?\d)$`,
	'u'
);
const datePattern = new RegExp(`^${dateSource}${exactEnd}`, 'u');

export function formatJsonPointer(value: string): boolean {
	return jsonPointerPattern.test(value);
}

export function formatRelativeJsonPointer(value: string): boolean {
	return relativeJsonPointerPattern.test(value);
}

export function formatEmoji(value: string): boolean {
	return emojiPattern.test(value);
}

export function formatBase64(value: string): boolean {
	return base64Pattern.test(value);
}

export function formatBase64Url(value: string): boolean {
	return base64UrlPattern.test(value);
}

export function formatNanoid(value: string): boolean {
	return nanoidPattern.test(value);
}

export function formatCuid(value: string): boolean {
	return cuidPattern.test(value);
}

export function formatCuid2(value: string): boolean {
	return cuid2Pattern.test(value);
}

export function formatUlid(value: string): boolean {
	return ulidPattern.test(value);
}

export function formatCidrv4(value: string): boolean {
	return cidrv4Pattern.test(value);
}

export function formatCidrv6(value: string): boolean {
	const [address, prefix] = value.split('/');

	if (
		address === undefined ||
		prefix === undefined ||
		!/^\d{1,3}$/.test(prefix) ||
		Number(prefix) > 128
	) {
		return false;
	}

	if (/[\]/?#\s]/.test(address)) {
		return false;
	}

	try {
		new URL(`http://[${address}]`);
		return true;
	} catch {
		return false;
	}
}

export function formatDate(value: string): boolean {
	return datePattern.test(value);
}

export function formatUrl(value: string): boolean {
	try {
		new URL(value);
		return true;
	} catch {
		return false;
	}
}
