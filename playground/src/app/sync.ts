import { Component, Mount } from '@effect/ui';
import { Effect, Schema, Stream } from 'effect';

import type { SchemaFile } from '../bundle';
import { PLAYGROUND_STORAGE_KEY } from '../playgroundState';
import { playgroundParams, updateUrl } from '../playgroundUrl';
import { THEME_STORAGE_KEY } from '../theme';
import type { ColorMode } from '../theme';

const SyncArgs = {
	target: Schema.Literals(['zod', 'effect', 'typescript']),
	keywordPolicy: Schema.Literals(['error', 'warn', 'ignore']),
	formatMode: Schema.Literals(['annotate', 'assert']),
	colorMode: Schema.Literals(['auto', 'light', 'dark']),
	theme: Schema.Literals(['light', 'dark']),
	files: Schema.Array(
		Schema.Struct({ id: Schema.String, name: Schema.String, content: Schema.String })
	),
	data: Schema.String,
};

type SyncArgs = Schema.Struct<typeof SyncArgs>['Type'];

interface PersistedWorkspace {
	files: SchemaFile[];
	target: SyncArgs['target'];
	keywordPolicy: SyncArgs['keywordPolicy'];
	formatMode: SyncArgs['formatMode'];
	data: string;
}

/**
 * Applies the resolved theme, persists the workspace, and writes the initial
 * settings into the URL once. Mounted on the workspace element.
 */
export const SyncState = Mount.make(
	'SyncState',
	{ args: SyncArgs },
	(_node: HTMLElement, _args, changes) => {
		let first = true;

		return Stream.runForEach(changes, (next) =>
			Effect.sync(() => {
				document.documentElement.dataset.theme = next.theme;
				persist(next);

				if (first) {
					first = false;
					syncInitialUrl(next);
				}
			})
		).pipe(Effect.as(Component.noop));
	}
);

function persist(next: SyncArgs) {
	try {
		localStorage.setItem(THEME_STORAGE_KEY, next.colorMode);

		const workspace: PersistedWorkspace = {
			files: [...next.files],
			target: next.target,
			keywordPolicy: next.keywordPolicy,
			formatMode: next.formatMode,
			data: next.data,
		};

		localStorage.setItem(PLAYGROUND_STORAGE_KEY, JSON.stringify(workspace));
	} catch {
		// Storage can be full or denied. Keep the workspace in memory.
	}
}

function syncInitialUrl(next: SyncArgs) {
	const url = new URL(location.href);

	if (
		url.hash ||
		(url.searchParams.get(playgroundParams.generator) === next.target &&
			url.searchParams.get(playgroundParams.keywordPolicy) === next.keywordPolicy &&
			url.searchParams.get(playgroundParams.formatMode) === next.formatMode)
	) {
		return;
	}

	updateUrl(
		{
			[playgroundParams.generator]: next.target,
			[playgroundParams.keywordPolicy]: next.keywordPolicy,
			[playgroundParams.formatMode]: next.formatMode,
		},
		'replace'
	);
}

export function colorModeAfter(mode: ColorMode): ColorMode {
	return mode === 'auto' ? 'light' : mode === 'light' ? 'dark' : 'auto';
}
