import { createAgent } from '@ui-sdk/react/agent';
import { beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import App from './App';

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
		'Format code',
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
