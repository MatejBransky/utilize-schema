import type { CustomNameResolver } from '@utilize/json-schema';

import type { CustomSchemaResolver, InferenceMode } from './render/context';

export interface GenerateOptions {
	/** Overrides the name allocated for a standalone schema. */
	customNameResolver?: CustomNameResolver;
	/** Emits a caller-provided TypeScript type for a matching schema node. */
	customSchemaResolver?: CustomSchemaResolver;
	/** `spec` (default) keeps scalar keywords `unknown`; `pragmatic` infers their type. */
	inference?: InferenceMode;
}
