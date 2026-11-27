import { beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import App from './App';
import './polyfills';
import { dragIn, dropFiles, droppedSchemas } from './test/dragDrop';
import { tabNames } from './test/domQueries';
import { resetAppState, savedFiles } from './test/savedState';

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
