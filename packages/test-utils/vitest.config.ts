import { defineConfig } from 'vitest/config';

import { createReporters } from '../../scripts/vitest-reporters.mjs';

export default defineConfig({
	test: {
		reporters: createReporters('@utilize/test-utils tests', 'test-utils'),
		coverage: {
			include: ['src/**'],
			reporter: ['lcov', 'json'],
		},
	},
});
