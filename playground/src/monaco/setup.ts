import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/editor/editor.worker.js?worker';
import jsonWorker from 'monaco-editor/languages/features/json/json.worker.js?worker';
import tsWorker from 'monaco-editor/languages/features/typescript/ts.worker.js?worker';

import jsonSchemaFormatsTypes from 'virtual:json-schema-formats-types';
import zodTypes from 'virtual:zod-types';

interface MonacoEnvironment {
	getWorker(moduleId: string, label: string): Worker;
}

self.MonacoEnvironment = {
	getWorker(_moduleId, label) {
		if (label === 'json') {
			return new jsonWorker();
		}

		if (label === 'typescript' || label === 'javascript') {
			return new tsWorker();
		}

		return new editorWorker();
	},
};

monaco.json.jsonDefaults.setDiagnosticsOptions({
	validate: true,
	allowComments: false,
	enableSchemaRequest: false,
	schemas: [],
});

const typescript = monaco.typescript;

typescript.typescriptDefaults.setCompilerOptions({
	target: typescript.ScriptTarget.ESNext,
	module: typescript.ModuleKind.ESNext,
	moduleResolution: typescript.ModuleResolutionKind.NodeJs,
	strict: true,
	// Editor models do not emit. The dedicated transpile operation temporarily
	// overrides this option only while it asks the worker for JavaScript.
	noEmit: true,
	skipLibCheck: true,
	allowNonTsExtensions: true,
	types: [],
});

typescript.typescriptDefaults.setEagerModelSync(true);

for (const [file, content] of Object.entries(zodTypes)) {
	typescript.typescriptDefaults.addExtraLib(content, `file:///node_modules/zod/${file}`);
}

typescript.typescriptDefaults.addExtraLib(
	jsonSchemaFormatsTypes,
	'file:///node_modules/@utilize/json-schema/formats.d.ts'
);

let effectTypesPromise: Promise<void> | undefined;

/**
 * Effect ships ~6 MB of declarations, so they are registered in the TypeScript
 * worker only when the playground actually shows Effect Schema code.
 */
export function preloadEffectTypes(): Promise<void> {
	effectTypesPromise ??= import('virtual:effect-types').then(({ default: effectTypes }) => {
		for (const [file, content] of Object.entries(effectTypes)) {
			typescript.typescriptDefaults.addExtraLib(content, `file:///node_modules/effect/${file}`);
		}
	});

	return effectTypesPromise;
}

// Generated code can be noisy for edge keywords, so keep semantic diagnostics
// off; hover still uses the full type checker and the real zod types.
typescript.typescriptDefaults.setDiagnosticsOptions({
	noSemanticValidation: true,
	noSyntaxValidation: false,
});

monaco.editor.defineTheme('utilize-dark', {
	base: 'vs-dark',
	inherit: true,
	rules: [],
	colors: {
		'editor.background': '#0a0a0a',
		'editor.lineHighlightBackground': '#1a1a1a',
		'editorLineNumber.foreground': '#737373',
		'editorLineNumber.activeForeground': '#fafafa',
		'editorGutter.background': '#0a0a0a',
	},
});

monaco.editor.defineTheme('utilize-light', {
	base: 'vs',
	inherit: true,
	rules: [],
	colors: {
		'editor.background': '#ffffff',
		'editor.lineHighlightBackground': '#f2f2f2',
		'editorLineNumber.foreground': '#8a8a8a',
		'editorLineNumber.activeForeground': '#0a0a0a',
		'editorGutter.background': '#ffffff',
	},
});

export { monaco };

declare global {
	interface Window {
		MonacoEnvironment?: MonacoEnvironment;
		monaco: typeof monaco;
	}
}

// Exposed for the browser smoke tests and for debugging from the console.
window.monaco = monaco;
