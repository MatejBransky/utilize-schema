---
'@utilize/effect': patch
---

Schema dependencies now compile to their object branch instead of a union over
every JSON value. A `dependencies` subschema without a `type` accepts every
value, but it is evaluated against an object, so the alternatives for other
types could never match.

Both runtime generators now narrow through the same `narrowUntypedSchema`
helper, so the exclusion list cannot drift between them. As in Zod, a
dependency narrows only when it declares a type-specific keyword; one that only
carries annotations stays untyped, which validates the same values.

Because the subschema is generated as an object, a dependency that only declares
another dependency, such as `{ "dependencies": { "b": ["c"] } }`, is now checked
instead of being reduced to `Schema.Json` and ignored, and a dependency that
only constrains another type no longer emits the union.

A dependency on a single key is emitted as `Object.hasOwn(value, 'key')`
instead of an `every()` over a one-element array.
