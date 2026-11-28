export type TargetId = 'zod' | 'effect' | 'typescript';

export type RuntimeTargetId = Extract<TargetId, 'zod' | 'effect'>;

export const runtimeTargetIds: readonly RuntimeTargetId[] = ['zod', 'effect'];

export interface Target {
	value: TargetId;
	label: string;
	disabled?: boolean;
}

export const targets: Target[] = [
	{ value: 'zod', label: 'Zod' },
	{ value: 'effect', label: 'Effect Schema' },
	{ value: 'typescript', label: 'TypeScript' },
];

export const defaultTarget: TargetId = 'zod';

export function isTargetId(value: unknown): value is TargetId {
	return typeof value === 'string' && targets.some((target) => target.value === value);
}

export function isRuntimeTarget(value: TargetId): value is RuntimeTargetId {
	return value === 'zod' || value === 'effect';
}
