import { beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import App from './App';
import './polyfills';
import { resultStatus } from './test/domQueries';
import { resetAppState, savedData, seedWorkspace } from './test/savedState';

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

const booleanRootCases = [
	{ target: 'zod', schema: true, status: 'valid' },
	{ target: 'zod', schema: false, status: 'invalid' },
	{ target: 'effect', schema: true, status: 'valid' },
	{ target: 'effect', schema: false, status: 'invalid' },
] as const;

test.each(booleanRootCases)(
	'$target runs a $schema root through its validator',
	async (testCase) => {
		seedWorkspace({
			files: [{ id: 'root', name: 'root.json', content: JSON.stringify(testCase.schema) }],
			target: testCase.target,
			data: '{"value":1}',
		});
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
