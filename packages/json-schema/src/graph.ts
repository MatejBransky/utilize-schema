import { expectDefined } from './utils';

/**
 * Walks a directed graph from `start` and reports whether it reaches `target`.
 * `childrenOf` defines the edges and is called lazily, so a caller can keep its
 * own notion of a transparent edge.
 */
export function reachesThrough<Schema>(
	start: Schema,
	target: Schema,
	childrenOf: (schema: Schema) => Iterable<Schema>
): boolean {
	const seen = new Set<Schema>();
	const stack = [...childrenOf(start)];

	while (stack.length > 0) {
		const node = expectDefined(stack.pop());

		if (node === target) {
			return true;
		}
		if (seen.has(node)) {
			continue;
		}

		seen.add(node);
		stack.push(...childrenOf(node));
	}

	return false;
}
