import { defineConfig } from 'vitest/config';

import { createReporters } from '../../scripts/vitest-reporters.mjs';

export default defineConfig({
	test: {
		reporters: createReporters('@utilize/json-schema tests', 'json-schema'),
		coverage: {
			include: ['src/**'],
			reporter: ['lcov', 'json'],
		},
	},
});
