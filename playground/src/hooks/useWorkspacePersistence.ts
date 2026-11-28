import type { KeywordPolicy } from '@utilize/json-schema';
import { useEffect } from 'react';

import type { SchemaFile } from '../bundle';
import type { FormatMode } from '../formatMode';
import type { InferenceMode } from '../generateCode';
import { PLAYGROUND_STORAGE_KEY } from '../playgroundState';
import type { TargetId } from '../targets';

export interface PersistedWorkspace {
	files: SchemaFile[];
	target: TargetId;
	keywordPolicy: KeywordPolicy;
	formatMode: FormatMode;
	inference: InferenceMode;
	data: string;
}

/** Mirrors the workspace into localStorage so a reload restores it. */
export function useWorkspacePersistence({
	files,
	target,
	keywordPolicy,
	formatMode,
	inference,
	data,
}: PersistedWorkspace) {
	useEffect(() => {
		try {
			localStorage.setItem(
				PLAYGROUND_STORAGE_KEY,
				JSON.stringify({ files, target, keywordPolicy, formatMode, inference, data })
			);
		} catch {
			// Storage can be full or denied. Keep the workspace in memory.
		}
	}, [files, target, keywordPolicy, formatMode, inference, data]);
}
