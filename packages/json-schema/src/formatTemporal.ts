import { dateSource, exactEnd } from './formatSources';

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

const uuidPattern = new RegExp(
	`^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}${exactEnd}`,
	'u'
);

/** JSON Schema `uuid` shape, preserving the official suite's acceptance rules. */
export function formatUuid(value: string): boolean {
	return uuidPattern.test(value);
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
