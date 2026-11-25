import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
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
const mapperScript = join(fixtures, 'main.mjs');

// The script imports a `.jsonschema` file, which only the content mapper can
// resolve, so it is written at runtime: a committed copy would look like dead
// code to the static analysis.
const script = `import Person from './person.jsonschema';

const valid = Person.safeParse({ name: 'Ada', age: 36 });
const invalid = Person.safeParse({ name: 1 });

console.log(JSON.stringify({ valid: valid.success, invalid: invalid.success }));
`;

beforeAll(() => {
	mkdirSync(join(fixtures, 'node_modules', '@utilize'), { recursive: true });
	writeFileSync(mapperScript, script);

	if (!existsSync(contentMapperLink)) {
		// A `dir` symlink needs Developer Mode or admin rights on Windows.
		symlinkSync(packageRoot, contentMapperLink, process.platform === 'win32' ? 'junction' : 'dir');
	}
});

afterAll(() => {
	rmSync(join(fixtures, 'node_modules'), { recursive: true, force: true });
	rmSync(mapperScript, { force: true });
});

test('the Node loader turns an import into a Zod module', () => {
	const output = execFileSync(process.execPath, ['--import', register, mapperScript], {
		cwd: packageRoot,
		encoding: 'utf8',
	});

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
