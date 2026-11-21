import { createAgent } from '@ui-sdk/react/agent';
import { page } from 'vitest/browser';
import { beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import App from './App';
import type { SchemaFile } from './bundle';
import './polyfills';

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

function savedData(): string {
	return JSON.parse(localStorage.getItem('utilize-schema-playground') ?? '{"data":""}').data;
}

function resultStatus(target: 'zod' | 'effect'): string | null {
	return (
		document.querySelector(`[data-testid="result-${target}"]`)?.getAttribute('data-status') ?? null
	);
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

test('the copy button resets when the schema changes', async () => {
	Object.defineProperty(navigator, 'clipboard', {
		configurable: true,
		value: { writeText: async () => {} },
	});

	const screen = await render(<App />);
	const copy = screen.getByRole('button', { name: 'Copy code' });

	await vi.waitFor(() => expect((copy.element() as HTMLButtonElement).disabled).toBe(false));
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
	for (const label of [
		'Generator',
		'Example',
		'Keyword policy',
		'Format',
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

test('the header pickers are selects rather than text inputs', async () => {
	const screen = await render(<App />);

	expect(document.querySelector('[data-slot="combobox-input"]')).toBeNull();
	expect(document.querySelectorAll('[data-slot="select-trigger"]')).toHaveLength(4);
	await expect.element(screen.getByRole('combobox', { name: 'Generator' })).toBeVisible();
	await expect.element(screen.getByRole('combobox', { name: 'Example' })).toBeVisible();
	await expect.element(screen.getByRole('combobox', { name: 'Keyword policy' })).toBeVisible();
	await expect.element(screen.getByRole('combobox', { name: 'Format' })).toBeVisible();
});

test('the schema and test data sections can be resized', async () => {
	await page.viewport(1200, 800);

	try {
		const screen = await render(<App />);
		const separator = screen
			.getByRole('separator', { name: 'Resize schema and test data sections' })
			.element();

		expect(separator.getAttribute('aria-valuenow')).toBe('60');

		separator.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
		await vi.waitFor(() => expect(separator.getAttribute('aria-valuenow')).toBe('58'));

		separator.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
		await vi.waitFor(() => expect(separator.getAttribute('aria-valuenow')).toBe('80'));
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

test('the format select is disabled for the type generator', async () => {
	const screen = await render(<App />);

	await screen.getByRole('combobox', { name: 'Generator' }).click();
	await screen.getByRole('option', { name: /TypeScript/ }).click();

	await expect.element(screen.getByRole('combobox', { name: 'Format' })).toBeDisabled();
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

test('the validation panel can be collapsed', async () => {
	const screen = await render(<App />);
	const toggle = screen.getByRole('button', { name: /Validation/ });
	const body = document.querySelector('#validation-problems');

	expect(toggle.element().getAttribute('aria-expanded')).toBe('true');
	expect(body?.hasAttribute('hidden')).toBe(false);

	await toggle.click();

	await vi.waitFor(() => expect(toggle.element().getAttribute('aria-expanded')).toBe('false'));
	expect(body?.hasAttribute('hidden')).toBe(true);

	await toggle.click();

	await vi.waitFor(() => expect(toggle.element().getAttribute('aria-expanded')).toBe('true'));
	expect(body?.hasAttribute('hidden')).toBe(false);
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

	const problemsText = () => document.querySelector('[data-testid="problems"]')?.textContent ?? '';

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

	const problemsText = () => document.querySelector('[data-testid="problems"]')?.textContent ?? '';

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

	const problemsText = () => document.querySelector('[data-testid="problems"]')?.textContent ?? '';

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
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
	history.replaceState(null, '', `/?keyword-policy=error#data=${encoded}`);
	await render(<App />);

	const problemsText = () => document.querySelector('[data-testid="problems"]')?.textContent ?? '';

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

	await screen.getByRole('button', { name: 'Invalid' }).click();

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

	await screen.getByRole('button', { name: 'Invalid' }).click();
	await vi.waitFor(() => expect(resultStatus('effect')).toBe('invalid'), { timeout: 15_000 });
	expect(document.querySelector('[data-testid="result-zod"]')).toBeNull();

	await screen.getByRole('combobox', { name: 'Generator' }).click();
	await screen.getByRole('option', { name: /TypeScript/ }).click();

	await expect.element(screen.getByText(/emits types only/)).toBeVisible();
	expect(document.querySelector('[data-testid="result-effect"]')).toBeNull();
});

test('switching examples loads their test data', async () => {
	const screen = await render(<App />);

	await screen.getByRole('combobox', { name: 'Example' }).click();
	await screen.getByRole('option', { name: /Enum/ }).click();

	await vi.waitFor(() => expect(savedData()).toBe('"green"'));
	await vi.waitFor(() => expect(resultStatus('zod')).toBe('valid'), { timeout: 15_000 });

	await screen.getByRole('button', { name: 'Invalid' }).click();

	await vi.waitFor(() => expect(resultStatus('zod')).toBe('invalid'), { timeout: 15_000 });
	expect(savedData()).toBe('"purple"');
});
