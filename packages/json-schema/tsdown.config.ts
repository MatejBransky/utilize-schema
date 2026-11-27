import { defineConfig } from 'tsdown';

export default defineConfig({
	entry: { index: 'src/index.ts', node: 'src/node/index.ts', runtime: 'src/runtime.ts' },
	format: 'esm',
	dts: true,
	clean: true,
	platform: 'node',
	outExtensions: () => ({ js: '.mjs', dts: '.d.ts' }),
	deps: {
		neverBundle: ['json-schema'],
	},
});
