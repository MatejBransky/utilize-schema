import { playwright } from '@vitest/browser-playwright';
import { defineConfig, mergeConfig } from 'vitest/config';

import viteConfig from './vite.config.ts';

const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';

/**
 * Tests that need a real browser: React rendering with `vitest-browser-react`,
 * the Monaco TypeScript worker, and drag and drop (`DataTransfer`). Everything
 * else runs in Node, so CI only pays the Chromium startup for this project.
 */
const browserTests = [
	'src/**/*.test.tsx',
	'src/drop.test.ts',
	'src/monaco/transpile.test.ts',
	'src/monaco/types.test.ts',
];

export default mergeConfig(
	viteConfig,
	defineConfig({
		test: {
			reporters: isGitHubActions
				? ['default', ['github-actions', { jobSummary: { title: 'playground browser tests' } }]]
				: ['default'],
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
