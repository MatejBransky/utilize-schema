import { playwright } from '@vitest/browser-playwright';
import { defineConfig, mergeConfig } from 'vitest/config';

import viteConfig from './vite.config.ts';
import { createReporters } from '../scripts/vitest-reporters.mjs';

/**
 * Tests that need a real browser: the Monaco TypeScript worker and transpile
 * path, and drag and drop (`DataTransfer`). Everything else runs in Node, so CI
 * only pays the Chromium startup for this project.
 */
const browserTests = [
	'src/app/App.browser.test.ts',
	'src/drop.test.ts',
	'src/monaco/transpile.test.ts',
	'src/monaco/types.test.ts',
];

export default mergeConfig(
	viteConfig,
	defineConfig({
		test: {
			reporters: createReporters('playground browser tests', 'playground'),
			coverage: {
				include: ['src/**'],
				reporter: ['lcov', 'json'],
			},
			projects: [
				{
					extends: true,
					test: {
						name: 'node',
						include: ['src/**/*.test.ts'],
						exclude: browserTests,
					},
				},
				{
					extends: true,
					test: {
						name: 'browser',
						include: browserTests,
						setupFiles: ['./src/test/setup.ts'],
						browser: {
							enabled: true,
							headless: true,
							provider: playwright(),
							instances: [{ browser: 'chromium' }],
						},
					},
				},
			],
		},
	})
);
