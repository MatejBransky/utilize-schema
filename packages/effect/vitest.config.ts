import { defineConfig } from 'vitest/config';

import { createReporters } from '../../scripts/vitest-reporters.mjs';

export default defineConfig({
	test: {
		setupFiles: ['./test/setup.ts'],
		reporters: createReporters('@utilize/effect tests', 'effect'),
		coverage: {
			include: ['src/**'],
			reporter: ['lcov', 'json'],
		},
	},
});
