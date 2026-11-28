# Recursive schemas

The generators support self-referencing and mutually recursive schemas, but
they express the recursion differently.

**Zod** emits getters for recursion inside object properties:

```ts
type TreeValue = { name: string; children?: TreeValue[] };
export const Tree: z.ZodType<TreeValue> = z.object({
  name: z.string(),
  get children() {
    return z.array(Tree).optional();
  },
});
export type Tree = z.infer<typeof Tree>;
```

Cycles that cannot be deferred with a getter (array items, tuples, records and
recursive `additionalProperties`) are emitted as `z.lazy()` together with a
generated value type. A cycle that only passes through unions or aliases has no
value type TypeScript can express recursively, so generation fails with
`UnsupportedCyclicReferenceError` instead of emitting code that does not
type-check.

**Effect Schema** always emits references as lazy schemas, so no dependency
ordering is needed. Schemas that take part in a cycle get a value type and an
explicit annotation, because an inferred `typeof X.Type` would reference itself
and collapse to `any`:

```ts
type TreeValue = { name: string; children?: ReadonlyArray<TreeValue> };

export const Tree: Schema.Codec<TreeValue> = Schema.StructWithRest(
  Schema.Struct({
    name: Schema.String,
    children: Schema.optionalKey(Schema.Array(Schema.suspend(() => Tree))),
  }),
  [Schema.Record(Schema.String, Schema.Json)]
);

export type Tree = typeof Tree.Type;
```

**TypeScript** emits the recursive type directly, because interfaces and
deferred aliases can refer to themselves:

```ts
export interface Tree {
  name: string;
  children?: Array<Tree>;
  [key: string]: unknown;
}
```

A cycle that only passes through aliases, unions or intersections (for example
`type A = A | string`) has no type TypeScript can express, so generation fails
with `UnsupportedCircularTypeError` instead of emitting code that does not
compile.
