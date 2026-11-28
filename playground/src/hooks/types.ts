import type { KeywordPolicy } from '@utilize/json-schema';

import type { FormatMode } from '../formatMode';
import type { InferenceMode } from '../generateCode';
import type { TargetId } from '../targets';

/** State setters shared with modules that restore a workspace wholesale. */
export interface SettingsSetters {
	setTarget: (target: TargetId) => void;
	setKeywordPolicy: (policy: KeywordPolicy) => void;
	setFormatMode: (mode: FormatMode) => void;
	setInference: (value: InferenceMode) => void;
	setData: (data: string) => void;
}
