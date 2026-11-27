---
'@utilize/json-schema': minor
'@utilize/zod': minor
'@utilize/effect': minor
---

Import structural format validators at runtime instead of inlining them.

Generated Zod and Effect schemas now import the validators for formats such as
`email`, `hostname`, `uri` and `date-time` from `@utilize/json-schema/formats`
(for example `formatEmail` and `formatUri`) instead of emitting a copy of each
body in every generated file. Apps that run generated schemas must keep
`@utilize/json-schema` as a runtime dependency; only the validators a file uses
survive bundling.

`@utilize/json-schema` exports the new `./formats` entry. `formatBody` is
removed; import the matching validator from that entry instead.
