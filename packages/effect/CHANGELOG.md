# @utilize/effect

## 0.1.0

### Minor Changes

- 54689a4: Add `@utilize/effect`, a JSON Schema to Effect Schema (v4) generator. It emits one exported const and one `typeof X.Type` per standalone schema, resolves every `$ref` through `Schema.suspend`, supports objects, arrays, tuples, unions, `allOf` object merging and scalar checks, and rejects JSON Schema features that have no Effect Schema equivalent.
