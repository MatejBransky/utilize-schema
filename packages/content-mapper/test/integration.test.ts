import { execFileSync, spawnSync } from 'node:child_process';
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

test('the Node loader names the env var when the target is unknown', () => {
	const child = spawnSync(process.execPath, ['--import', register, mapperScript], {
		cwd: packageRoot,
		encoding: 'utf8',
		env: { ...process.env, UTILIZE_SCHEMA_TARGET: 'zdo' },
	});

	expect(child.status).not.toBe(0);
	expect(child.stderr).toContain('UTILIZE_SCHEMA_TARGET is "zdo"');
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

test('the mapper survives malformed frames and keeps stacks out of responses', () => {
	const frame = (body: string) => `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`;
	const input = [
		frame('{ not json'),
		frame(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'nope' })),
		'Bad-Header: 1\r\n\r\n',
		frame(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'initialize', params: {} })),
	];
	// The bad header drops whatever is buffered with it, so it goes in its own
	// write; a single stdin payload would lose the frame after it.
	const child = spawnSync(
		process.execPath,
		[
			'-e',
			`const { spawn } = require('node:child_process');
const parts = ${JSON.stringify(input)};
const mapper = spawn(process.execPath, [${JSON.stringify(join(packageRoot, 'dist', 'mapper.mjs'))}], { stdio: ['pipe', 'inherit', 'inherit'] });
mapper.on('exit', (code) => { process.exitCode = code ?? 1; });
(async () => {
	for (const part of parts) {
		mapper.stdin.write(part);
		await new Promise((resolve) => setTimeout(resolve, 50));
	}
	mapper.stdin.end();
})();`,
		],
		{ encoding: 'utf8' }
	);

	expect(child.status).toBe(0);
	expect(child.stderr).toContain('malformed content mapper message');
	expect(child.stderr).toContain('dropping bad content mapper header');

	const responses = child.stdout
		.split(/Content-Length: \d+\r\n\r\n/)
		.filter(Boolean)
		.map((body) => JSON.parse(body) as { id: unknown; error?: { code: number; message: string } });

	expect(responses.map((response) => response.id)).toEqual([null, 1, 2]);
	expect(responses[0]?.error?.code).toBe(-32_700);
	expect(responses[1]?.error?.message).toBe('Unknown content mapper method nope');
});
