import type { DialectId } from './dialect';

/** A single meta-schema violation reported by a {@link SchemaValidator}. */
export interface SchemaValidationFinding {
	/** JSON Pointer into the document, such as `/properties/name`; empty for the root. */
	pointer: string;
	/** Human-readable problem, without the location. */
	message: string;
	/** Keyword that reported the finding, when the validator knows it. */
	keyword?: string;
}

/** The document a validator is checking, with the dialect the parser resolved for it. */
export interface SchemaValidationContext {
	/**
	 * Display path of the document: the file name for the root, the relative
	 * path for a referenced file, and the retrieval URI for a provided document.
	 */
	filePath: string;
	/**
	 * Dialect the parser resolved for the document root from `$schema`,
	 * `dialect` and reference inheritance. A document that embeds resources of
	 * another dialect is validated as a whole against this dialect.
	 */
	dialect: DialectId;
}

/**
 * Checks one resolved schema document against its dialect's meta-schema.
 *
 * Return every finding; `parse` throws a `SchemaValidationError` when any
 * document reports one. The callback keeps the core validator-agnostic: the
 * CLIs use the optional Ajv adapter from `@utilize/json-schema/validate/ajv`,
 * and callers can supply another validator instead.
 */
export type SchemaValidator = (
	schema: unknown,
	context: SchemaValidationContext
) => SchemaValidationFinding[] | Promise<SchemaValidationFinding[]>;

/** Adds the opt-in validation hook to compile and parse options. */
export interface SchemaValidationOptions {
	/** Runs on every resolved document before it is normalized. */
	validateSchema?: SchemaValidator;
}

/** The findings of one document, with the location and dialect they belong to. */
export interface SchemaValidationReport extends SchemaValidationContext {
	findings: SchemaValidationFinding[];
}

/** Thrown by `parse` when the validator reports at least one finding. */
export class SchemaValidationError extends Error {
	/** One report per document that failed validation. */
	readonly reports: SchemaValidationReport[];

	constructor(reports: SchemaValidationReport[]) {
		super(formatReports(reports));
		this.name = 'SchemaValidationError';
		this.reports = reports;
	}
}

function formatReports(reports: SchemaValidationReport[]): string {
	const lines: string[] = [];

	for (const report of reports) {
		if (report.findings.length === 0) {
			continue;
		}

		lines.push(`${report.filePath} is not a valid ${report.dialect} JSON Schema:`);

		for (const finding of report.findings) {
			lines.push(`  ${finding.pointer === '' ? '/' : finding.pointer} ${finding.message}`);
		}
	}

	return lines.join('\n');
}
