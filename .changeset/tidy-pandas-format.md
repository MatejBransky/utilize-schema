---
'@utilize/effect': minor
'@utilize/zod': minor
---

`format` is now switchable in both runtime generators and asserted by default,
so `@utilize/zod` and `@utilize/effect` agree on what a known format does.

Both generators turn known formats into validation (`format: "email"` becomes
`z.email()` or a `Schema.String.check(formatEmail)`), and keep unknown formats
as annotations. Pass `formatMode: 'annotate'` to keep `format` as metadata
(`.meta({ format })` / `.annotate({ format })`); both CLIs take
`--format-mode annotate|assert`. `formatMap` entries apply in both modes.

The Effect generator gains the format checks in this release, so schemas with a
known `format` now reject invalid values by default.
