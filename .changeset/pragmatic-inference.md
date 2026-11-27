---
'@utilize/typescript': minor
---

Add opt-in `inference: 'pragmatic'` (and `--inference pragmatic`) to read an
untyped schema's keyword family as the intended type: `format` becomes `string`,
`minimum` becomes `number`, `contains` becomes `array`, and so on. The default
stays `spec`, which keeps those schemas `unknown` because the keywords only
constrain one instance type.
