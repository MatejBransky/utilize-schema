import { defineConfig } from 'tsdown';

export default defineConfig({
	entry: { refactor: 'bench/refactorEntry.ts' },
	format: 'esm',
	dts: false,
	clean: true,
	platform: 'node',
	outDir: 'node_modules/.cache/utilize-bench',
	outExtensions: () => ({ js: '.mjs' }),
});
