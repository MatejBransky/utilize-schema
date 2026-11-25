import { createRef } from 'react';
import { beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import { MonacoEditor, type MonacoEditorHandle } from './MonacoEditor';

const fake = vi.hoisted(() => {
	type Position = { lineNumber: number; column: number };
	type FakeModel = {
		language: string;
		uri: unknown;
		getValue(): string;
		setValue(value: string): void;
		dispose(): void;
	};

	const state = {
		changeListener: undefined as (() => void) | undefined,
		cursorListener: undefined as ((event: { position: Position }) => void) | undefined,
		position: { lineNumber: 1, column: 1 } as Position | null,
		readOnly: false,
		hasAction: true,
		options: [] as Record<string, unknown>[],
		positions: [] as Position[],
		themes: [] as string[],
		actions: [] as string[],
		formats: 0,
		focuses: 0,
		disposals: 0,
		preloads: 0,
	};

	const monaco = {
		Uri: { parse: (value: string) => ({ value }) },
		editor: {
			EditorOption: { readOnly: 1 },
			setTheme: (theme: string) => state.themes.push(theme),
			createModel: (value: string, language: string, uri?: unknown): FakeModel => {
				let current = value;
				const model = {
					language,
					uri,
					getValue: () => current,
					setValue: (next: string) => {
						current = next;
					},
					dispose: () => {
						state.disposals += 1;
					},
				};

				return model;
			},
			create: (host: HTMLElement, options: { model: FakeModel }) => {
				const textarea = document.createElement('textarea');
				host.append(textarea);

				const editor = {
					getDomNode: () => host,
					onDidChangeModelContent: (listener: () => void) => {
						state.changeListener = listener;

						return {
							dispose: () => {
								state.changeListener = undefined;
							},
						};
					},
					onDidChangeCursorPosition: (listener: (event: { position: Position }) => void) => {
						state.cursorListener = listener;

						return {
							dispose: () => {
								state.cursorListener = undefined;
							},
						};
					},
					getPosition: () => state.position,
					getModel: () => options.model,
					updateOptions: (next: Record<string, unknown>) => {
						state.options.push(next);

						if (typeof next.readOnly === 'boolean') {
							state.readOnly = next.readOnly;
						}
					},
					getOption: () => state.readOnly,
					getAction: (id: string) => {
						state.actions.push(id);

						return state.hasAction ? { run: async () => void (state.formats += 1) } : null;
					},
					setPosition: (position: Position) => state.positions.push(position),
					revealPositionInCenter: () => {},
					focus: () => {
						state.focuses += 1;
					},
					getValue: () => options.model.getValue(),
					dispose: () => {
						state.disposals += 1;
					},
				};

				return editor;
			},
		},
	};

	return {
		state,
		monaco,
		preloadEffectTypes: () => {
			state.preloads += 1;
			return Promise.resolve();
		},
	};
});

vi.mock('./setup', () => ({
	monaco: fake.monaco,
	preloadEffectTypes: fake.preloadEffectTypes,
}));

beforeEach(() => {
	Object.assign(fake.state, {
		position: { lineNumber: 1, column: 1 },
		readOnly: false,
		hasAction: true,
		formats: 0,
		focuses: 0,
		disposals: 0,
		preloads: 0,
	});
	fake.state.options.length = 0;
	fake.state.positions.length = 0;
	fake.state.themes.length = 0;
	fake.state.actions.length = 0;
});

const baseProps = {
	value: '{"type":"string"}',
	language: 'json',
	theme: 'utilize-light',
	path: 'file:///root.json',
	ariaLabel: 'Schema',
	testId: 'editor',
};

test('reports the initial cursor and forwards model changes', async () => {
	const cursors: [number, number][] = [];
	const changes: string[] = [];
	const ref = createRef<MonacoEditorHandle>();
	const screen = await render(
		<MonacoEditor
			{...baseProps}
			ref={ref}
			resolveEffectTypes
			onChange={(value) => changes.push(value)}
			onCursorChange={(line, column) => cursors.push([line, column])}
		/>
	);

	await vi.waitFor(() => expect(fake.state.cursorListener).toBeDefined());
	expect(cursors).toContainEqual([1, 1]);
	expect(cursors.length).toBeGreaterThan(0);
	expect(fake.state.preloads).toBeGreaterThan(0);
	expect(ref.current?.getValue()).toBe('{"type":"string"}');

	fake.state.changeListener?.();
	expect(changes).toEqual(['{"type":"string"}']);

	fake.state.cursorListener?.({ position: { lineNumber: 3, column: 4 } });
	expect(cursors.at(-1)).toEqual([3, 4]);

	expect(await screen.getByTestId('editor').element()).toBeInstanceOf(HTMLElement);
});

test('updates the model, the position and the options when props change', async () => {
	const ref = createRef<MonacoEditorHandle>();
	const screen = await render(<MonacoEditor {...baseProps} ref={ref} />);

	// Same value: the effect returns without touching the model.
	await screen.rerender(<MonacoEditor {...baseProps} ref={ref} />);

	fake.state.position = null;
	await screen.rerender(<MonacoEditor {...baseProps} value={'{"type":"number"}'} ref={ref} />);

	await vi.waitFor(() => expect(ref.current?.getValue()).toBe('{"type":"number"}'));

	fake.state.position = { lineNumber: 2, column: 1 };
	await screen.rerender(<MonacoEditor {...baseProps} value={'{"type":"array"}'} ref={ref} />);

	await vi.waitFor(() => expect(fake.state.positions.at(-1)).toEqual({ lineNumber: 2, column: 1 }));
});

test('applies a new theme and read-only mode', async () => {
	const ref = createRef<MonacoEditorHandle>();
	const screen = await render(<MonacoEditor {...baseProps} ref={ref} />);
	const host = (await screen.getByTestId('editor').element()) as HTMLElement;

	await screen.rerender(<MonacoEditor {...baseProps} theme="utilize-dark" ref={ref} />);
	await vi.waitFor(() => expect(fake.state.themes).toContain('utilize-dark'));

	await screen.rerender(<MonacoEditor {...baseProps} readOnly ref={ref} />);
	await vi.waitFor(() =>
		expect(fake.state.options).toContainEqual({ readOnly: true, domReadOnly: true })
	);
	expect(host.querySelector('textarea')?.getAttribute('inputmode')).toBe('none');

	await screen.rerender(<MonacoEditor {...baseProps} ref={ref} />);
	await vi.waitFor(() =>
		expect(host.querySelector('textarea')?.hasAttribute('inputmode')).toBe(false)
	);
});

test('hides the on-screen keyboard on a read-only touch device', async () => {
	const hide = vi.fn();
	Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 1 });
	Object.defineProperty(navigator, 'virtualKeyboard', { configurable: true, value: { hide } });

	try {
		const ref = createRef<MonacoEditorHandle>();
		const screen = await render(<MonacoEditor {...baseProps} readOnly ref={ref} />);
		const host = (await screen.getByTestId('editor').element()) as HTMLElement;

		host.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
		expect(hide).toHaveBeenCalled();

		await screen.unmount();
		host.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
		expect(hide).toHaveBeenCalledTimes(1);
	} finally {
		delete (navigator as { maxTouchPoints?: number }).maxTouchPoints;
		delete (navigator as { virtualKeyboard?: unknown }).virtualKeyboard;
	}
});

