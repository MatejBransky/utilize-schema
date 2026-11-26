// Regenerates the recorded per-dialect gaps. The measurement needs Vitest and
// the TypeScript compiler, so the suite test writes the file when the
// environment variable below is set.
import { spawnSync } from 'node:child_process';

const result = spawnSync('pnpm', ['exec', 'vitest', 'run', 'test/jsonSchemaTestSuite.test.ts'], {
	stdio: 'inherit',
	env: { ...process.env, UPDATE_SUITE_BASELINE: '1' },
});

process.exit(result.status ?? 1);
