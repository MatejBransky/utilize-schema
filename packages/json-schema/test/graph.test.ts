import { describe, expect, test } from 'vitest';

import { reachesThrough } from '../src/graph';

const graph = new Map<number, number[]>([
	[1, [2]],
	[2, [3]],
	[3, [1]],
]);

describe('reachesThrough', () => {
	test('finds a direct and a transitive edge', () => {
		expect(reachesThrough(1, 2, (node) => graph.get(node) ?? [])).toBe(true);
		expect(reachesThrough(1, 3, (node) => graph.get(node) ?? [])).toBe(true);
	});

	test('stops when the target is unreachable', () => {
		expect(reachesThrough(2, 4, (node) => graph.get(node) ?? [])).toBe(false);
	});

	test('terminates on a cycle that does not contain the target', () => {
		expect(reachesThrough(1, 4, (node) => graph.get(node) ?? [])).toBe(false);
	});
});