test('formats through the built-in action and restores read-only', async () => {
	const ref = createRef<MonacoEditorHandle>();
	const screen = await render(<MonacoEditor {...baseProps} ref={ref} />);

	fake.state.readOnly = false;
	ref.current?.format();
	await vi.waitFor(() => expect(fake.state.formats).toBe(1));
	expect(fake.state.actions).toContain('editor.action.formatDocument');

	fake.state.readOnly = true;
	fake.state.options.length = 0;
	ref.current?.format();
	await vi.waitFor(() => expect(fake.state.formats).toBe(2));
	expect(fake.state.options).toContainEqual({ readOnly: false, domReadOnly: false });
	expect(fake.state.options.at(-1)).toEqual({ readOnly: true, domReadOnly: true });

	ref.current?.focus();
	ref.current?.focusAt(0, -1);
	expect(fake.state.focuses).toBe(2);
	expect(fake.state.positions.at(-1)).toEqual({ lineNumber: 1, column: 1 });

	await screen.unmount();
});

test('does nothing when the editor has no format action', async () => {
	const ref = createRef<MonacoEditorHandle>();
	const screen = await render(<MonacoEditor {...baseProps} ref={ref} />);

	fake.state.hasAction = false;
	ref.current?.format();
	await vi.waitFor(() => expect(fake.state.actions).toContain('editor.action.formatDocument'));
	expect(fake.state.formats).toBe(0);

	await screen.unmount();
});
