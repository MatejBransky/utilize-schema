import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		setupFiles: [__dirname + '/test/setup.ts'],
	},
});
