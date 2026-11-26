import { monaco } from './setup';

let modelCounter = 0;
let emitQueue: Promise<void> = Promise.resolve();

export async function emitJavaScript(source: string): Promise<string> {
	const uri = monaco.Uri.parse(`file:///playground/validator-${(modelCounter += 1)}.ts`);
	const model = monaco.editor.createModel(source, 'typescript', uri);

	try {
		// The TypeScript worker is created when the language is first activated.
		monaco.editor.tokenize('const value = 1;', 'typescript');

		const output = await withEmitOptions(async () => {
			const worker = await getWorker();
			const client = await worker(uri);
			return client.getEmitOutput(uri.toString());
		});
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

// Monaco has one compiler-options set per worker, so transpiles must serialize.
function withEmitOptions<T>(operation: () => Promise<T>): Promise<T> {
	const result = emitQueue.then(async () => {
		const defaults = monaco.typescript.typescriptDefaults;
		const editorOptions = defaults.getCompilerOptions();
		defaults.setCompilerOptions({ ...editorOptions, noEmit: false });

		try {
			return await operation();
		} finally {
			defaults.setCompilerOptions(editorOptions);
		}
	});

	emitQueue = result.then(
		() => undefined,
		() => undefined
	);
	return result;
}

// Monaco rejects getTypeScriptWorker until the language mode finishes registering.
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

			await new Promise<void>((resolve) => {
				setTimeout(resolve, 50);
			});
		}
	}
}
