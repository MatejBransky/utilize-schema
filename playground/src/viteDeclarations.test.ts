import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';

import { collectDeclarations } from './viteDeclarations';

const roots: string[] = [];

function fixture(files: Record<string, string>): { root: string; entry: string } {
	const root = mkdtempSync(join(tmpdir(), 'utilize-declarations-'));
	roots.push(root);

	for (const [name, content] of Object.entries(files)) {
		const path = join(root, name);
		mkdirSync(join(path, '..'), { recursive: true });
		writeFileSync(path, content);
	}

	return { root, entry: join(root, 'index.d.ts') };
}

afterEach(() => {
	for (const root of roots.splice(0)) {
		rmSync(root, { recursive: true, force: true });
	}
});

test('rewrites relative TypeScript specifiers to declarations', () => {
	const { root, entry } = fixture({
		'index.d.ts': "export * from './a.ts';\nimport('./b.ts');\n",
		'a.d.ts': "import type { B } from './b.ts';\nexport interface A { b: B }\n",
		'b.d.ts': 'export interface B { value: string }\n',
	});

	const files = collectDeclarations(entry, root);

	expect(files['index.d.ts']).toBe("export * from './a.d.ts';\nimport('./b.d.ts');\n");
	expect(files['a.d.ts']).toBe("import type { B } from './b.d.ts';\nexport interface A { b: B }\n");
	expect(files['b.d.ts']).toBe('export interface B { value: string }\n');
});

test('follows static, dynamic, and side-effect relative imports once', () => {
	const { root, entry } = fixture({
		'index.d.ts':
			"export * from './nested/a.ts';\nimport './side-effect.d.ts';\nimport('./nested/b.ts');\n",
		'nested/a.d.ts': "import('./index');\nexport interface A { value: string }\n",
		'nested/b.d.ts': "export * from './a.ts';\nexport interface B { value: number }\n",
		'side-effect.d.ts': 'export {};\n',
	});

	const files = collectDeclarations(entry, root);

	expect(Object.keys(files)).toEqual([
		'index.d.ts',
		'nested/b.d.ts',
		'nested/a.d.ts',
		'side-effect.d.ts',
	]);
});

test('ignores package imports and missing relative modules', () => {
	const { root, entry } = fixture({
		'index.d.ts': "import type { X } from 'package';\nimport './missing';\nexport {};\n",
	});

	expect(collectDeclarations(entry, root)).toEqual({
		'index.d.ts': "import type { X } from 'package';\nimport './missing';\nexport {};\n",
	});
	expect(collectDeclarations(join(root, 'missing.d.ts'), root)).toEqual({});
});
