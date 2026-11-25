import { defineConfig } from 'vitest/config';

const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';

export default defineConfig({
	test: {
		setupFiles: ['./test/setup.ts'],
		reporters: isGitHubActions
			? ['default', ['github-actions', { jobSummary: { title: '@utilize/typescript tests' } }]]
			: ['default'],
	},
});
