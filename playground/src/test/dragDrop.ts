import { assert } from '@utilize/json-schema';
import { expect, vi } from 'vitest';

export interface DropFile {
	name: string;
	content: string;
}

export const droppedSchemas: DropFile[] = [
	{
		name: 'person.json',
		content: JSON.stringify({
			$schema: 'http://json-schema.org/draft-07/schema#',
			type: 'object',
			properties: { name: { type: 'string' }, address: { $ref: './address.json' } },
			required: ['name', 'address'],
		}),
	},
	{
		name: 'address.json',
		content: JSON.stringify({
			$schema: 'http://json-schema.org/draft-07/schema#',
			type: 'object',
			properties: { city: { type: 'string' } },
			required: ['city'],
		}),
	},
];

export function fileDrag(type: string, files: DropFile[]): DragEvent {
	const dataTransfer = new DataTransfer();

	for (const file of files) {
		dataTransfer.items.add(new File([file.content], file.name, { type: 'application/json' }));
	}

	return new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer });
}

export async function dragIn(files: DropFile[]) {
	window.dispatchEvent(fileDrag('dragenter', files));

	await vi.waitFor(() => expect(document.querySelector('[data-drop-mode="add"]')).not.toBeNull());
}

export async function dropFiles(mode: 'add' | 'replace', files: DropFile[]) {
	const target = document.querySelector(`[data-drop-mode="${mode}"]`);

	assert(target, 'Expected a drop target.');
	target.dispatchEvent(fileDrag('drop', files));
}
