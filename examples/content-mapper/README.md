# Content mapper demo

```sh
pnpm install
pnpm build:dev
pnpm --filter @utilize/content-mapper-demo check:types
pnpm --filter @utilize/content-mapper-demo start
```

`check:types` should finish with exit code 0. `start` should print:

```text
Ada { name: 'Ada', age: 36 }
```

## Verify the type is generated

Change `name` in `src/person.jsonschema` to `{ "type": "number" }` and run `check:types`. The assignment `const name: string = person.name` must fail.

## Verify runtime validation

Change the input in `src/main.ts` to `{ name: 1 }` and run `start`. The generated Zod schema rejects it.

## Editor

Content mappers are a TypeScript 7.1 language-server feature. Point the editor at the TypeScript in `node_modules/typescript` and allow external code / content mappers.

If the editor's TypeScript client does not support content mappers yet, the CLI commands above are the supported way to try the PoC. Editor integration and span-mapped diagnostics are not implemented yet.
