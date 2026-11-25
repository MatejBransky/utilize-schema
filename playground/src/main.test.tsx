import { expect, test } from 'vitest';

import { mount } from './main';

test('mounts the playground into the given element', async () => {
	const element = document.createElement('div');
	document.body.append(element);

	const root = mount(element);

	try {
		// React renders concurrently, so the first paint is not synchronous.
		await expect.poll(() => element.childElementCount).toBeGreaterThan(0);
	} finally {
		root.unmount();
		element.remove();
	}
});
