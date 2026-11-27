import { Command, Component } from '@effect/ui';
import { Effect, Schema } from 'effect';

import { encodeState } from '../playgroundState';
import { playgroundParams } from '../playgroundUrl';
import { generateOutput } from './generation';
import { editorHandle } from './monaco';
import { AppMessage } from './messages';
import {
	FormatModeSchema,
	KeywordPolicySchema,
	RuntimeModel,
	SchemaFileModel,
	Target,
	signatureOf,
	toRuntimeModel,
	toRuntimeSource,
} from './model';
import type { AppModel } from './model';
import { cancelValidation, validateGenerated } from './validation';

const GeneratedMessage = (output: Awaited<ReturnType<typeof generateOutput>>) =>
	AppMessage.Generated({
		code: output.code,
		runtime: toRuntimeModel(output.runtime),
		problems: output.problems,
	});

const Generate = Command.make(
	'Generate',
	{
		args: {
			files: Schema.Array(SchemaFileModel),
			target: Target,
			keywordPolicy: KeywordPolicySchema,
			formatMode: FormatModeSchema,
			exampleId: Schema.NullOr(Schema.String),
		},
		mode: 'switch',
	},
	(args) =>
		Effect.sleep('300 millis').pipe(
			Effect.andThen(Effect.promise(() => generateOutput(args))),
			Effect.map(GeneratedMessage)
		)
);

const Validate = Command.make(
	'Validate',
	{
		args: {
			target: Target,
			runtime: Schema.NullOr(RuntimeModel),
			data: Schema.String,
			busy: Schema.Boolean,
		},
		mode: 'switch',
	},
	(args) => {
		if (args.busy) {
			return Effect.succeed(AppMessage.Validated({ state: { status: 'running' } }));
		}

		return Effect.sleep('200 millis').pipe(
			Effect.andThen(
				Effect.promise(() =>
					validateGenerated(args.target, toRuntimeSource(args.runtime), args.data)
				)
			),
			Effect.map((state) => AppMessage.Validated({ state })),
			Effect.onInterrupt(() => Effect.sync(() => cancelValidation(args.target)))
		);
	}
);

export const CopyCode = Command.make(
	'CopyCode',
	{ args: { fallback: Schema.String } },
	({ fallback }) =>
		Effect.promise(async () => {
			const text = editorHandle('code')?.getValue() ?? fallback;

			try {
				await navigator.clipboard.writeText(text);

				return AppMessage.CopiedCode({ value: text });
			} catch {
				return AppMessage.FailedCopy();
			}
		})
);

export const Share = Command.make(
	'Share',
	{
		args: {
			files: Schema.Array(SchemaFileModel),
			target: Target,
			keywordPolicy: KeywordPolicySchema,
			formatMode: FormatModeSchema,
			data: Schema.String,
		},
	},
	(args) =>
		Effect.sync(() => {
			const signature = signatureOf(args);
			const encoded = encodeState({ ...args, files: [...args.files] });
			const url = new URL(location.href);

			url.searchParams.delete(playgroundParams.example);
			url.searchParams.delete(playgroundParams.generator);
			url.searchParams.set(playgroundParams.keywordPolicy, args.keywordPolicy);
			url.searchParams.set(playgroundParams.formatMode, args.formatMode);
			url.hash = `data=${encoded}`;
			history.replaceState(null, '', url);

			void navigator.clipboard.writeText(url.href).catch(() => {});

			return AppMessage.Shared({ signature });
		})
);

export const FormatEditor = Command.make(
	'FormatEditor',
	{ args: { editorId: Schema.String } },
	({ editorId }) =>
		Effect.sync(() => {
			editorHandle(editorId)?.format();
		}).pipe(Effect.as(Component.noop))
);

export const WaitBeforeClearingCopy = Command.make(
	'WaitBeforeClearingCopy',
	{ args: { token: Schema.Number }, mode: 'switch' },
	({ token }) =>
		Effect.sleep('2 seconds').pipe(Effect.as(AppMessage.CopyFeedbackExpired({ token })))
);

export function generateCommand(model: AppModel) {
	return Generate.make({
		files: [...model.files],
		target: model.target,
		keywordPolicy: model.keywordPolicy,
		formatMode: model.formatMode,
		exampleId: model.exampleId,
	});
}

export function validateCommand(model: AppModel) {
	return Validate.make({
		target: model.target,
		runtime: model.runtime,
		data: model.data,
		busy: model.busy,
	});
}
