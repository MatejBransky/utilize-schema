import type { RuntimeIssue } from '../runtime';
import type { RuntimeTargetId } from '../targets';

/** JavaScript emitted for one generated validator. */
export interface ValidatorSource {
	javascript: string;
	/** Export that holds the root schema. */
	rootName: string;
}

export interface ValidationRequest {
	id: number;
	data: unknown;
	sources: Partial<Record<RuntimeTargetId, ValidatorSource>>;
}

/** A validator result that can cross the worker boundary. */
export interface ValidatorReport {
	ok: boolean;
	/** The decoded value as JSON. Defaults inserted by the generated schema show up here. */
	value?: string;
	issues: RuntimeIssue[];
	/** Set when the validator itself could not run. */
	error?: string;
}

export type ValidatorReports = Partial<Record<RuntimeTargetId, ValidatorReport>>;

export type ValidationResponse =
	| { id: number; reports: ValidatorReports }
	| { id: number; error: string };
