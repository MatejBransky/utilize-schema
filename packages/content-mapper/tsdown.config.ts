import { defineConfig } from 'tsdown';

export default defineConfig({
	entry: ['src/index.ts', 'src/mapper.ts', 'src/register.ts', 'src/loader.ts', 'src/vite.ts'],
	format: 'esm',
	dts: true,
	clean: true,
	platform: 'node',
	outExtensions: () => ({ js: '.mjs', dts: '.d.ts' }),
	deps: {
		neverBundle: ['@utilize/effect', '@utilize/json-schema', '@utilize/typescript', '@utilize/zod'],
	},
});
