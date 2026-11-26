import { defineConfig } from 'vitest/config';

const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';

export default defineConfig({
	test: {
		reporters: isGitHubActions
			? ['default', ['github-actions', { jobSummary: { title: '@utilize/json-schema tests' } }]]
			: ['default'],
		coverage: {
			include: ['src/**'],
			reporter: ['lcov', 'json'],
		},
	},
});
