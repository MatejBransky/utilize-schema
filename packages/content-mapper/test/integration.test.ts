import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterAll, beforeAll, expect, test } from 'vitest';

const packageRoot = join(__dirname, '..');
const fixtures = join(__dirname, 'fixtures');
const fixture = join(fixtures, 'person.jsonschema');
const register = join(packageRoot, 'dist', 'register.mjs');
const tsc = join(
	packageRoot,
	'node_modules',
	'.bin',
	process.platform === 'win32' ? 'tsc.cmd' : 'tsc'
);
const contentMapperLink = join(fixtures, 'node_modules', '@utilize', 'content-mapper');
const mapperScript = join(fixtures, 'main.mjs');
const effectScript = join(fixtures, 'effect.mjs');
const frame = (body: string) => `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`;

type MapperResponse = {
	id: unknown;
	error?: { code: number; message: string };
	result?: unknown;
};

function responseAt(responses: MapperResponse[], index: number): MapperResponse {
	const response = responses[index];

	if (!response) {
		throw new Error(`Missing mapper response ${index}.`);
	}

	return response;
}

// The script imports a `.jsonschema` file, which only the content mapper can
// resolve, so it is written at runtime: a committed copy would look like dead
// code to the static analysis.
const script = `import Person from './person.jsonschema';

const valid = Person.safeParse({ name: 'Ada', age: 36 });
const invalid = Person.safeParse({ name: 1 });

console.log(JSON.stringify({ valid: valid.success, invalid: invalid.success }));
`;

const effectSource = `import { Schema } from 'effect';

import Person from './person.jsonschema';

console.log(JSON.stringify(Schema.decodeUnknownSync(Person)({ name: 'Ada', age: 36 })));
`;

beforeAll(() => {
	mkdirSync(join(fixtures, 'node_modules', '@utilize'), { recursive: true });
	writeFileSync(mapperScript, script);
	writeFileSync(effectScript, effectSource);

	if (!existsSync(contentMapperLink)) {
		// A `dir` symlink needs Developer Mode or admin rights on Windows.
		symlinkSync(packageRoot, contentMapperLink, process.platform === 'win32' ? 'junction' : 'dir');
	}
});

afterAll(() => {
	rmSync(join(fixtures, 'node_modules'), { recursive: true, force: true });
	rmSync(mapperScript, { force: true });
	rmSync(effectScript, { force: true });
});

test('the Node loader turns an import into a Zod module', () => {
	const output = execFileSync(process.execPath, ['--import', register, mapperScript], {
		cwd: packageRoot,
		encoding: 'utf8',
	});

	expect(output.trim()).toBe('{"valid":true,"invalid":false}');
});

test('the Node loader turns an import into an Effect Schema module', () => {
	const output = execFileSync(process.execPath, ['--import', register, effectScript], {
		cwd: packageRoot,
		encoding: 'utf8',
		env: { ...process.env, UTILIZE_SCHEMA_TARGET: 'effect' },
	});

	expect(JSON.parse(output)).toEqual({ name: 'Ada', age: 36 });
});

test('the Node loader rejects the types-only target', () => {
	const child = spawnSync(process.execPath, ['--import', register, mapperScript], {
		cwd: packageRoot,
		encoding: 'utf8',
		env: { ...process.env, UTILIZE_SCHEMA_TARGET: 'typescript' },
	});

	expect(child.status).not.toBe(0);
	expect(child.stderr).toContain('types-only');
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

test('TypeScript 7.1 type-checks the typescript target', () => {
	expect(() =>
		execFileSync(tsc, ['--noEmit', '--runExternalCode'], {
			cwd: join(fixtures, 'typescript'),
			encoding: 'utf8',
			stdio: 'pipe',
		})
	).not.toThrow();
}, 30_000);

test('the mapper survives malformed frames and keeps stacks out of responses', () => {
	const related = join(fixtures, 'related.jsonschema');
	const relatedContent = readFileSync(related, 'utf8');
	const request = (id: number, method: string, params: unknown = {}) =>
		frame(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
	const input = [
		frame('{ not json'),
		request(1, 'nope'),
		'Bad-Header: 1\r\n\r\n',
		frame('null'),
		'Content-Length: 16777217\r\n\r\n',
		request(2, 'initialize'),
		request(3, 'openProject', { projectHandle: 'p1', options: { target: 'zod' } }),
		request(4, 'transform', { fileName: related, content: relatedContent, projectHandle: 'p1' }),
		request(5, 'openProject', { projectHandle: 'p2', options: { nope: true } }),
	];
	// A bad or oversized header drops whatever is buffered with it, so each one
	// goes in its own write; a single stdin payload would lose the frame after it.
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
	expect(child.stderr).toContain('the limit is 16777216');

	const responses = child.stdout
		.split(/Content-Length: \d+\r\n\r\n/)
		.filter(Boolean)
		.map((body) => JSON.parse(body) as MapperResponse);

	expect(responses.map((response) => response.id)).toEqual([null, 1, null, null, 2, 3, 4, 5]);
	expect(responseAt(responses, 0).error?.code).toBe(-32_700);
	expect(responseAt(responses, 1).error?.message).toBe('Unknown content mapper method nope');
	expect(responseAt(responses, 2).error?.code).toBe(-32_600);
	expect(responseAt(responses, 3).error?.message).toBe('Request too large');
	expect((responseAt(responses, 4).result as { diagnosticSource?: string }).diagnosticSource).toBe(
		'utilize-schema '
	);
	expect((responseAt(responses, 5).result as { configIdentity?: string }).configIdentity).toBe(
		'{"target":"zod"}'
	);
	expect((responseAt(responses, 6).result as { watchedFiles?: string[] }).watchedFiles).toContain(
		fixture
	);
	expect(
		(responseAt(responses, 7).result as { optionDiagnostics?: { messageText: string }[] })
			.optionDiagnostics?.[0]?.messageText
	).toContain('Unknown content mapper option "nope"');
});

test('resyncs after a bad header in the same chunk', () => {
	const input = `Bad-Header: 1\r\n\r\n${frame(
		JSON.stringify({ jsonrpc: '2.0', id: 7, method: 'initialize', params: {} })
	)}`;
	const child = spawnSync(process.execPath, [join(packageRoot, 'dist', 'mapper.mjs')], {
		input,
		encoding: 'utf8',
	});

	expect(child.status).toBe(0);
	expect(child.stdout).toContain('"id":7');
});

test('answers oversized frames instead of hanging the transform', () => {
	const child = spawnSync(process.execPath, [join(packageRoot, 'dist', 'mapper.mjs')], {
		input: 'Content-Length: 16777217\r\n\r\n',
		encoding: 'utf8',
	});

	expect(child.status).toBe(0);
	expect(child.stderr).toContain('the limit is 16777216');
	expect(child.stdout).toContain('Request too large');
});
