import { normalizeName } from './bundle';

export type DropMode = 'add' | 'replace';

export interface DroppedFile {
	path: string;
	file: File;
}

export interface ImportedSchema {
	name: string;
	content: string;
}

export interface DropEntry {
	readonly isFile: boolean;
	readonly isDirectory: boolean;
	readonly fullPath: string;
	readonly name?: string;
	file?: (resolve: (file: File | null) => void, reject: (error?: unknown) => void) => void;
	createReader?: () => DropDirectoryReader;
}

export interface DropDirectoryReader {
	readEntries(
		callback: (entries: DropEntry[]) => void,
		errorCallback?: (error?: unknown) => void
	): void;
}

export interface DropDataTransferItem {
	readonly kind: string;
	webkitGetAsEntry?: () => DropEntry | null;
}

export interface DropDataTransfer {
	readonly items?: ArrayLike<DropDataTransferItem>;
	readonly files?: ArrayLike<File>;
}

export function hasFileDrag(dataTransfer: DataTransfer | null): boolean {
	return Boolean(dataTransfer && Array.from(dataTransfer.types).includes('Files'));
}

function isJsonPath(path: string): boolean {
	return /\.json$/i.test(path);
}

export async function collectDroppedFiles(dataTransfer: DropDataTransfer): Promise<DroppedFile[]> {
	const entries = Array.from(dataTransfer.items ?? [])
		.map((item) => (item.kind === 'file' ? item.webkitGetAsEntry?.() : null))
		.filter((entry): entry is DropEntry => entry !== null && entry !== undefined);

	const dropped =
		entries.length > 0
			? (await Promise.all(entries.map(readEntry))).flat()
			: Array.from(dataTransfer.files ?? []).map((file) => ({ path: file.name, file }));

	return dedupe(dropped.filter((entry) => isJsonPath(entry.path)));
}

export async function readDroppedSchemas(files: DroppedFile[]): Promise<ImportedSchema[]> {
	const ordered = [...files].toSorted((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
	const names = relativeNames(ordered.map((entry) => entry.path));
	const schemas: ImportedSchema[] = [];

	for (const [index, entry] of ordered.entries()) {
		try {
			schemas.push({ name: names[index], content: await entry.file.text() });
		} catch {
			// A file the browser cannot read (for example, one moved during the drop) is skipped.
		}
	}

	return schemas;
}

export function relativeNames(paths: string[]): string[] {
	const normalized = paths.flatMap((path) => {
		const name = normalizeName(path);

		return name.length > 0 ? [name] : [];
	});
	const directories = normalized.map((path) => path.split('/').slice(0, -1));
	const common = directories.reduce<string[]>((prefix, directory) => {
		let length = 0;

		while (
			length < prefix.length &&
			length < directory.length &&
			prefix[length] === directory[length]
		) {
			length += 1;
		}

		return prefix.slice(0, length);
	}, directories[0] ?? []);

	return normalized.map((path) => path.split('/').slice(common.length).join('/'));
}

function isFileEntry(
	entry: DropEntry
): entry is DropEntry & { file: NonNullable<DropEntry['file']> } {
	return entry.isFile && entry.file !== undefined;
}

function isDirectoryEntry(
	entry: DropEntry
): entry is DropEntry & { createReader: NonNullable<DropEntry['createReader']> } {
	return entry.isDirectory && entry.createReader !== undefined;
}

async function readEntry(entry: DropEntry): Promise<DroppedFile[]> {
	if (isFileEntry(entry)) {
		const file = await new Promise<File | null>((resolve) => {
			entry.file(resolve, () => resolve(null));
		});

		return file && isJsonPath(file.name) ? [{ path: entry.fullPath, file }] : [];
	}

	if (!isDirectoryEntry(entry)) {
		return [];
	}

	const children = await readDirectory(entry.createReader());

	return (await Promise.all(children.map(readEntry))).flat();
}

function readDirectory(reader: DropDirectoryReader): Promise<DropEntry[]> {
	return new Promise((resolve, reject) => {
		const entries: DropEntry[] = [];
		const readBatch = () => {
			reader.readEntries((batch) => {
				if (batch.length === 0) {
					resolve(entries);
					return;
				}
				entries.push(...batch);
				readBatch();
			}, reject);
		};

		readBatch();
	});
}

function dedupe(files: DroppedFile[]): DroppedFile[] {
	const seen = new Set<string>();

	return files.filter((entry) => {
		const key = normalizeName(entry.path);

		if (seen.has(key)) {
			return false;
		}
		seen.add(key);
		return true;
	});
}
