import { expect, test } from 'vitest';

import { mount } from './main';

test('mounts the playground into the given element', () => {
	const element = document.createElement('div');
	document.body.append(element);

	const root = mount(element);

	try {
		expect(element.childElementCount).toBeGreaterThan(0);
	} finally {
		root.unmount();
		element.remove();
	}
});
