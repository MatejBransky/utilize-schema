const formatNameOverrides = new Map([['base64url', 'formatBase64Url']]);

/** Every format the targets know, kept in sync with the runtime validators. */
export const formatNames = [
	'date-time',
	'time',
	'uuid',
	'duration',
	'date',
	'email',
	'idn-email',
	'hostname',
	'hostname-legacy',
	'idn-hostname',
	'uri',
	'uri-reference',
	'iri',
	'iri-reference',
	'uri-template',
	'url',
	'json-pointer',
	'relative-json-pointer',
	'emoji',
	'base64',
	'base64url',
	'nanoid',
	'cuid',
	'cuid2',
	'ulid',
	'ipv4',
	'ipv6',
	'cidrv4',
	'cidrv6',
	'regex',
] as const;

/** `date-time` becomes `formatDateTime`, matching the runtime export. */
export function formatConstantBase(format: string): string {
	const override = formatNameOverrides.get(format);

	if (override !== undefined) {
		return override;
	}

	const pascal = format.replaceAll(/[^a-zA-Z0-9]+(.)?/g, (_, next: string | undefined) =>
		next === undefined ? '' : next.toUpperCase()
	);

	return `format${pascal.charAt(0).toUpperCase()}${pascal.slice(1)}`;
}
