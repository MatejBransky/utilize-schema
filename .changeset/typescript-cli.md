---
'@utilize/typescript': minor
---

Add a `utilize-typescript` CLI. It accepts a schema file, directory or glob, reads JSON and YAML, and writes the generated types to a file, a directory or stdout, with `--cwd` and `--no-banner` flags.

`compile()` now also reads YAML and prepends the standard "do not edit" banner, and the new `compileFile`, `compileSchema`, `readSchema` and `withBanner` helpers match the other generators.
