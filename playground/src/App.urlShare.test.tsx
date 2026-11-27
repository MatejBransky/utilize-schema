import { beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import App from './App';
import './polyfills';
import { problemsText } from './test/domQueries';
import { encodeWorkspaceState, resetAppState } from './test/savedState';
import { foreignKeywordWorkspace } from './test/workspaceFixtures';

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

test('an example URL loads that example', async () => {
	history.replaceState(null, '', '/?example=const');
	const screen = await render(<App />);

	await expect.element(screen.getByRole('tab', { name: /const\.json/ })).toBeVisible();
	expect(new URL(location.href).searchParams.get('example')).toBe('const');
	await vi.waitFor(() => expect(new URL(location.href).searchParams.get('generator')).toBe('zod'));
});

test('the keyword-policy query parameter overrides the hash state', async () => {
	const encoded = encodeWorkspaceState(foreignKeywordWorkspace({ keywordPolicy: 'warn' }));
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

test('share feedback resets when the workspace changes', async () => {
	const screen = await render(<App />);

	await screen.getByRole('button', { name: 'Share' }).click();
	await expect.element(screen.getByRole('button', { name: 'Link copied' })).toBeVisible();

	await screen.getByLabelText('Add file').click();
	await expect.element(screen.getByRole('button', { name: 'Share' })).toBeVisible();
});
