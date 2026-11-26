/**
 * Test cases from the official JSON Schema Test Suite that the Zod generator
 * does not handle yet. Every entry turns its case into an expected failure, so
 * CI stays green while the gap stays visible.
 *
 * The failing instances of every case below are recorded in
 * `knownFailureInstances.ts`. A fix or a regression changes that set, which
 * makes the suite test fail. Re-run `pnpm --filter @utilize/zod
 * update:suite-baseline`, review the diff, and remove entries whose list is
 * empty.
 */

export const knownFailures = {} satisfies Record<string, string>;
