---
'@utilize/zod': patch
'@utilize/json-schema': patch
---

List the built entry files by name in the `exports` map instead of a `./dist/*` wildcard. `@utilize/zod/dist/index.mjs`, `dist/runtime.mjs`, `dist/cli.mjs` (and `@utilize/json-schema/dist/index.mjs`, `dist/node.mjs`), with their `.d.ts` files, still resolve. Only the bundler's hashed chunk files, whose names change on every build, are no longer importable directly.
