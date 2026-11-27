import { Schema } from 'effect';

export const Target = Schema.Literals(['zod', 'effect', 'typescript']);
export const KeywordPolicySchema = Schema.Literals(['error', 'warn', 'ignore']);
export const FormatModeSchema = Schema.Literals(['annotate', 'assert']);
const ColorMode = Schema.Literals(['auto', 'light', 'dark']);

export const SchemaFileModel = Schema.Struct({
	id: Schema.String,
	name: Schema.String,
	content: Schema.String,
});

export const ProblemModel = Schema.Struct({
	severity: Schema.Literals(['error', 'warning']),
	message: Schema.String,
	fileId: Schema.optional(Schema.String),
	line: Schema.optional(Schema.Number),
	column: Schema.optional(Schema.Number),
});

export const RuntimeModel = Schema.Union([
	Schema.Struct({
		status: Schema.Literal('generated'),
		code: Schema.String,
		runtimeCode: Schema.String,
		rootName: Schema.optional(Schema.String),
	}),
	Schema.Struct({
		status: Schema.Literal('failed'),
		message: Schema.String,
	}),
]);

export type RuntimeModel = typeof RuntimeModel.Type;

const IssueModel = Schema.Struct({ path: Schema.String, message: Schema.String });

const ReportModel = Schema.Struct({
	ok: Schema.Boolean,
	value: Schema.optional(Schema.String),
	issues: Schema.Array(IssueModel),
	error: Schema.optional(Schema.String),
});

export const ValidationModel = Schema.Union([
	Schema.Struct({ status: Schema.Literal('running') }),
	Schema.Struct({ status: Schema.Literal('unavailable'), reason: Schema.String }),
	Schema.Struct({ status: Schema.Literal('invalid-json'), message: Schema.String }),
	Schema.Struct({ status: Schema.Literal('error'), message: Schema.String }),
	Schema.Struct({ status: Schema.Literal('ready'), result: ReportModel }),
]);

export const AppModel = Schema.Struct({
	files: Schema.Array(SchemaFileModel),
	activeId: Schema.String,
	editingId: Schema.NullOr(Schema.String),
	draftName: Schema.String,
	renameError: Schema.NullOr(Schema.String),
	target: Target,
	keywordPolicy: KeywordPolicySchema,
	formatMode: FormatModeSchema,
	data: Schema.String,
	code: Schema.String,
	runtime: Schema.NullOr(RuntimeModel),
	generationProblems: Schema.Array(ProblemModel),
	schemaProblems: Schema.Array(ProblemModel),
	bundleProblems: Schema.Array(ProblemModel),
	exampleId: Schema.NullOr(Schema.String),
	busy: Schema.Boolean,
	colorMode: ColorMode,
	systemDark: Schema.Boolean,
	cursorLine: Schema.Number,
	cursorColumn: Schema.Number,
	focusRequest: Schema.Number,
	focusLine: Schema.Number,
	focusColumn: Schema.Number,
	sharedFor: Schema.NullOr(Schema.String),
	copiedFor: Schema.NullOr(Schema.String),
	copyToken: Schema.Number,
	dataCollapsed: Schema.Boolean,
	problemsCollapsed: Schema.Boolean,
	topSplit: Schema.Number,
	expandedTopSplit: Schema.Number,
	headerHeight: Schema.Number,
	workspaceHeight: Schema.Number,
	workspaceTop: Schema.Number,
	splitDragging: Schema.Boolean,
	splitHovering: Schema.Boolean,
	fileDragging: Schema.Boolean,
	fileDragMode: Schema.NullOr(Schema.Literals(['add', 'replace'])),
	dataDragging: Schema.Boolean,
	openSelect: Schema.NullOr(Schema.Literals(['generator', 'example', 'policy', 'format'])),
	validation: ValidationModel,
});

export type AppModel = typeof AppModel.Type;
