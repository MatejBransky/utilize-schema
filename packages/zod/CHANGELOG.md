# @utilize/zod

## 0.6.0

### Minor Changes

- f7fd83b: Enforce the `uniqueItems`, `minProperties` and `maxProperties` keywords instead of silently dropping them. These constraints now reject data that the previous output accepted, so the bump is minor rather than a patch.

## 0.5.0

### Minor Changes

- a25f59a: Generate `allOf` with any number of subschemas using nested `z.intersection()` calls.
- a25f59a: Detect the JSON Schema draft from `$schema` and normalize 2019-09 and 2020-12 keywords to the draft-07 model.
- a25f59a: Emit typed `z.lazy()` schemas and generated value types for recursive `$ref`s that cannot be deferred with a getter, so recursive output type-checks.
- a25f59a: Support `not`, `if`/`then`/`else`, `contains`, `propertyNames` and `dependencies` with refinements.

### Patch Changes

- dbfa88e: break cyclic $refs at object properties; cycles that cannot be deferred with a getter now fail at generation instead of producing code that throws at import
- a25f59a: Enforce required object keys that are not declared in `properties`.
- dbefc30: Update the build toolchain and runtime dependencies, and publish ESM builds
  with tsdown.
- a25f59a: Annotate recursive schemas with `z.ZodType` instead of an inline import type.
- Updated dependencies [a7d3cf0]
- Updated dependencies [a25f59a]
- Updated dependencies [dbefc30]
  - @utilize/json-schema@0.2.0

## 0.4.1

### Patch Changes

- 8c0c238: fix boolean default values conversion from string ones to boolean ones

## 0.4.0

### Minor Changes

- d56dd72: updated external deps

### Patch Changes

- Updated dependencies [d56dd72]
  - @utilize/json-schema@0.1.0

## 0.3.2

### Patch Changes

- Updated dependencies [28889b5]
  - @utilize/json-schema@0.0.4

## 0.3.1

### Patch Changes

- 9d91589: fixed compile options

## 0.3.0

### Minor Changes

- 4e9a14e: added custom schema name resolver

## 0.2.3

### Patch Changes

- 8bc03cb: added README
- Updated dependencies [8bc03cb]
  - @utilize/json-schema@0.0.3

## 0.2.2

### Patch Changes

- c31ca83: handled missing schema.properties in objectGenerator

## 0.2.1

### Patch Changes

- removed

## 0.2.0

### Minor Changes

- af4352b: fixed object predicate

## 0.1.1

### Patch Changes

- 9bf2159: fixed sorting
- Updated dependencies [9bf2159]
  - @utilize/json-schema@0.0.2

## 0.1.0

### Minor Changes

- 61ce5c4: added missing generator export
