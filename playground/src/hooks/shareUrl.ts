import type { KeywordPolicy } from '@utilize/json-schema';

import type { SchemaFile } from '../bundle';
import type { FormatMode } from '../formatMode';
import type { InferenceMode } from '../generateCode';
import { playgroundParams } from '../playgroundUrl';
import { encodeState } from '../playgroundState';
import type { TargetId } from '../targets';

export interface SharedSettings {
	files: SchemaFile[];
	target: TargetId;
	keywordPolicy: KeywordPolicy;
	formatMode: FormatMode;
	inference: InferenceMode;
	data: string;
}

/** Builds the share URL with the state hash and the query parameters. */
export function shareUrl({
	files,
	target,
	keywordPolicy,
	formatMode,
	inference,
	data,
}: SharedSettings): URL {
	const encoded = encodeState({
		files,
		target,
		keywordPolicy,
		formatMode,
		inference: target === 'typescript' ? inference : 'spec',
		data,
	});
	const url = new URL(location.href);

	url.searchParams.delete(playgroundParams.example);
	url.searchParams.delete(playgroundParams.generator);
	url.searchParams.set(playgroundParams.keywordPolicy, keywordPolicy);
	url.searchParams.set(playgroundParams.formatMode, formatMode);

	if (target === 'typescript') {
		url.searchParams.set(playgroundParams.inference, inference);
	} else {
		url.searchParams.delete(playgroundParams.inference);
	}

	url.hash = `data=${encoded}`;

	return url;
}
