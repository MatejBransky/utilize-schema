import type { RuntimeIssue } from '../runtime';
import type { RuntimeTargetId } from '../targets';

export interface ValidatorSource {
	javascript: string;
	rootName: string;
}

export interface ValidationRequest {
	id: number;
	data: unknown;
	sources: Partial<Record<RuntimeTargetId, ValidatorSource>>;
}

export interface ValidatorReport {
	ok: boolean;
	value?: string;
	issues: RuntimeIssue[];
	error?: string;
}

export type ValidatorReports = Partial<Record<RuntimeTargetId, ValidatorReport>>;

export type ValidationResponse =
	| { id: number; type: 'started' }
	| { id: number; reports: ValidatorReports }
	| { id: number; error: string };
