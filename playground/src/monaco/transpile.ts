import { loadModule } from '../runtime';

import { monaco } from './setup';

let modelCounter = 0;
const modules = new Map<string, Promise<Record<string, unknown>>>();

/**
 * Emits and evaluates the generated module, caching it by source. Editing the
 * test data reuses the compiled validators instead of compiling again.
 */
export function compileModule(source: string): Promise<Record<string, unknown>> {
	let module = modules.get(source);

	if (!module) {
		module = emitJavaScript(source).then(loadModule);

		module.catch(() => modules.delete(source));
		modules.set(source, module);
	}

	return module;
}

/**
 * Uses the TypeScript worker that already powers the generated-code editor to
 * emit the JavaScript for the generated validators. The worker is loaded for
 * every TypeScript editor anyway, so running the validators does not add a
 * compiler to the bundle.
 */
export async function emitJavaScript(source: string): Promise<string> {
	const uri = monaco.Uri.parse(`file:///playground/validator-${(modelCounter += 1)}.ts`);
	const model = monaco.editor.createModel(source, 'typescript', uri);

	try {
		// The TypeScript worker is created when the language is first activated.
		monaco.editor.tokenize('const value = 1;', 'typescript');

		const worker = await getWorker();
		const client = await worker(uri);
		const output = await client.getEmitOutput(uri.toString());
		const javascript = output.outputFiles.find((file) => file.name.endsWith('.js'))?.text ?? '';

		if (!javascript) {
			throw new Error(
				output.emitSkipped
					? 'The TypeScript worker skipped emitting the generated code.'
					: 'The TypeScript worker produced no JavaScript for the generated code.'
			);
		}

		return javascript;
	} finally {
		model.dispose();
	}
}

/**
 * `getTypeScriptWorker` rejects until the language contribution has finished
 * registering its mode, which happens just after the first model is created.
 */
async function getWorker(): Promise<
	Awaited<ReturnType<typeof monaco.typescript.getTypeScriptWorker>>
> {
	const deadline = Date.now() + 10_000;

	for (;;) {
		try {
			return await monaco.typescript.getTypeScriptWorker();
		} catch (error) {
			if (Date.now() > deadline) {
				throw error;
			}

			await new Promise((resolve) => setTimeout(resolve, 50));
		}
	}
}
