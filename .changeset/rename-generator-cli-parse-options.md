---
'@utilize/json-schema': minor
---

Rename the `GeneratorCli.flags` field to `parseOptions`. The field is the `parseArgs` option map, not a feature-flag object, and the old name made the `configObjectHeuristics` detector report the CLI's own option map as a feature flag. `runGeneratorCli` behaves the same; the generator CLIs in `@utilize/zod`, `@utilize/effect` and `@utilize/typescript` pass the same object under the new name.
