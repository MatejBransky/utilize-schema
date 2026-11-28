export function propertyKey(key: string): string {
	return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : stringLiteral(key);
}

/** Single-quoted string literal, matching the repository's code style. */
export function stringLiteral(value: string): string {
	const json = JSON.stringify(value);

	return `'${json
		.slice(1, -1)
		.replaceAll(String.raw`\"`, '"')
		.replaceAll("'", String.raw`\'`)}'`;
}

export function escapeComment(text: string): string {
	return text.replaceAll('*/', String.raw`*\/`);
}
