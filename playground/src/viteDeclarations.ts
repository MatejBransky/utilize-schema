import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize, relative, sep } from 'node:path';

export function collectDeclarations(entry: string, root: string): Record<string, string> {
	const files: Record<string, string> = {};
	const seen = new Set<string>();
	const queue = [entry];

	for (let file = nextUnseenFile(queue, seen); file !== null; file = nextUnseenFile(queue, seen)) {
		const content = readDeclaration(file);

		if (content === null) {
			continue;
		}

		files[relative(root, file).split(sep).join('/')] = content;

		for (const match of content.matchAll(/(?:from|import)\s*\(?\s*["'](\.[^"']+)["']/g)) {
			queue.push(normalize(join(dirname(file), match[1])));
		}
	}

	return files;
}

function nextUnseenFile(queue: string[], seen: Set<string>): string | null {
	while (queue.length > 0) {
		const file = queue.pop()!;

		if (!seen.has(file)) {
			seen.add(file);
			return file;
		}
	}

	return null;
}

function readDeclaration(file: string): string | null {
	if (!existsSync(file)) {
		return null;
	}

	return readFileSync(file, 'utf8')
		.replaceAll(/(from\s+["'])(\.[^"']+)\.ts(["'])/g, '$1$2.d.ts$3')
		.replaceAll(/(import\(\s*["'])(\.[^"']+)\.ts(["']\s*\))/g, '$1$2.d.ts$3');
}
