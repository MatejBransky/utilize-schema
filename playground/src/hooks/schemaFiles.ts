import { detectRootId, normalizeName } from '../bundle';
import type { SchemaFile } from '../bundle';
import { collectDroppedFiles, readDroppedSchemas } from '../drop';
import type { ImportedSchema } from '../drop';
import { newFileId, uniqueName } from '../playgroundState';

/** Reads every schema in a drop, or `null` when the drop has none. */
export async function readDroppedSchemaFiles(
	dataTransfer: DataTransfer
): Promise<ImportedSchema[] | null> {
	return readDroppedSchemas(await collectDroppedFiles(dataTransfer)).catch(() => null);
}

/** Gives dropped schemas fresh ids and names that do not clash with `base`. */
export function nameDroppedFiles(schemas: ImportedSchema[], base: SchemaFile[]): SchemaFile[] {
	const added: SchemaFile[] = [];

	for (const schema of schemas) {
		added.push({
			id: newFileId(),
			name: uniqueName(schema.name, [...base, ...added]),
			content: schema.content,
		});
	}

	return added;
}

/** Moves the detected root (or the first file) to the front. */
export function rootFirst(files: SchemaFile[]): SchemaFile[] {
	const rootId = detectRootId(files) ?? files[0].id;
	const root = files.find((file) => file.id === rootId) ?? files[0];

	return [root, ...files.filter((file) => file.id !== root.id)];
}

/** Whether another file already normalizes to `name`. */
export function hasFileNamed(files: SchemaFile[], id: string, name: string): boolean {
	return files.some((file) => file.id !== id && normalizeName(file.name) === normalizeName(name));
}
