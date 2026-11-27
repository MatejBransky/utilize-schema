import type { Ref } from 'react';

import { createAgent } from '@ui-sdk/react/agent';
import { assert, isPlainObject } from '@utilize/json-schema';
import { page, userEvent } from 'vitest/browser';
import { beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import App from './App';
import type { SchemaFile } from './bundle';
import './polyfills';
import { THEME_STORAGE_KEY } from './theme';

function problemsText() {
	return document.querySelector('[data-testid="problems"]')?.textContent ?? '';
}

vi.mock('./monaco/format', () => ({
	formatTypeScript: async (source: string) => source,
}));

vi.mock('./monaco/MonacoEditor', async () => {
	const { forwardRef, useImperativeHandle } = await import('react');

	const MonacoEditor = forwardRef(function MonacoEditorMock(
		{ testId, value }: { testId?: string; value?: string },
		ref: Ref<unknown>
	) {
		useImperativeHandle(ref, () => ({
			format() {},
			autoFormat: async () => {},
			focus() {},
			focusAt() {},
			getValue: () => value ?? '',
		}));

		return <div data-testid={testId} data-value={value} />;
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

function parseSavedState(fallback: string): Record<string, unknown> {
	const state: unknown = JSON.parse(localStorage.getItem('utilize-schema-playground') ?? fallback);

	assert(isPlainObject(state), 'Expected the saved workspace to be an object.');

	return state;
}

function isSchemaFile(value: unknown): value is SchemaFile {
	return (
		isPlainObject(value) &&
		typeof value.id === 'string' &&
		typeof value.name === 'string' &&
		typeof value.content === 'string'
	);
}

function savedFiles(): SchemaFile[] {
	const files = parseSavedState('{"files":[]}').files;

	assert(Array.isArray(files), 'Expected the saved workspace files to be an array.');

	const schemas = files.filter(isSchemaFile);

	assert(schemas.length === files.length, 'Expected every saved workspace file to be valid.');

	return schemas;
}

function savedData(): string {
	const data = parseSavedState('{"data":""}').data;

	assert(typeof data === 'string', 'Expected the saved test data to be a string.');

	return data;
}

function resultStatus(target: 'zod' | 'effect'): string | null {
	return (
		document.querySelector(`[data-testid="result-${target}"]`)?.getAttribute('data-status') ?? null
	);
}

function generatedCode(): string {
	return document.querySelector('[data-testid="generated-code"]')?.getAttribute('data-value') ?? '';
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
	expect(savedFiles()[0].content).toContain('./address.json');
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

test('dropping a JSON file on the test data editor replaces the test data', async () => {
	const screen = await render(<App />);
	const editor = document.querySelector('[data-testid="data-editor"]')!;
	const pane = editor.closest('section')!;
	const content = JSON.stringify({ dropped: true }, null, 2);
	const dropped = [{ name: 'payload.json', content }];

	pane.dispatchEvent(fileDrag('dragenter', dropped));

	await expect.element(screen.getByText('Drop a JSON document')).toBeVisible();

	pane.dispatchEvent(fileDrag('drop', dropped));

	await vi.waitFor(() => expect(editor.getAttribute('data-value')).toBe(content));
	await expect.element(screen.getByText('Drop a JSON document')).not.toBeInTheDocument();
});

test('the copy button resets when the schema changes', async () => {
	Object.defineProperty(navigator, 'clipboard', {
		configurable: true,
		value: { writeText: async () => {} },
	});

	const screen = await render(<App />);
	const copy = screen.getByRole('button', { name: 'Copy code' });

	await vi.waitFor(() => {
		const element = copy.element();

		assert('disabled' in element, 'Expected the copy control to be a button.');
		expect(element.disabled).toBe(false);
	});
	await copy.click();
	await expect.element(screen.getByRole('button', { name: 'Copied' })).toBeVisible();

	await screen.getByLabelText('Rename person.json').click();
	await screen.getByLabelText('File name').fill('contact.json');
	await screen.getByLabelText('Confirm rename').click();

	await expect.element(screen.getByRole('button', { name: 'Copy code' })).toBeVisible();
	await expect.element(screen.getByRole('button', { name: 'Copied' })).not.toBeInTheDocument();
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
	expect(new Set(labels).size).toBe(labels.length);
	for (const label of [
		'Generator',
		'Example',
		'Keyword policy',
		'Format',
		'Color mode',
		'Schema files',
		'Add file',
		'Format schema',
		'Format data',
		'Example test data',
		'Test data section',
		'Validation section',
		'Workspace layout',
		'Copy code',
		'Share',
		'Reports',
		'GitHub',
	]) {
		expect(labels, `${label} is missing from the snapshot`).toContain(label);
	}

	const cases = await agent.query({ within: 'Example test data' });
	expect('error' in cases).toBe(false);
	if ('error' in cases) {
		throw new Error(cases.error);
	}
	const invalidCase = cases[0]?.items?.find((item) => item.label === 'Invalid');
	expect(invalidCase?.value).toBe('invalid');
	await expect
		.element(screen.getByRole('separator', { name: 'Resize schema and test data sections' }))
		.toBeVisible();

	const controls = await agent.act({
		steps: [
			{ ref: 'Format data', action: 'press' },
			{ ref: 'Example test data', action: 'setValue', args: [invalidCase!.value] },
			{ ref: 'Test data section', action: 'setOpen', args: [false] },
			{ ref: 'Test data section', action: 'setOpen', args: [true] },
			{ ref: 'Validation section', action: 'setOpen', args: [false] },
			{ ref: 'Validation section', action: 'setOpen', args: [true] },
			{ ref: 'Workspace layout', action: 'setLayout', args: ['62,38'] },
		],
	});
	expect(controls.ok, controls.error?.message).toBe(true);
	await expect.element(screen.getByRole('radio', { name: 'Invalid' })).toBeChecked();
	expect(
		screen.getByRole('button', { name: 'Test data' }).element().getAttribute('aria-expanded')
	).toBe('true');
	expect(
		screen
			.getByRole('button', { name: /Validation/ })
			.element()
			.getAttribute('aria-expanded')
	).toBe('true');

	const separator = screen
		.getByRole('separator', { name: 'Resize schema and test data sections' })
		.element();
	separator.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
	await vi.waitFor(() => expect(separator.getAttribute('aria-valuenow')).toBe('60'));

	const result = await agent.act({
		steps: [
			{ ref: 'Color mode', action: 'press' },
			{ ref: 'Color mode', action: 'press' },
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

test('the header pickers are selects rather than text inputs', async () => {
	const screen = await render(<App />);

	expect(document.querySelector('[data-slot="combobox-input"]')).toBeNull();
	expect(document.querySelectorAll('[data-slot="select-trigger"]')).toHaveLength(4);
	await expect.element(screen.getByRole('combobox', { name: 'Generator' })).toBeVisible();
	await expect.element(screen.getByRole('combobox', { name: 'Example' })).toBeVisible();
	await expect.element(screen.getByRole('combobox', { name: 'Keyword policy' })).toBeVisible();
	await expect.element(screen.getByRole('combobox', { name: 'Format' })).toBeVisible();
});

test('the color mode button cycles through auto, light and dark', async () => {
	const screen = await render(<App />);
	const button = screen.getByRole('button', { name: 'Color mode' });

	await button.click();
	await vi.waitFor(() => expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light'));
	await button.click();
	await vi.waitFor(() => expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark'));
	await button.click();
	await vi.waitFor(() => expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('auto'));
});

test('the schema and test data sections can be resized by keyboard', async () => {
	await page.viewport(1200, 800);

	try {
		const screen = await render(<App />);
		const separator = screen
			.getByRole('separator', { name: 'Resize schema and test data sections' })
			.element();
		const group = separator.closest('[data-slot="resizable"]')!;
		const panelRatio = () => {
			const [top, bottom] = Array.from(
				group.querySelectorAll<HTMLElement>('[data-slot="resizable-panel"]')
			).map((panel) => panel.getBoundingClientRect().height);

			return top / (top + bottom);
		};

		await vi.waitFor(() => expect(separator.getAttribute('aria-valuenow')).toBe('60'));
		await vi.waitFor(() => expect(panelRatio()).toBeCloseTo(0.6, 1));

		separator.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
		await vi.waitFor(() => expect(separator.getAttribute('aria-valuenow')).toBe('58'));
		await vi.waitFor(() => expect(panelRatio()).toBeCloseTo(0.58, 1));

		separator.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'ArrowDown', shiftKey: true, bubbles: true })
		);
		await vi.waitFor(() => expect(separator.getAttribute('aria-valuenow')).toBe('68'));

		separator.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
		await vi.waitFor(() => expect(separator.getAttribute('aria-valuenow')).toBe('20'));

		separator.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
		await vi.waitFor(() => expect(separator.getAttribute('aria-valuenow')).toBe('94'));
	} finally {
		await page.viewport(414, 896);
	}
});

test('the generator select offers only implemented generators', async () => {
	const screen = await render(<App />);

	await screen.getByRole('combobox', { name: 'Generator' }).click();

	await expect.element(screen.getByRole('option', { name: /Zod/ })).toBeVisible();
	await expect.element(screen.getByRole('option', { name: /Effect Schema/ })).toBeVisible();
	await expect.element(screen.getByRole('option', { name: /TypeScript/ })).toBeVisible();
	expect(screen.getByRole('option', { name: /Valibot/ }).query()).toBeNull();
});

test('choosing a generator from the select updates the generated code', async () => {
	const screen = await render(<App />);

	await screen.getByRole('combobox', { name: 'Generator' }).click();
	await screen.getByRole('option', { name: /Effect Schema/ }).click();

	await vi.waitFor(() =>
		expect(new URL(location.href).searchParams.get('generator')).toBe('effect')
	);
	await expect
		.element(screen.getByRole('combobox', { name: 'Generator' }))
		.toHaveTextContent('Effect Schema');
});

test('the format select switches between annotation and assertion', async () => {
	const screen = await render(<App />);

	await vi.waitFor(() =>
		expect(new URL(location.href).searchParams.get('format-mode')).toBe('assert')
	);

	await screen.getByRole('combobox', { name: 'Format' }).click();
	await screen.getByRole('option', { name: /Annotate/ }).click();

	await vi.waitFor(() =>
		expect(new URL(location.href).searchParams.get('format-mode')).toBe('annotate')
	);
	await expect
		.element(screen.getByRole('combobox', { name: 'Format' }))
		.toHaveTextContent('Annotate');
});

test('the format controls follow the type generator', async () => {
	const screen = await render(<App />);

	expect(screen.getByRole('switch', { name: 'Pragmatic inference' }).query()).toBeNull();

	await screen.getByRole('combobox', { name: 'Generator' }).click();
	await screen.getByRole('option', { name: /TypeScript/ }).click();

	await expect.element(screen.getByRole('combobox', { name: 'Format' })).toBeDisabled();
	await expect.element(screen.getByRole('switch', { name: 'Pragmatic inference' })).toBeVisible();
});

test('the pragmatic inference switch infers string for the type generator', async () => {
	localStorage.setItem(
		'utilize-schema-playground',
		JSON.stringify({
			files: [
				{
					id: 'root',
					name: 'root.json',
					content: JSON.stringify({ format: 'email' }),
				},
			],
			target: 'typescript',
			data: '"ada@example.com"',
		})
	);
	const screen = await render(<App />);
	const toggle = screen.getByRole('switch', { name: 'Pragmatic inference' });

	await expect.element(toggle).toBeVisible();
	await expect.element(toggle).not.toBeChecked();
	await vi.waitFor(() => expect(generatedCode()).toContain('export type Root = unknown;'));

	toggle.element().focus();
	await userEvent.keyboard('{Space}');

	await expect.element(toggle).toBeChecked();
	await vi.waitFor(() =>
		expect(new URL(location.href).searchParams.get('inference')).toBe('pragmatic')
	);
	await vi.waitFor(() => expect(generatedCode()).toContain('export type Root = string;'));

	await screen.getByRole('button', { name: 'Share' }).click();
	await vi.waitFor(() =>
		expect(new URL(location.href).searchParams.get('inference')).toBe('pragmatic')
	);
	expect(new URL(location.href).hash).toContain('data=');
	await vi.waitFor(() =>
		expect(JSON.parse(localStorage.getItem('utilize-schema-playground')!).inference).toBe(
			'pragmatic'
		)
	);
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

test('an agent can toggle TypeScript pragmatic inference', async () => {
	localStorage.setItem(
		'utilize-schema-playground',
		JSON.stringify({
			files: [
				{
					id: 'root',
					name: 'root.json',
					content: JSON.stringify({ format: 'email' }),
				},
			],
			target: 'typescript',
			data: '"ada@example.com"',
		})
	);
	const agent = createAgent({ allow: () => true });
	await render(<App />);

	const labels = agent.snapshot().map((entry) => entry.label);
	expect(labels).toContain('Pragmatic inference');

	const result = await agent.act({
		steps: [{ ref: 'Pragmatic inference', action: 'setChecked', args: [true] }],
	});

	expect(result.ok, result.error?.message).toBe(true);
	await vi.waitFor(() =>
		expect(new URL(location.href).searchParams.get('inference')).toBe('pragmatic')
	);
});

test('the validation panel can be collapsed', async () => {
	const screen = await render(<App />);
	const sectionToggle = screen.getByRole('button', { name: /Validation/ });
	const body = document.querySelector('#validation-problems');

	expect(sectionToggle.element().getAttribute('aria-expanded')).toBe('true');
	expect(body?.hasAttribute('hidden')).toBe(false);

	await sectionToggle.click();

	await vi.waitFor(() =>
		expect(sectionToggle.element().getAttribute('aria-expanded')).toBe('false')
	);
	expect(body?.hasAttribute('hidden')).toBe(true);

	await sectionToggle.click();

	await vi.waitFor(() =>
		expect(sectionToggle.element().getAttribute('aria-expanded')).toBe('true')
	);
	expect(body?.hasAttribute('hidden')).toBe(false);
});

test('the schema editor fills its pane', async () => {
	await page.viewport(1200, 800);

	try {
		const screen = await render(<App />);
		const editor = screen.getByTestId('schema-editor').element();

		await vi.waitFor(() => expect(editor.getBoundingClientRect().height).toBeGreaterThan(100));
	} finally {
		await page.viewport(414, 896);
	}
});

test('the test data section collapses to its header', async () => {
	await page.viewport(1200, 800);

	try {
		const screen = await render(<App />);
		const sectionToggle = screen.getByRole('button', { name: 'Test data' });
		const editor = screen.getByTestId('data-editor').element();
		const editorPanel = editor.closest('#test-data-editor');
		const results = document.querySelector('#validator-results-panel');

		expect(sectionToggle.element().getAttribute('aria-expanded')).toBe('true');
		expect(editorPanel?.hasAttribute('hidden')).toBe(false);
		expect(results?.hasAttribute('hidden')).toBe(false);

		await sectionToggle.click();

		await vi.waitFor(() =>
			expect(sectionToggle.element().getAttribute('aria-expanded')).toBe('false')
		);
		const collapsedRow = document.getElementById('test-data-row');
		await vi.waitFor(() => expect(collapsedRow?.hasAttribute('data-collapsed')).toBe(true));
		await vi.waitFor(() => expect(collapsedRow?.getBoundingClientRect().height).toBeLessThan(60));
		expect(editorPanel?.hasAttribute('hidden')).toBe(true);
		expect(results?.hasAttribute('hidden')).toBe(true);
		expect(document.querySelector('[data-testid="data-editor"]')).toBe(editor);

		await sectionToggle.click();

		await vi.waitFor(() =>
			expect(sectionToggle.element().getAttribute('aria-expanded')).toBe('true')
		);
		expect(editorPanel?.hasAttribute('hidden')).toBe(false);
		expect(results?.hasAttribute('hidden')).toBe(false);
		expect(collapsedRow?.getBoundingClientRect().height).toBeGreaterThan(60);
		expect(document.querySelector('[data-testid="data-editor"]')).toBe(editor);
	} finally {
		await page.viewport(414, 896);
	}
});

test('resize and collapse controls remain available on narrow screens', async () => {
	await page.viewport(414, 896);

	try {
		const screen = await render(<App />);
		const separator = screen
			.getByRole('separator', { name: 'Resize schema and test data sections' })
			.element();
		const sectionToggle = screen.getByRole('button', { name: 'Test data' });

		await expect.element(separator).toBeVisible();
		await expect.element(sectionToggle).toBeVisible();
		await vi.waitFor(() => expect(separator.getAttribute('aria-valuenow')).toBe('60'));

		separator.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
		await vi.waitFor(() => expect(separator.getAttribute('aria-valuenow')).toBe('62'));

		await sectionToggle.click();
		await vi.waitFor(() =>
			expect(sectionToggle.element().getAttribute('aria-expanded')).toBe('false')
		);
		expect(document.querySelector('#test-data-editor')?.hasAttribute('hidden')).toBe(true);
		await expect.element(separator).toBeVisible();

		await sectionToggle.click();
		await vi.waitFor(() =>
			expect(sectionToggle.element().getAttribute('aria-expanded')).toBe('true')
		);
		await vi.waitFor(() => expect(separator.getAttribute('aria-valuenow')).toBe('62'));
		expect(document.querySelector('#test-data-editor')?.hasAttribute('hidden')).toBe(false);
	} finally {
		await page.viewport(414, 896);
	}
});

test('dropping a JSON file on a collapsed test data header is ignored', async () => {
	await page.viewport(1200, 800);

	try {
		const screen = await render(<App />);
		const editor = document.querySelector('[data-testid="data-editor"]')!;
		const pane = editor.closest('section')!;
		const before = editor.getAttribute('data-value');

		await screen.getByRole('button', { name: 'Test data' }).click();
		await vi.waitFor(() =>
			expect(document.querySelector('#test-data-editor')?.hasAttribute('hidden')).toBe(true)
		);

		pane.dispatchEvent(
			fileDrag('dragenter', [{ name: 'payload.json', content: '{"changed":true}' }])
		);
		pane.dispatchEvent(fileDrag('drop', [{ name: 'payload.json', content: '{"changed":true}' }]));
		await new Promise<void>((resolve) => {
			setTimeout(resolve, 250);
		});

		expect(editor.getAttribute('data-value')).toBe(before);
	} finally {
		await page.viewport(414, 896);
	}
});

test('the keyword policy shows foreign keywords as errors or warnings', async () => {
	localStorage.setItem(
		'utilize-schema-playground',
		JSON.stringify({
			files: [
				{
					id: 'root',
					name: 'root.json',
					content: JSON.stringify({
						$schema: 'http://json-schema.org/draft-07/schema#',
						type: 'array',
						prefixItems: [{ type: 'string' }],
					}),
				},
			],
			target: 'zod',
			keywordPolicy: 'error',
		})
	);
	const agent = createAgent({ allow: () => true });
	await render(<App />);

	await vi.waitFor(() => expect(problemsText()).toContain('"prefixItems" is not part of draft-07'));
	expect(problemsText()).toContain('1 errors, 0 warnings');
	expect(problemsText()).toContain('Error');

	const result = await agent.act({
		steps: [{ ref: 'Keyword policy', action: 'setValue', args: ['Warning'] }],
	});
	expect(result.ok, result.error?.message).toBe(true);

	await vi.waitFor(() => expect(problemsText()).toContain('0 errors, 1 warnings'));
	expect(problemsText()).toContain('"prefixItems" is not part of draft-07');
	// The workspace is saved in an effect, which can run after the panel updates.
	await vi.waitFor(() =>
		expect(JSON.parse(localStorage.getItem('utilize-schema-playground')!).keywordPolicy).toBe(
			'warn'
		)
	);
	expect(new URL(location.href).searchParams.get('keyword-policy')).toBe('warn');
});

test('foreign keywords show as warnings by default', async () => {
	localStorage.setItem(
		'utilize-schema-playground',
		JSON.stringify({
			files: [
				{
					id: 'root',
					name: 'root.json',
					content: JSON.stringify({
						$schema: 'http://json-schema.org/draft-07/schema#',
						type: 'array',
						prefixItems: [{ type: 'string' }],
					}),
				},
			],
			target: 'zod',
		})
	);
	await render(<App />);

	await vi.waitFor(() => expect(problemsText()).toContain('"prefixItems" is not part of draft-07'));
	expect(problemsText()).toContain('0 errors, 1 warnings');
	expect(problemsText()).toContain('Warning');
});

test('the keyword-policy URL parameter sets the policy', async () => {
	history.replaceState(null, '', '/?keyword-policy=error');
	localStorage.setItem(
		'utilize-schema-playground',
		JSON.stringify({
			files: [
				{
					id: 'root',
					name: 'root.json',
					content: JSON.stringify({
						$schema: 'http://json-schema.org/draft-07/schema#',
						type: 'array',
						prefixItems: [{ type: 'string' }],
					}),
				},
			],
			target: 'zod',
		})
	);
	await render(<App />);

	await vi.waitFor(() => expect(problemsText()).toContain('"prefixItems" is not part of draft-07'));
	expect(problemsText()).toContain('1 errors, 0 warnings');
	expect(problemsText()).toContain('Error');
});

test('the keyword-policy query parameter overrides the hash state', async () => {
	const state = {
		files: [
			{
				id: 'root',
				name: 'root.json',
				content: JSON.stringify({
					$schema: 'http://json-schema.org/draft-07/schema#',
					type: 'array',
					prefixItems: [{ type: 'string' }],
				}),
			},
		],
		target: 'zod',
		keywordPolicy: 'warn',
	};
	const encoded = btoa(JSON.stringify(state))
		.replaceAll('+', '-')
		.replaceAll('/', '_')
		.replace(/=+$/, '');
	history.replaceState(null, '', `/?keyword-policy=error#data=${encoded}`);
	await render(<App />);

	await vi.waitFor(() => expect(problemsText()).toContain('"prefixItems" is not part of draft-07'));
	expect(problemsText()).toContain('1 errors, 0 warnings');
});

test('share includes the keyword policy in the URL', async () => {
	Object.defineProperty(navigator, 'clipboard', {
		configurable: true,
		value: { writeText: async () => {} },
	});

	const screen = await render(<App />);

	await screen.getByRole('button', { name: 'Share' }).click();
	await vi.waitFor(() =>
		expect(new URL(location.href).searchParams.get('keyword-policy')).toBe('warn')
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

test('the test data is validated by the generated Zod schema', async () => {
	const screen = await render(<App />);

	await expect.element(screen.getByTestId('data-editor')).toBeVisible();
	await expect.element(screen.getByTestId('validator-results')).toBeVisible();
	expect(document.querySelector('[data-testid="result-effect"]')).toBeNull();

	await vi.waitFor(() => expect(resultStatus('zod')).toBe('valid'), { timeout: 15_000 });
	expect(savedData()).toContain('"firstName": "Ada"');

	await screen.getByRole('radio', { name: 'Invalid' }).click();

	await vi.waitFor(() => expect(resultStatus('zod')).toBe('invalid'), { timeout: 15_000 });

	const zodCard = document.querySelector('[data-testid="result-zod"]');

	expect(zodCard?.textContent).toContain('$.address.zip');
	expect(savedData()).toContain('"zip": "12"');
});

test('the result pane follows the selected generator', async () => {
	const screen = await render(<App />);

	await vi.waitFor(() => expect(resultStatus('zod')).toBe('valid'), { timeout: 15_000 });

	await screen.getByRole('combobox', { name: 'Generator' }).click();
	await screen.getByRole('option', { name: /Effect Schema/ }).click();

	await vi.waitFor(() => expect(resultStatus('effect')).toBe('valid'), { timeout: 15_000 });
	expect(document.querySelector('[data-testid="result-zod"]')).toBeNull();

	await screen.getByRole('radio', { name: 'Invalid' }).click();
	await vi.waitFor(() => expect(resultStatus('effect')).toBe('invalid'), { timeout: 15_000 });
	expect(document.querySelector('[data-testid="result-zod"]')).toBeNull();

	await screen.getByRole('combobox', { name: 'Generator' }).click();
	await screen.getByRole('option', { name: /TypeScript/ }).click();

	await expect.element(screen.getByText(/emits types only/)).toBeVisible();
	expect(document.querySelector('[data-testid="result-effect"]')).toBeNull();
});

const booleanRootCases = [
	{ target: 'zod', schema: true, status: 'valid' },
	{ target: 'zod', schema: false, status: 'invalid' },
	{ target: 'effect', schema: true, status: 'valid' },
	{ target: 'effect', schema: false, status: 'invalid' },
] as const;

test.each(booleanRootCases)(
	'$target runs a $schema root through its validator',
	async (testCase) => {
		localStorage.setItem(
			'utilize-schema-playground',
			JSON.stringify({
				files: [{ id: 'root', name: 'root.json', content: JSON.stringify(testCase.schema) }],
				target: testCase.target,
				data: '{"value":1}',
			})
		);
		await render(<App />);

		await vi.waitFor(() => expect(resultStatus(testCase.target)).toBe(testCase.status), {
			timeout: 15_000,
		});
		const card = document.querySelector(`[data-testid="result-${testCase.target}"]`);
		expect(card?.textContent).not.toContain('The validator could not run');
		expect(card?.textContent).not.toContain('The validator rejected the data.');
	}
);

test('switching examples loads their test data', async () => {
	const screen = await render(<App />);

	await screen.getByRole('combobox', { name: 'Example' }).click();
	await screen.getByRole('option', { name: /Enum/ }).click();

	await vi.waitFor(() => expect(savedData()).toBe('"green"'));
	await vi.waitFor(() => expect(resultStatus('zod')).toBe('valid'), { timeout: 15_000 });
	await vi.waitFor(() => expect(new URL(location.href).searchParams.get('example')).toBe('enum'));

	await screen.getByRole('radio', { name: 'Invalid' }).click();

	await vi.waitFor(() => expect(resultStatus('zod')).toBe('invalid'), { timeout: 15_000 });
	expect(savedData()).toBe('"purple"');
	await vi.waitFor(() => expect(new URL(location.href).searchParams.has('example')).toBe(false));
});
