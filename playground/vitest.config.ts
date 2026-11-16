import { playwright } from '@vitest/browser-playwright';
import { defineConfig, mergeConfig } from 'vitest/config';

import viteConfig from './vite.config.ts';

const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';

export default mergeConfig(
	viteConfig,
	defineConfig({
		test: {
			setupFiles: ['./src/test/setup.ts'],
			reporters: isGitHubActions
				? ['default', ['github-actions', { jobSummary: { title: 'playground browser tests' } }]]
				: ['default'],
			browser: {
				enabled: true,
				headless: true,
				provider: playwright(),
				instances: [{ browser: 'chromium' }],
			},
		},
	})
);
