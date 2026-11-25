/// <reference types="vite/client" />
import { expect, test } from 'vitest';

import indexHtml from '../index.html?raw';

/**
 * The Vite entry is a runtime file with no importer. Reading it keeps the shell
 * under the analysis graph, and asserts the two things `main.tsx` needs: the
 * mount point and the module script.
 */
test('the entry HTML mounts the app into #root', () => {
	expect(indexHtml).toContain('<div id="root"></div>');
	expect(indexHtml).toContain('src="/src/main.tsx"');
});
