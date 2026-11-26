import { playwright } from '@vitest/browser-playwright';
import { defineConfig, mergeConfig } from 'vitest/config';

import viteConfig from './vite.config.ts';

const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';

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
