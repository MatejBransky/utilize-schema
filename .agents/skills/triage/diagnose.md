# Diagnose

Find the root cause of a reproduced bug. This step only investigates; it does not verify intent and does not fix.

**SCOPE: diagnosis only.** Do not modify source files, tests, or configuration. Do not spawn subagents. Append to `report.md`.

## Prerequisites

Read `triage/gh-<issueNumber>/report.md` from the reproduce step. If it says the bug was skipped or not reproduced, append `DIAGNOSIS SKIPPED: not reproduced` and return `{ confidence: null }`.

## Step 1: Understand the pipeline

Every generator follows the same path:

1. **Resolve and parse** — `packages/json-schema/src/parser.ts`, `linker.ts`, `normalize.ts`, `dialect.ts`, `keywords.ts`, `externalSchemas.ts`. This layer annotates nodes with `Meta` (dialect, path, references).
2. **Generate** — `packages/<pkg>/src/generator.ts` and `generators/*`. This layer maps the parsed tree to target code.
3. **Render and format** — per-generator rendering, then `oxfmt` in tests.
4. **Consume** — Zod runs `safeParse`/`parse`; Effect runs `Schema.decodeUnknownSync`; TypeScript runs `tsc`; the playground runs the same generators in the browser.

Decide which layer the failing test exercises. A bug in `json-schema` usually shows up in more than one target; a bug in a generator is local to that target.

## Step 2: Trace the failing case

- Read the minimal schema and the failing assertion in the test.
- Add temporary `console.log`/`debugger` statements **only** in the temporary triage test or via a scratch script under `triage/`. Do not edit source files just to log.
- Inspect the parsed tree (`parse(...)` output) and compare it with the expected structure. Check `Meta` for the dialect, `path`, and resolved refs.
- For generator bugs, find the branch that handles the keyword (`grep` the keyword in `packages/<pkg>/src`). Check how `allOf`, `oneOf`, `anyOf`, `$ref`, `default`, `additionalProperties`, `patternProperties`, and `format` are handled; those are the usual sources.
- For cross-generator behavior, compare with the Zod generator. Zod is the reference implementation in `packages/effect/test/parity.test.ts`.
- Use `git log -S'<keyword>' -- packages/...` and `git blame` on the relevant lines to see whether the behavior was deliberate. A comment explaining a trade-off is evidence for the verify step.

## Step 3: Check the documented policy

Before calling the behavior accidental, check:

- `docs/dialects.md` — keyword policy, dialect fallback, `$ref` siblings, unsupported keywords.
- `docs/conformance.md` — known conformance gaps and how they are measured.
- `packages/<pkg>/test/suite/knownFailures.ts` and `knownFailureInstances.ts` (Zod/Effect), or `knownGaps.ts` and `baseline.ts` (TypeScript) — cases that are expected to fail today.
- The package README and root README for advertised behavior.

If the case is a documented limitation, record it. The verify step decides whether it is a bug.

## Step 4: Assign confidence

- **high** — you can name the exact file/function and explain why the current code produces the wrong result; the failing test isolates it.
- **medium** — a small set of likely locations, but the exact branch is not proven.
- **low** — no clear cause, or the behavior may be intentional.

Do not inflate confidence. A low-confidence diagnosis with a failing test is useful; a wrong high-confidence diagnosis sends the fix step in the wrong direction.

## Step 5: Append to `report.md`

Add a `## Diagnosis` section with:

- the layer (parser/linker vs generator vs renderer) and the affected files;
- the exact function/branch and why it produces the observed result;
- the parsed-tree or generated-code evidence;
- relevant comments, commits, and docs;
- confidence and what would raise it.

If confidence is low, list the relevant files and lines in `report.md` instead of editing source. The fix step can add a short breadcrumb if it cannot fix, but this step stays read-only.

## Output

Return `{ confidence: 'high' | 'medium' | 'low' | null }`.
