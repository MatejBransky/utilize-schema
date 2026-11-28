# Verify

Decide whether the reproduced behavior is a bug, an intended limitation, or unclear. This step is deliberately adversarial: do not assume the reporter is right.

**SCOPE: verification only.** Do not fix. Do not spawn subagents. Append to `report.md`.

## Prerequisites

Read `triage/gh-<issueNumber>/report.md`. If the bug was not reproduced, append `VERIFICATION SKIPPED: not reproduced` and return `{ verdict: 'unclear', confidence: 'low' }`.

## Step 1: State the claim

Write down two things:

- **Current behavior** — what the generated code or runtime actually does.
- **Expected behavior** — what the reporter says should happen.

The expected behavior is the claim under test. It may be wrong.

## Step 2: Research intent, in this order

1. **Known failures.** Check the expected-failure baseline for the package: `test/suite/knownFailures.ts` and `knownFailureInstances.ts` for Zod and Effect, or `test/suite/knownGaps.ts` and `baseline.ts` for TypeScript. If the exact case is listed, the current behavior is a known, tracked limitation. That is **not** a bug for this pipeline; a maintainer decides when to close the gap.
2. **Dialect policy.** Read `docs/dialects.md` and check `packages/json-schema/src/dialect.ts` (`isKeywordApplicable`, `keywordPolicy`). Keywords outside the selected dialect are reported as warnings and not applied. Common false positives:
   - no `$schema` → fallback is draft-07, not 2020-12;
   - `$ref` siblings are ignored in draft-07 and applied in 2019-09+;
   - `prefixItems`, `unevaluated*`, `dependent*`, `minContains` do not exist in draft-07.
3. **Documented behavior.** Root README, package READMEs, `docs/conformance.md`. If the docs promise the behavior, the bug is more likely real. If they describe the current behavior, it is intended.
4. **Code comments and history.** A comment explaining why a branch exists is strong evidence of intent. Use `git blame` and `git log -S` on the relevant lines, then read the commit message and PR.
5. **Spec semantics.** The generated schema must match the JSON Schema spec for the selected dialect, not the reporter's preference. For a runtime/type bug, compare with the Zod reference implementation and the official test suite semantics.
6. **Prior issues.** Search for the same behavior with `gh search issues` / `gh search prs`. A maintainer explanation in a closed issue is strong evidence.

## Step 3: Classify

- **`bug`** — the code contradicts the spec or the docs, the behavior is a regression, or the code has no intentional handling for the case. The developer did not know about or choose it.
- **`intended-behavior`** — a comment, docs, a known-failure entry, an explicit conditional, or a commit explains the behavior. It may still be worth improving, but it is an enhancement or a known limitation, not a bug fix. **Do not fix it.**
- **`unclear`** — the evidence is ambiguous. Prefer `unclear` over guessing.

Do not classify as a bug just because the reporter frames it as one. Do not classify a documented trade-off as a bug because it is imperfect. Do not classify a formatting preference as a bug unless the output is invalid.

## Step 4: Assign confidence

- **high** — explicit docs/comment/commit/known-failure entry, or a clear spec contradiction.
- **medium** — reasonable evidence with some ambiguity.
- **low** — inference only.

## Step 5: Append to `report.md`

Add a `## Verification` section with:

- the claim (current vs expected);
- the verdict and confidence;
- the evidence, with file paths, line numbers, docs sections, and commit/issue references;
- for `intended-behavior`, the rationale and whether the reporter's request is better framed as an enhancement;
- for `unclear`, what evidence is missing.

## Output

Return `{ verdict: 'bug' | 'intended-behavior' | 'unclear', confidence: 'high' | 'medium' | 'low' }`.
