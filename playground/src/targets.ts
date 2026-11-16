export type TargetId = 'zod' | 'effect' | 'valibot';

export interface Target {
	value: TargetId;
	label: string;
	hint: string;
	disabled?: boolean;
}

export const targets: Target[] = [
	{ value: 'zod', label: 'Zod', hint: 'Available' },
	{ value: 'effect', label: 'Effect Schema', hint: 'Coming soon', disabled: true },
	{ value: 'valibot', label: 'Valibot', hint: 'Coming soon', disabled: true },
];

export const defaultTarget: TargetId = 'zod';

export function isTargetId(value: unknown): value is TargetId {
	return typeof value === 'string' && targets.some((target) => target.value === value);
}
