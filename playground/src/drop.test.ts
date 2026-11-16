import { expect, test } from 'vitest';

import { collectDroppedFiles, readDroppedSchemas, relativeNames, type DroppedFile } from './drop';

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
