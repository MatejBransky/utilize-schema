import { parse } from '@utilize/json-schema';
import { useEffect } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cleanup, renderHook } from 'vitest-browser-react';

import { defaultFormatMode } from '../formatMode';
import { generateCodeFor } from '../generateCode';
import type { RuntimeSource } from '../generateCode';
import { emitJavaScript } from '../monaco/transpile';
import { runtimeTargetIds } from '../targets';
import type { RuntimeTargetId, TargetId } from '../targets';
import { createValidatorClient } from './ValidatorClient';
import type { ValidatorClient } from './ValidatorClient';
import { useValidatorResults } from './useValidatorResults';
import type { ValidationState } from './useValidatorResults';

vi.mock('../monaco/transpile', () => ({ emitJavaScript: vi.fn() }));
vi.mock('./ValidatorClient', () => ({ createValidatorClient: vi.fn() }));

interface HookProps {
	target: TargetId;
	runtime: RuntimeSource;
	data: string;
}

const run = vi.fn<ValidatorClient['run']>();
const cancel = vi.fn<ValidatorClient['cancel']>();
const dispose = vi.fn();

beforeEach(() => {
	vi.mocked(emitJavaScript).mockReset().mockResolvedValue('emitted javascript');
	vi.mocked(createValidatorClient).mockReset().mockReturnValue({ run, cancel, dispose });
	run.mockReset().mockImplementation(async (_data, sources) => {
		const target: RuntimeTargetId = sources.zod ? 'zod' : 'effect';

		return { [target]: { ok: true, issues: [] } };
	});
	cancel.mockReset();
	dispose.mockReset();
});

afterEach(async () => {
	await cleanup();
});

const booleanCases = runtimeTargetIds.flatMap((target) =>
	[true, false].map((schema) => ({ target, schema }))
);

test.each(booleanCases)(
	'$target sends a $schema root through the worker',
	async ({ target, schema }) => {
		const { root } = await parse(schema, { cwd: '/', fileName: 'schema.json' });
		const { runtime } = generateCodeFor(target, root, defaultFormatMode);

		if (!runtime || runtime.status !== 'generated') {
			throw new Error('Expected generated runtime source.');
		}

		const hook = await renderHook(
			(props: HookProps | undefined) => {
				if (!props) {
					throw new Error('Hook props are required.');
				}

				return useValidatorResults(props.target, props.runtime, props.data, false);
			},
			{
				initialProps: {
					target,
					runtime,
					data: '{"value":1}',
				},
			}
		);

		await vi.waitFor(() => expect(hook.result.current.status).toBe('ready'));
		expect(emitJavaScript).toHaveBeenCalledWith(runtime.runtimeCode);
		expect(createValidatorClient).toHaveBeenCalledTimes(1);
		expect(run).toHaveBeenCalledWith(
			{ value: 1 },
			{
				[target]: { javascript: 'emitted javascript', rootName: 'Root' },
			}
		);
		await hook.unmount();
	}
);

test('cleanup cancels posted work when the next state has no runnable validator', async () => {
	run.mockReturnValue(new Promise<never>(() => {}));
	const hook = await renderHook(
		(props: HookProps | undefined) => {
			if (!props) {
				throw new Error('Hook props are required.');
			}

			return useValidatorResults(props.target, props.runtime, props.data, false);
		},
		{
			initialProps: {
				target: 'zod',
				runtime: generated('code', 'schema'),
				data: '"valid"',
			},
		}
	);

	await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(1));
	await hook.rerender({
		target: 'zod',
		runtime: generated('code', 'schema'),
		data: '{',
	});

	await vi.waitFor(() => expect(hook.result.current.status).toBe('invalid-json'));
	expect(cancel).toHaveBeenCalledWith('zod');
	expect(run).toHaveBeenCalledTimes(1);
	await hook.unmount();
});

test('transpiling superseded code does not post stale work to the worker', async () => {
	let resolveOld!: (javascript: string) => void;
	const oldJavascript = new Promise<string>((resolve) => {
		resolveOld = resolve;
	});
	vi.mocked(emitJavaScript).mockImplementation((code) =>
		code === 'old code' ? oldJavascript : Promise.resolve('new javascript')
	);

	const hook = await renderHook(
		(props: HookProps | undefined) => {
			if (!props) {
				throw new Error('Hook props are required.');
			}

			return useValidatorResults(props.target, props.runtime, props.data, false);
		},
		{
			initialProps: {
				target: 'zod',
				runtime: generated('old code', 'oldSchema'),
				data: '"old"',
			},
		}
	);

	await vi.waitFor(() => expect(emitJavaScript).toHaveBeenCalledWith('old code'));
	await hook.rerender({
		target: 'zod',
		runtime: generated('new code', 'newSchema'),
		data: '"new"',
	});
	resolveOld('old javascript');

	await vi.waitFor(() => expect(emitJavaScript).toHaveBeenCalledWith('new code'));
	await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(1));
	expect(run).toHaveBeenCalledWith('new', {
		zod: { javascript: 'new javascript', rootName: 'newSchema' },
	});
	await hook.unmount();
});

function generated(code: string, rootName: string): RuntimeSource {
	return { status: 'generated', code, runtimeCode: code, rootName };
}

test('a failed generator reports its own error instead of blaming the schema', async () => {
	const hook = await renderHook(
		(props: HookProps | undefined) => {
			if (!props) {
				throw new Error('Hook props are required.');
			}

			return useValidatorResults(props.target, props.runtime, props.data, false);
		},
		{
			initialProps: {
				target: 'zod',
				runtime: { status: 'failed', error: new Error(String.raw`Unsupported pattern "\-"`) },
				data: '"x"',
			},
		}
	);

	await vi.waitFor(() =>
		expect(hook.result.current).toEqual({
			status: 'error',
			message: String.raw`Unsupported pattern "\-"`,
		})
	);
	expect(emitJavaScript).not.toHaveBeenCalled();
	await hook.unmount();
});

test('never commits the previous report under a new target', async () => {
	const committed: ValidationState[] = [];

	const hook = await renderHook(
		(props: HookProps | undefined) => {
			if (!props) {
				throw new Error('Hook props are required.');
			}

			const state = useValidatorResults(props.target, props.runtime, props.data, false);

			useEffect(() => {
				committed.push(state);
			}, [state]);

			return state;
		},
		{
			initialProps: {
				target: 'zod',
				runtime: generated('zod code', 'zodSchema'),
				data: '"common"',
			},
		}
	);

	await vi.waitFor(() => expect(hook.result.current.status).toBe('ready'));
	committed.length = 0;

	await hook.rerender({
		target: 'effect',
		runtime: generated('effect code', 'effectSchema'),
		data: '"common"',
	});

	expect(committed[0]).toEqual({ status: 'running' });
	await hook.unmount();
});
