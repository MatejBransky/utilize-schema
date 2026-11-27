import { createAgent } from '@ui-sdk/react/agent';
import { userEvent } from 'vitest/browser';
import { beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import App from './App';
import './polyfills';
import { expectAgentSnapshotLabels } from './test/agentAssertions';
import { generatedCode } from './test/domQueries';
import { resetAppState, seedWorkspace, WORKSPACE_STORAGE_KEY } from './test/savedState';
import { typescriptEmailWorkspace } from './test/workspaceFixtures';

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

test('the pragmatic inference switch infers string for the type generator', async () => {
	seedWorkspace(typescriptEmailWorkspace());
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
		expect(JSON.parse(localStorage.getItem(WORKSPACE_STORAGE_KEY)!).inference).toBe('pragmatic')
	);

	await toggle.click();

	await expect.element(toggle).not.toBeChecked();
	await vi.waitFor(() => expect(new URL(location.href).searchParams.get('inference')).toBe('spec'));
	await vi.waitFor(() => expect(generatedCode()).toContain('export type Root = unknown;'));
});

test('an agent can toggle TypeScript pragmatic inference', async () => {
	seedWorkspace(typescriptEmailWorkspace());
	const agent = createAgent({ allow: () => true });
	const screen = await render(<App />);

	expectAgentSnapshotLabels(agent, ['Pragmatic inference'], ['Example test data']);

	const result = await agent.act({
		steps: [{ ref: 'Pragmatic inference', action: 'setChecked', args: [true] }],
	});

	expect(result.ok, result.error?.message).toBe(true);
	await expect.element(screen.getByRole('switch', { name: 'Pragmatic inference' })).toBeChecked();
	await vi.waitFor(() => expect(generatedCode()).toContain('export type Root = string;'));
	await vi.waitFor(() =>
		expect(new URL(location.href).searchParams.get('inference')).toBe('pragmatic')
	);
});
