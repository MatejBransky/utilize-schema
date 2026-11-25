---
'@utilize/json-schema': minor
---

Export `SCHEMA_MAP_KEYWORDS`, `SINGLE_SCHEMA_KEYWORDS` and `SCHEMA_ARRAY_KEYWORDS`: the keywords whose value is an object of subschemas, one subschema, or an array of subschemas. The normalizer, the identifier index and the playground's bundler each had their own copy of these lists; they now share one.
