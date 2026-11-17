import { defineConfig } from 'tsdown';

export default defineConfig({
	entry: ['src/index.ts'],
	format: 'esm',
	dts: true,
	clean: true,
	platform: 'node',
	outExtensions: () => ({ js: '.mjs', dts: '.d.ts' }),
});
