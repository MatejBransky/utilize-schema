import { createAgent } from '@ui-sdk/react/agent';
import { beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import App from './App';
import './polyfills';
import { problemsText } from './test/domQueries';
import { resetAppState, seedWorkspace, WORKSPACE_STORAGE_KEY } from './test/savedState';
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

test('the keyword policy shows foreign keywords as errors or warnings', async () => {
	seedWorkspace(foreignKeywordWorkspace({ keywordPolicy: 'error' }));
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
		expect(JSON.parse(localStorage.getItem(WORKSPACE_STORAGE_KEY)!).keywordPolicy).toBe('warn')
	);
	expect(new URL(location.href).searchParams.get('keyword-policy')).toBe('warn');
});

test('foreign keywords show as warnings by default', async () => {
	seedWorkspace(foreignKeywordWorkspace());
	await render(<App />);

	await vi.waitFor(() => expect(problemsText()).toContain('"prefixItems" is not part of draft-07'));
	expect(problemsText()).toContain('0 errors, 1 warnings');
	expect(problemsText()).toContain('Warning');
});

test('the keyword-policy URL parameter sets the policy', async () => {
	history.replaceState(null, '', '/?keyword-policy=error');
	seedWorkspace(foreignKeywordWorkspace());
	await render(<App />);

	await vi.waitFor(() => expect(problemsText()).toContain('"prefixItems" is not part of draft-07'));
	expect(problemsText()).toContain('1 errors, 0 warnings');
	expect(problemsText()).toContain('Error');
});
