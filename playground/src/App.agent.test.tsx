import { createAgent } from '@ui-sdk/react/agent';
import { beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import App from './App';
import './polyfills';
import { expectAgentControls, expectAgentSnapshotLabels } from './test/agentAssertions';
import { tabNames } from './test/domQueries';
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

test('an agent can find and change the playground controls', async () => {
	let approve = false;
	const agent = createAgent({ allow: (step) => !step.confirm || approve });
	const screen = await render(<App />);

	expectAgentSnapshotLabels(agent);
	await expectAgentControls(agent, screen);

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
