import { expect, test } from 'vitest';

import { collectDroppedFiles, readDroppedSchemas, relativeNames } from './drop';
import type { DropDataTransfer, DropEntry, DroppedFile } from './drop';

function droppedFile(path: string, content = '{}'): DroppedFile {
	const name = path.split('/').at(-1) ?? path;

	return { path, file: new File([content], name, { type: 'application/json' }) };
}

test('relativeNames strips the shared root folder', () => {
	expect(relativeNames(['/schemas/person.json', '/schemas/common/address.json'])).toEqual([
		'person.json',
		'common/address.json',
	]);
});

test('relativeNames keeps sibling folders apart', () => {
	expect(relativeNames(['/a/person.json', '/b/person.json'])).toEqual([
		'a/person.json',
		'b/person.json',
	]);
});

test('relativeNames keeps the name of a single dropped file', () => {
	expect(relativeNames(['/person.json'])).toEqual(['person.json']);
});

test('collectDroppedFiles loads JSON files and ignores the rest', async () => {
	const dataTransfer = new DataTransfer();

	dataTransfer.items.add(new File(['{}'], 'person.json', { type: 'application/json' }));
	dataTransfer.items.add(new File(['notes'], 'readme.txt', { type: 'text/plain' }));

	const files = await collectDroppedFiles(dataTransfer);

	expect(files.map((entry) => entry.path)).toEqual(['person.json']);
});

test('readDroppedSchemas sorts the files and reads their contents', async () => {
	const schemas = await readDroppedSchemas([
		droppedFile('/schemas/person.json', '{"title":"Person"}'),
		droppedFile('/schemas/common/address.json', '{"title":"Address"}'),
	]);

	expect(schemas).toEqual([
		{ name: 'common/address.json', content: '{"title":"Address"}' },
		{ name: 'person.json', content: '{"title":"Person"}' },
	]);
});

test('readDroppedSchemas keeps names relative to the dropped folders', async () => {
	const schemas = await readDroppedSchemas([
		droppedFile('/one/person.json'),
		droppedFile('/two/person.json'),
	]);

	expect(schemas.map((schema) => schema.name)).toEqual(['one/person.json', 'two/person.json']);
});

function fileEntry(fullPath: string, name: string, content = '{}'): DropEntry {
	return {
		isFile: true,
		isDirectory: false,
		name,
		fullPath,
		file: (resolve) => resolve(new File([content], name)),
	};
}

function unreadableEntry(fullPath: string, name: string): DropEntry {
	return {
		isFile: true,
		isDirectory: false,
		name,
		fullPath,
		file: (_resolve, reject) => reject(),
	};
}

function directoryEntry(fullPath: string, name: string, children: DropEntry[]): DropEntry {
	let read = false;

	return {
		isFile: false,
		isDirectory: true,
		name,
		fullPath,
		createReader: () => ({
			readEntries: (callback) => {
				const entries = read ? [] : children;
				read = true;
				callback(entries);
			},
		}),
	};
}

function transfer(entries: (DropEntry | null)[]): DropDataTransfer {
	return {
		items: entries.map((entry) => ({ kind: 'file', webkitGetAsEntry: () => entry })),
		files: [],
	};
}

test('collectDroppedFiles walks dropped directories and keeps JSON files', async () => {
	const root = directoryEntry('/root', 'root', [
		fileEntry('/root/person.json', 'person.json'),
		fileEntry('/root/notes.txt', 'notes.txt'),
		directoryEntry('/root/nested', 'nested', [
			fileEntry('/root/nested/address.json', 'address.json'),
		]),
	]);

	const files = await collectDroppedFiles(transfer([root]));

	expect(files.map((entry) => entry.path)).toEqual([
		'/root/person.json',
		'/root/nested/address.json',
	]);
});

test('collectDroppedFiles skips entries that are neither files nor directories', async () => {
	const other: DropEntry = { isFile: false, isDirectory: false, fullPath: '/root/pipe' };

	expect(await collectDroppedFiles(transfer([other]))).toEqual([]);
});

test('collectDroppedFiles skips a file the browser cannot read', async () => {
	expect(await collectDroppedFiles(transfer([unreadableEntry('/root/a.json', 'a.json')]))).toEqual(
		[]
	);
});

test('collectDroppedFiles ignores items without an entry and ignores null entries', async () => {
	const dataTransfer: DropDataTransfer = {
		items: [
			{ kind: 'string' },
			{ kind: 'file', webkitGetAsEntry: () => null },
			{ kind: 'file', webkitGetAsEntry: () => fileEntry('/root/a.json', 'a.json') },
		],
		files: [],
	};

	const files = await collectDroppedFiles(dataTransfer);

	expect(files.map((entry) => entry.path)).toEqual(['/root/a.json']);
});

test('collectDroppedFiles drops duplicate paths from nested entries', async () => {
	const root = directoryEntry('/root', 'root', [
		fileEntry('/root/a.json', 'a.json'),
		fileEntry('//root/a.json', 'a.json'),
	]);

	const files = await collectDroppedFiles(transfer([root]));

	expect(files).toHaveLength(1);
});
