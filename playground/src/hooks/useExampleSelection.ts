import type { SchemaFile } from '../bundle';
import { exampleById, exampleCaseForData, exampleData, examples } from '../examples';
import { setExampleUrl } from '../playgroundUrl';

export interface ExampleSelection {
	activeExample: ReturnType<typeof exampleById>;
	activeCase: ReturnType<typeof exampleCaseForData>;
	applyExample: (id: string) => void;
}

/** Derives the current example from its id and applies one on demand. */
export function useExampleSelection(
	exampleId: string | null,
	data: string,
	applyFiles: (files: SchemaFile[]) => void,
	setData: (data: string) => void
): ExampleSelection {
	const activeExample = exampleById(exampleId);
	const activeCase = activeExample ? exampleCaseForData(activeExample, data) : undefined;

	function applyExample(id: string) {
		const example = examples.find((candidate) => candidate.id === id);

		if (!example) {
			return;
		}

		applyFiles(example.files);
		setData(exampleData(example));
		setExampleUrl(example.id, 'push');
	}

	return { activeExample, activeCase, applyExample };
}
