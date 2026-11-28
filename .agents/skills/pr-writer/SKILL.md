---
name: pr-writer
description: Write a pull request title and body for a fix in utilize-schema, following the repository's conventional commit and changeset conventions.
---

# PR writer

Generate the title and body for a pull request opened by the triage bot. Do not create the PR, commit, or push.

## Input

You receive the issue details, the issue number, the branch, and a context note describing whether a reporter confirmed the fix. Use the actual changed files (`git diff --stat main`) and the changeset file to write the body. Do not invent tests or files that are not in the diff.

## Title

Use the repository's conventional commit style:

- `fix(<scope>): <summary>` for bug fixes;
- `test(<scope>): <summary>` when the branch only adds a failing test or investigation;
- `docs(<scope>): <summary>` for documentation-only changes.

`<scope>` is the affected package: `zod`, `effect`, `typescript`, `json-schema`, or `playground`. For a change that spans packages, list them comma-separated: `fix(zod, effect): ...`.

Keep the summary short, imperative, and specific. Do not start it with `fix:` inside the scope, and do not use marketing language.

## Body

```md
## Summary

One or two sentences describing the user-visible fix.

## Root cause

What the parser, generator, or runtime did instead, and why.

## Changes

- `packages/<pkg>/src/...` — what changed
- `packages/<pkg>/test/...` — regression test
- `.changeset/...` — `@utilize/<pkg>` patch

## Verification

- `pnpm --filter @utilize/<pkg> ci:test`
- `pnpm check:types`
- `pnpm check:format`
- `pnpm check:lint`
- `pnpm --filter @utilize/<pkg> test:suite` (only if the suite is relevant)

## Notes

Anything a reviewer should check, remaining risks, or a known-failure baseline change that needs approval.

Closes #<issueNumber>
```

Rules:

- Always include `Closes #<issueNumber>`.
- Mention the changeset file and the affected packages. A fix that touches `packages/*` without a changeset is not ready.
- If the context says the reporter confirmed the fix, add one sentence: "The reporter confirmed the fix in the issue thread."
- End with: `_This PR was opened by the triage bot and needs human review._`
- Do not add a "Generated with" footer or a tool signature.

## Output

Return `{ title: string, body: string }`.
