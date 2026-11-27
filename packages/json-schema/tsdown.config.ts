import { defineConfig } from 'tsdown';

export default defineConfig({
	entry: {
		index: 'src/index.ts',
		formats: 'src/formats.ts',
		node: 'src/node/index.ts',
	},
	format: 'esm',
	dts: true,
	clean: true,
	platform: 'node',
	outExtensions: () => ({ js: '.mjs', dts: '.d.ts' }),
	deps: {
		neverBundle: ['json-schema'],
	},
});
