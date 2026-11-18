import { expect, test } from 'vitest';

import { createEditorOptions } from './options';

test('a read-only editor keeps its DOM textarea read-only', () => {
	expect(createEditorOptions({ readOnly: true, theme: 'utilize-light' })).toMatchObject({
		readOnly: true,
		domReadOnly: true,
	});
});

test('an editable editor allows text input', () => {
	expect(createEditorOptions({ readOnly: false, theme: 'utilize-light' })).toMatchObject({
		readOnly: false,
		domReadOnly: false,
	});
});
