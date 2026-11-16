import { createAgent } from '@ui-sdk/react/agent';
import { beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import App from './App';
import type { SchemaFile } from './bundle';

vi.mock('./monaco/format', () => ({
	formatTypeScript: async (source: string) => source,
}));

vi.mock('./monaco/MonacoEditor', async () => {
	const { forwardRef, useImperativeHandle } = await import('react');

	const MonacoEditor = forwardRef(function MonacoEditorMock(
		{ testId }: { testId?: string },
		ref: import('react').Ref<unknown>
	) {
		useImperativeHandle(ref, () => ({
			format() {},
			autoFormat: async () => {},
			focus() {},
			focusAt() {},
			getValue: () => '',
		}));

		return <div data-testid={testId} />;
	});

	return { MonacoEditor };
});

beforeEach(() => {
	localStorage.clear();
	history.replaceState(null, '', '/');
});

function tabNames(): string[] {
	return Array.from(document.querySelectorAll('[role="tab"]')).map((tab) => tab.textContent ?? '');
}

interface DropFile {
	name: string;
	content: string;
}

const droppedSchemas: DropFile[] = [
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

function fileDrag(type: string, files: DropFile[]): DragEvent {
	const dataTransfer = new DataTransfer();

	for (const file of files) {
		dataTransfer.items.add(new File([file.content], file.name, { type: 'application/json' }));
	}

	return new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer });
}

async function dragIn(files: DropFile[]) {
	window.dispatchEvent(fileDrag('dragenter', files));
	await vi.waitFor(() => expect(document.querySelector('[data-drop-mode="add"]')).not.toBeNull());
}

async function dropFiles(mode: 'add' | 'replace', files: DropFile[]) {
	const target = document.querySelector(`[data-drop-mode="${mode}"]`);

	expect(target).not.toBeNull();
	target!.dispatchEvent(fileDrag('drop', files));
}

function savedFiles(): SchemaFile[] {
	return JSON.parse(localStorage.getItem('utilize-schema-playground') ?? '{"files":[]}').files;
}

test('dragging JSON files over the editor shows the add and replace targets', async () => {
	const screen = await render(<App />);

	await dragIn(droppedSchemas);

	await expect.element(screen.getByTestId('file-drop-overlay')).toBeVisible();
	await expect.element(screen.getByText('Add to this workspace')).toBeVisible();
	await expect.element(screen.getByText('Start from the dropped files')).toBeVisible();
});

test('the highlighted drop target follows the pointer', async () => {
	await render(<App />);

	await dragIn(droppedSchemas);

	const add = document.querySelector('[data-drop-mode="add"]')!;
	const replace = document.querySelector('[data-drop-mode="replace"]')!;

	add.dispatchEvent(fileDrag('dragover', droppedSchemas));
	await vi.waitFor(() => expect(add.getAttribute('data-active')).toBe('true'));
	expect(replace.hasAttribute('data-active')).toBe(false);

	replace.dispatchEvent(fileDrag('dragover', droppedSchemas));
	await vi.waitFor(() => expect(replace.getAttribute('data-active')).toBe('true'));
	expect(add.hasAttribute('data-active')).toBe(false);

	document.querySelector('header')!.dispatchEvent(fileDrag('dragover', droppedSchemas));
	await vi.waitFor(() => expect(document.querySelector('[data-active]')).toBeNull());
});

test('dropping files on the replace target opens them as tabs', async () => {
	const screen = await render(<App />);

	await dragIn(droppedSchemas);
	await dropFiles('replace', droppedSchemas);

	await vi.waitFor(() =>
		expect(savedFiles().map((file) => file.name)).toEqual(['person.json', 'address.json'])
	);
	expect(savedFiles()[0]!.content).toContain('./address.json');
	expect(tabNames()).toHaveLength(2);
	expect(tabNames()[0]).toContain('person.json');
	expect(tabNames()[1]).toContain('address.json');
	await expect.element(screen.getByTestId('file-drop-overlay')).not.toBeInTheDocument();
});

test('dropping files on the add target keeps the open files', async () => {
	await render(<App />);

	const before = tabNames().length;

	await dragIn([{ name: 'extra.json', content: '{"type":"string"}' }]);
	await dropFiles('add', [{ name: 'extra.json', content: '{"type":"string"}' }]);

	await vi.waitFor(() => expect(tabNames()).toHaveLength(before + 1));
	expect(tabNames().some((name) => name.includes('person.json'))).toBe(true);
	expect(tabNames().at(-1)).toContain('extra.json');
});

