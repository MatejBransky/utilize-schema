const INDENT = '\t';

export function indent(level: number): string {
	return INDENT.repeat(level);
}
