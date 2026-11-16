---
'@utilize/json-schema': patch
'@utilize/zod': minor
---

Add a `utilize-zod` CLI that compiles a JSON or YAML schema from a file, directory, glob or stdin to a file, a directory or stdout. Generated files now start with a "do not edit" banner by default (`bannerComment: false` to omit it). The parser and `compile()` no longer log progress to stdout.
