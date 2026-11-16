import { monaco } from './setup';

const FORMAT_OPTIONS = {
	ConvertTabsToSpaces: true,
	TabSize: 2,
	IndentSize: 2,
	IndentStyle: 2,
	NewLineCharacter: '\n',
	InsertSpaceAfterCommaDelimiter: true,
	InsertSpaceAfterSemicolonInForStatements: true,
	InsertSpaceBeforeAndAfterBinaryOperators: true,
	InsertSpaceAfterKeywordsInControlFlowStatements: true,
	InsertSpaceAfterFunctionKeywordForAnonymousFunctions: true,
	InsertSpaceAfterOpeningAndBeforeClosingNonemptyParenthesis: false,
	InsertSpaceAfterOpeningAndBeforeClosingNonemptyBrackets: false,
	InsertSpaceAfterOpeningAndBeforeClosingTemplateStringBraces: false,
	PlaceOpenBraceOnNewLineForControlBlocks: false,
	PlaceOpenBraceOnNewLineForFunctions: false,
};

interface TextChange {
	span: { start: number; length: number };
	newText: string;
}

let modelCounter = 0;

export async function formatTypeScript(source: string): Promise<string> {
	if (!source.trim()) {
		return source;
	}

	const uri = monaco.Uri.parse(`file:///playground/format-${++modelCounter}.ts`);
	const model = monaco.editor.createModel(source, 'typescript', uri);

	try {
		const worker = await monaco.typescript.getTypeScriptWorker();
		const client = await worker(uri);
		const changes = (await client.getFormattingEditsForDocument(
			uri.toString(),
			FORMAT_OPTIONS
		)) as TextChange[];

		return applyChanges(source, changes);
	} finally {
		model.dispose();
	}
}

function applyChanges(source: string, changes: TextChange[]): string {
	let result = source;

	for (const change of changes.toSorted((a, b) => b.span.start - a.span.start)) {
		result =
			result.slice(0, change.span.start) +
			change.newText +
			result.slice(change.span.start + change.span.length);
	}

	return result;
}
