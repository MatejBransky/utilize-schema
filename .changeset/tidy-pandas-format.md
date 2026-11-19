---
'@utilize/effect': minor
'@utilize/zod': minor
---

`format` is now an annotation by default in both runtime generators, which
matches JSON Schema and makes `@utilize/zod` agree with `@utilize/effect`.

The Zod generator used to turn known formats into validation
(`format: "email"` became `z.email()`). It now emits `z.string().meta({ format:
"email" })` unless you pass `formatMode: 'assert'`. The option exists on both
generators and on both CLIs (`--format-mode assert`); the Effect generator adds
checks for known formats in assert mode instead of only annotating them.

Set `formatMode: 'assert'` to keep the previous Zod output. `formatMap` entries
still apply in both modes, so an explicit expression per format keeps working.
