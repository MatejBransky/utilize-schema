import { defineConfig } from 'vitest/config';

import { createReporters } from '../../scripts/vitest-reporters.mjs';

export default defineConfig({
	test: {
		reporters: createReporters('@utilize/content-mapper tests', 'content-mapper'),
		coverage: {
			include: ['src/**'],
			// These files only run in the mapper or loader child process that
			// TypeScript and Node spawn; V8 coverage in the test process cannot
			// see them. The integration tests exercise them end to end, and each
			// file carries the matching `coverage-gaps` suppression.
			exclude: [
				'src/loader.ts',
				'src/mapper.ts',
				'src/mapper-server.ts',
				'src/register.ts',
				'src/rpc.ts',
			],
			reporter: ['lcov', 'json'],
		},
	},
});
