import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';

import { afterAll, beforeAll, expect, test } from 'vitest';

const packageRoot = join(__dirname, '..');
const fixtures = join(__dirname, 'fixtures');
const register = join(packageRoot, 'dist', 'register.mjs');
const tsc = join(
	packageRoot,
	'node_modules',
	'.bin',
	process.platform === 'win32' ? 'tsc.cmd' : 'tsc'
);
const contentMapperLink = join(fixtures, 'node_modules', '@utilize', 'content-mapper');

beforeAll(() => {
	mkdirSync(join(fixtures, 'node_modules', '@utilize'), { recursive: true });

	if (!existsSync(contentMapperLink)) {
		// A `dir` symlink needs Developer Mode or admin rights on Windows.
		symlinkSync(packageRoot, contentMapperLink, process.platform === 'win32' ? 'junction' : 'dir');
	}
});

afterAll(() => {
	rmSync(join(fixtures, 'node_modules'), { recursive: true, force: true });
});

test('the Node loader turns an import into a Zod module', () => {
	const output = execFileSync(
		process.execPath,
		['--import', register, join(fixtures, 'main.mjs')],
		{ cwd: packageRoot, encoding: 'utf8' }
	);

	expect(output.trim()).toBe('{"valid":true,"invalid":false}');
});

test('TypeScript 7.1 type-checks an import through the content mapper', () => {
	expect(() =>
		execFileSync(tsc, ['--noEmit', '--runExternalCode'], {
			cwd: fixtures,
			encoding: 'utf8',
			stdio: 'pipe',
		})
	).not.toThrow();
}, 30_000);
