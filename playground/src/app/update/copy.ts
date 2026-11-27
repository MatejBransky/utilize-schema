import { CopyCode, FormatEditor, WaitBeforeClearingCopy } from '../commands';
import type { HandlerMap } from './types';

export const copyHandlers = {
	ClickedCopyCode: ($) => {
		const model = $.model;
		return $.run(CopyCode.make({ fallback: model.code }));
	},
	CopiedCode: ($, message) => {
		const model = $.model;
		const token = model.copyToken + 1;

		return $.evolve({ copiedFor: message.value, copyToken: token }).run(
			WaitBeforeClearingCopy.make({ token })
		);
	},
	FailedCopy: ($) => {
		return $.evolve({ copiedFor: null });
	},
	CopyFeedbackExpired: ($, message) => {
		const model = $.model;
		return message.token === model.copyToken ? $.evolve({ copiedFor: null }) : model;
	},
	ClickedFormatEditor: ($, message) => {
		return $.run(FormatEditor.make({ editorId: message.editorId }));
	},
} satisfies Partial<HandlerMap>;
