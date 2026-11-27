import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: './e2e',
	fullyParallel: false,
	workers: 1,
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? 'github' : 'list',
	use: {
		baseURL: 'http://localhost:5199',
		viewport: { width: 1200, height: 800 },
		permissions: ['clipboard-read', 'clipboard-write'],
		trace: process.env.CI ? 'on-first-retry' : 'off',
	},
	webServer: {
		command: 'pnpm exec vite --port 5199 --strictPort',
		url: 'http://localhost:5199',
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
	},
});
