import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const BADGE_PATH = join(ROOT, '.github', 'badges', 'fallow-health.svg');
const IS_CHECK = process.argv.includes('--check');

const result = spawnSync('pnpm', ['exec', 'fallow', 'health', '--format', 'badge'], {
	cwd: ROOT,
	encoding: 'utf8',
});

if (result.error) {
	throw result.error;
}

if (result.status !== 0 && result.status !== 1) {
	process.stderr.write(result.stderr);
	process.exit(result.status ?? 1);
}

const badge = result.stdout;
const label = /aria-label="([^"]+)"/.exec(badge)?.[1];

if (!badge.startsWith('<svg') || !label) {
	throw new Error('Fallow did not return a valid health badge.');
}

if (IS_CHECK) {
	if (!existsSync(BADGE_PATH) || readFileSync(BADGE_PATH, 'utf8') !== badge) {
		console.error(
			`Fallow health badge is stale (${label}). Run "pnpm fallow:badge" and commit it.`
		);
		process.exit(1);
	}

	console.log(`Fallow health badge is current (${label}).`);
} else {
	mkdirSync(dirname(BADGE_PATH), { recursive: true });
	writeFileSync(BADGE_PATH, badge);
	console.log(`Wrote Fallow health badge (${label}).`);
}
