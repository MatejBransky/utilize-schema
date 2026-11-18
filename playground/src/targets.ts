export type TargetId = 'zod' | 'effect' | 'typescript';

/** Targets whose generated code is a runtime validator the playground can run. */
export type RuntimeTargetId = Extract<TargetId, 'zod' | 'effect'>;

export interface Target {
	value: TargetId;
	label: string;
	hint: string;
	disabled?: boolean;
}

export const targets: Target[] = [
	{ value: 'zod', label: 'Zod', hint: 'Available' },
	{ value: 'effect', label: 'Effect Schema', hint: 'Available' },
	{ value: 'typescript', label: 'TypeScript', hint: 'Types only' },
];

export const defaultTarget: TargetId = 'zod';

export function isTargetId(value: unknown): value is TargetId {
	return typeof value === 'string' && targets.some((target) => target.value === value);
}