test('an agent can find and change the playground controls', async () => {
	let approve = false;
	const agent = createAgent({ allow: (step) => !step.confirm || approve });
	const screen = await render(<App />);

	const components = agent
		.snapshot()
		.filter((entry) => !entry.offPage && entry.component !== 'more');

	for (const entry of components) {
		expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy();
	}

	const labels = components.map((entry) => entry.label);
	for (const label of [
		'Generator',
		'Example',
		'Color mode',
		'Schema files',
		'Add file',
		'Format schema',
		'Copy code',
		'Share',
		'GitHub',
	]) {
		expect(labels, `${label} is missing from the snapshot`).toContain(label);
	}

	const result = await agent.act({
		steps: [
			{ ref: 'Color mode', action: 'setValue', args: ['Dark'] },
			{ ref: 'Schema files', action: 'setValue', args: ['address.json'] },
			{ ref: 'Rename address.json', action: 'press' },
			{ ref: 'File name', action: 'setValue', args: ['contact.json'] },
			{ ref: 'Confirm rename', action: 'press' },
		],
	});
	expect(result.ok, result.error?.message).toBe(true);
	await expect.element(screen.getByRole('tab', { name: /contact\.json/ })).toBeVisible();
	await vi.waitFor(() =>
		expect(tabNames().some((name) => name.includes('address.json'))).toBe(false)
	);

	const refused = await agent.act({
		steps: [{ ref: 'Close contact.json', action: 'press' }],
	});
	expect(refused.ok).toBe(false);

	approve = true;
	const closed = await agent.act({
		steps: [{ ref: 'Close contact.json', action: 'press' }],
	});
	expect(closed.ok, closed.error?.message).toBe(true);
	await vi.waitFor(() =>
		expect(tabNames().some((name) => name.includes('contact.json'))).toBe(false)
	);

	const added = await agent.act({
		steps: [{ ref: 'Add file', action: 'press' }],
	});
	expect(added.ok, added.error?.message).toBe(true);
	await expect.element(screen.getByRole('tab', { name: /untitled\.json/ })).toBeVisible();
	await vi.waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'));

	const example = await agent.act({
		steps: [{ ref: 'Example', action: 'setValue', args: ['Recursion'] }],
	});
	expect(example.ok, example.error?.message).toBe(true);
	await vi.waitFor(() =>
		expect(new URL(location.href).searchParams.get('example')).toBe('recursion')
	);
	expect(new URL(location.href).searchParams.get('generator')).toBe('zod');

	const renamed = await agent.act({
		steps: [
			{ ref: 'Rename recursion.json', action: 'press' },
			{ ref: 'File name', action: 'setValue', args: ['tree.json'] },
			{ ref: 'Confirm rename', action: 'press' },
		],
	});
	expect(renamed.ok, renamed.error?.message).toBe(true);
	await vi.waitFor(() => expect(new URL(location.href).searchParams.has('example')).toBe(false));
	expect(new URL(location.href).searchParams.get('generator')).toBe('zod');
});

test('an example URL loads that example', async () => {
	history.replaceState(null, '', '/?example=const');
	const screen = await render(<App />);

	await expect.element(screen.getByRole('tab', { name: /const\.json/ })).toBeVisible();
	expect(new URL(location.href).searchParams.get('example')).toBe('const');
	await vi.waitFor(() => expect(new URL(location.href).searchParams.get('generator')).toBe('zod'));
});

test('an agent can switch the generator', async () => {
	const agent = createAgent({ allow: () => true });
	await render(<App />);

	const result = await agent.act({
		steps: [{ ref: 'Generator', action: 'setValue', args: ['Effect Schema'] }],
	});

	expect(result.ok, result.error?.message).toBe(true);
	await vi.waitFor(() =>
		expect(new URL(location.href).searchParams.get('generator')).toBe('effect')
	);
});

test('clicking outside the rename input cancels the rename', async () => {
	const screen = await render(<App />);

	await screen.getByLabelText('Rename person.json').click();
	await screen.getByLabelText('File name').fill('renamed.json');
	await screen.getByText('Generated TypeScript').click();

	await expect.element(screen.getByLabelText('File name')).not.toBeInTheDocument();
	expect(tabNames().some((name) => name.includes('person.json'))).toBe(true);
});

test('share feedback resets when the workspace changes', async () => {
	const screen = await render(<App />);

	await screen.getByRole('button', { name: 'Share' }).click();
	await expect.element(screen.getByRole('button', { name: 'Link copied' })).toBeVisible();

	await screen.getByLabelText('Add file').click();
	await expect.element(screen.getByRole('button', { name: 'Share' })).toBeVisible();
});

test('rejects renaming to an existing file name', async () => {
	const screen = await render(<App />);

	await screen.getByLabelText('Rename person.json').click();
	await screen.getByLabelText('File name').fill('address.json');
	await screen.getByLabelText('Confirm rename').click();

	await expect.element(screen.getByText('A file with this name already exists.')).toBeVisible();
	expect(screen.getByLabelText('File name')).toBeInTheDocument();
});
