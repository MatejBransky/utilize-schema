/**
 * The recorded conformance baseline for the official JSON Schema Test Suite,
 * per dialect, for the Zod generator.
 *
 * `cases` counts the cases this target runs for that dialect, `passing` the
 * cases where every valid instance is accepted and every invalid one rejected.
 * `instances` and `passingInstances` are the same numbers one level down. Known
 * gaps stay in the denominator: a badge must not hide them.
 *
 * Every dialect is pinned case by case in `knownFailuresByDialect.ts`;
 * `draft-07` also has a curated reason per case in `knownFailures.ts`. When
 * conformance changes, update the number on purpose in the same pull request. The suite test fails
 * on any change, and `pnpm badge:suite` reads this object to render
 * `.github/badges/suite-zod-<dialect>.svg`.
 */
import { runtimeBaseline } from '@utilize/test-utils/suite/runtimeBaseline';

export const baseline = runtimeBaseline;
