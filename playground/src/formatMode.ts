export type FormatMode = 'annotate' | 'assert';

export const formatModes: Array<{ value: FormatMode; label: string; hint: string }> = [
	{ value: 'annotate', label: 'Annotate', hint: 'Keep format as metadata' },
	{ value: 'assert', label: 'Assert', hint: 'Validate known formats' },
];

export const defaultFormatMode: FormatMode = 'assert';

export function isFormatMode(value: unknown): value is FormatMode {
	return value === 'annotate' || value === 'assert';
}
