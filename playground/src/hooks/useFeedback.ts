import { useState } from 'react';
import type { RefObject } from 'react';

import type { KeywordPolicy } from '@utilize/json-schema';

import type { SchemaFile } from '../bundle';
import type { FormatMode } from '../formatMode';
import type { InferenceMode } from '@utilize/typescript';
import type { MonacoEditorHandle } from '../monaco/MonacoEditor';
import type { TargetId } from '../targets';

import { shareUrl } from './shareUrl';
import type { SharedSettings } from './shareUrl';
import { useCopyFeedback } from './useCopyFeedback';

/** Copy-to-clipboard feedback and the share flow that rewrites the URL hash. */
export function useFeedback(
	files: SchemaFile[],
	target: TargetId,
	keywordPolicy: KeywordPolicy,
	formatMode: FormatMode,
	inference: InferenceMode,
	code: string,
	data: string,
	codeEditorRef: RefObject<MonacoEditorHandle | null>
) {
	const [sharedSnapshot, setSharedSnapshot] = useState<SharedSettings | null>(null);
	const { copied, copyCode } = useCopyFeedback(code, codeEditorRef);
	const settings = { files, target, keywordPolicy, formatMode, inference, data };
	const shared =
		sharedSnapshot !== null &&
		sharedSnapshot.files === files &&
		sharedSnapshot.target === target &&
		sharedSnapshot.keywordPolicy === keywordPolicy &&
		sharedSnapshot.formatMode === formatMode &&
		sharedSnapshot.inference === inference &&
		sharedSnapshot.data === data;

	async function share() {
		const url = shareUrl(settings);
		history.replaceState(null, '', url);
		setSharedSnapshot(settings);

		try {
			await navigator.clipboard.writeText(url.href);
		} catch {
			// The URL hash is still updated even when clipboard access is denied.
		}
	}

	return { copied, shared, copyCode, share };
}
