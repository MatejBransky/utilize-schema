# @utilize/json-schema

## 0.2.0

### Minor Changes

- a25f59a: Detect the JSON Schema draft from `$schema` and normalize 2019-09 and 2020-12 keywords to the draft-07 model.

### Patch Changes

- a7d3cf0: Ignore non-string `$ref` values when linking, so schemas with a property named `$ref`, such as the draft-07 meta-schema, can be parsed.
- dbefc30: Update the build toolchain and runtime dependencies, and publish ESM builds
  with tsdown.

## 0.1.0

### Minor Changes

- d56dd72: updated external deps

## 0.0.4

### Patch Changes

- 28889b5: added default value for schema parent

## 0.0.3

### Patch Changes

- 8bc03cb: added README

## 0.0.2

### Patch Changes

- 9bf2159: fixed sorting
