# Content mapper demo

```sh
pnpm install
pnpm --filter @utilize/content-mapper-demo check:types
pnpm --filter @utilize/content-mapper-demo start
```

`src/person.jsonschema` is imported directly in `src/main.ts`. The content mapper turns it into a Zod schema and the matching TypeScript type.

`check:types` runs TypeScript 7.1 with `--runExternalCode`. `start` registers the Node loader, so the same import works at runtime.

## Editor

Content mappers are a TypeScript 7.1 language-server feature. Point the editor at the TypeScript in `node_modules/typescript` and allow external code / content mappers.

If the editor's TypeScript client does not support content mappers yet, the two CLI commands above are the supported way to try the PoC. Editor integration and span-mapped diagnostics are not implemented yet.
