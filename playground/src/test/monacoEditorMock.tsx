import type { Ref } from 'react';

import { forwardRef, useImperativeHandle } from 'react';

export function createMonacoEditorMock() {
	const MonacoEditor = forwardRef(function MonacoEditorMock(
		{ testId, value }: { testId?: string; value?: string },
		ref: Ref<unknown>
	) {
		useImperativeHandle(ref, () => ({
			format() {},
			autoFormat: async () => {},
			focus() {},
			focusAt() {},
			getValue: () => value ?? '',
		}));

		return <div data-testid={testId} data-value={value} />;
	});

	return { MonacoEditor };
}
