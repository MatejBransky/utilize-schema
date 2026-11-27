## What

<!-- One or two lines: what changed and why. -->

## Playground

Required when the change is visible in the playground. Add the `Preview` label;
the bot posts the preview URL.

|                 | Link |
| --------------- | ---- |
| main (wrong)    |      |
| preview (right) |      |

Build both links with **Share** so the URL carries the workspace.

## Fallow

`pnpm fallow:audit:ci` passes and the score does not drop.

|      | Score |
| ---- | ----- |
| main |       |
| PR   |       |

If the score dropped, name the rule and the file that caused it.

## Size

`pnpm build && du -sh packages/*/dist` on both refs.

| Package | main | PR  | Δ   |
| ------- | ---- | --- | --- |
|         |      |     |     |

If the bundle grew, say where (package, module, symbol) and why it is worth it.

## Speed

Refactors in `packages/json-schema` need three `bench:compare` runs (see
CONTRIBUTING). No mean or median regression above 5%; state the speedup when
there is one. Delete the section when the change cannot affect performance.

```text
run 1:
run 2:
run 3:
```

## Verification

- [ ] `pnpm verify`
