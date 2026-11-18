---
'@utilize/zod': minor
---

Generate less redundant code. A `const` or `enum` next to a `type` it already satisfies (e.g. `{ "type": "string", "const": "a" }`) is only a literal, a `type` list puts its `description` and other annotations on the union once, and an `anyOf` with a branch that accepts every value (e.g. `[X, {}]`) is left out. A `oneOf` whose branches cannot match the same value (different `const`/`enum` values, different types, or tagged objects) becomes a plain `z.union()`, which `z.toJSONSchema()` can convert. An inline subschema identical to a named schema is generated as a reference to it. The new `runtimeImport` option (CLI: `--runtime-import`) imports the `oneOfSchema` helper from `@utilize/zod/runtime`, which the package now exports, instead of declaring it in every file.
