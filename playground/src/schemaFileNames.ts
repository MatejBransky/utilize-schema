import type { SchemaFile } from './bundle';
import { examples } from './examples';

export function resolveExampleId(files: SchemaFile[]): string | null {
	const match = examples.find(
		(example) =>
			example.files.length === files.length &&
			files.every((file) => {
				const exampleFile = example.files.find((item) => item.id === file.id);

				return (
					exampleFile !== undefined &&
					exampleFile.name === file.name &&
					exampleFile.content === file.content
				);
			})
	);

	return match?.id ?? null;
}

let fileCounter = 0;

export function newFileId(): string {
	fileCounter += 1;

	return globalThis.crypto?.randomUUID?.() ?? `file-${Date.now()}-${fileCounter}`;
}

export function uniqueName(base: string, files: SchemaFile[]): string {
	const names = new Set(files.map((file) => file.name.toLowerCase()));

	if (!names.has(base.toLowerCase())) {
		return base;
	}

	const dot = base.lastIndexOf('.');
	const stem = dot > 0 ? base.slice(0, dot) : base;
	const extension = dot > 0 ? base.slice(dot) : '';
	let counter = 2;

	while (names.has(`${stem}-${counter}${extension}`.toLowerCase())) {
		counter += 1;
	}

	return `${stem}-${counter}${extension}`;
}
