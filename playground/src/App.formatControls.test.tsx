import { createAgent } from '@ui-sdk/react/agent';
import { beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import App from './App';
import './polyfills';
import { resetAppState } from './test/savedState';

vi.mock('./monaco/format', () => ({
	formatTypeScript: async (source: string) => source,
}));

vi.mock('./monaco/MonacoEditor', async () => {
	const { createMonacoEditorMock } = await import('./test/monacoEditorMock');

	return createMonacoEditorMock();
});

beforeEach(() => {
	resetAppState();
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
