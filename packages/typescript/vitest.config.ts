import { defineConfig } from 'vitest/config';

import { createReporters } from '../../scripts/vitest-reporters.mjs';

export default defineConfig({
	test: {
		setupFiles: ['./test/setup.ts'],
		reporters: createReporters('@utilize/typescript tests', 'typescript'),
		coverage: {
			include: ['src/**'],
			reporter: ['lcov', 'json'],
		},
	},
});
