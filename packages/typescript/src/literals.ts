/** Single-quoted string literal, matching the repository's code style. */
export function stringLiteral(value: string): string {
	const json = JSON.stringify(value);

	return `'${json
		.slice(1, -1)
		.replaceAll(String.raw`\"`, '"')
		.replaceAll("'", String.raw`\'`)}'`;
}

/**
 * Text for the static part of a template literal type. A backslash, backtick or
 * `${` would otherwise start an escape or an interpolation.
 */
export function escapeTemplateText(value: string): string {
	return value
		.replaceAll('\\', String.raw`\\`)
		.replaceAll('`', String.raw`\``)
		.replaceAll('${', String.raw`\${`)
		.replaceAll('\0', String.raw`\0`)
		.replaceAll('\n', String.raw`\n`)
		.replaceAll('\r', String.raw`\r`)
		.replaceAll('\t', String.raw`\t`)
		.replaceAll('\f', String.raw`\f`)
		.replaceAll('\v', String.raw`\v`);
}
