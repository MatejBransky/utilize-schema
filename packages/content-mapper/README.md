# @utilize/content-mapper

PoC: import `.jsonschema` files directly and get a generated Zod or Effect Schema module, without a separate codegen step.

```ts
import Person from './person.jsonschema';

const person = Person.parse(input);
```

> Requires TypeScript 7.1 beta and Node 24.

The content mapper plus runtime loader shape is inspired by [Reylo](https://reylo.dev/) and [Motherload](https://motherload.dev/).

## Setup

```jsonc
// tsconfig.json
{
	"contentMappers": [
		{
			"package": "@utilize/content-mapper",
			"extensions": [".jsonschema"],
			"options": { "target": "zod" },
		},
	],
}
```

Run the type check with the external-code flag:

```sh
tsc --noEmit --runExternalCode
```

At runtime, register the Node loader:

```sh
node --import @utilize/content-mapper/register main.mjs
```

`UTILIZE_SCHEMA_TARGET` selects `zod`, `effect` or `typescript` for the loader. Defaults to `zod`.

The loader does not read `tsconfig.json`, so keep this env var in sync with the
mapper `options.target`. Otherwise the editor type-checks the target from
`tsconfig.json` while the runtime imports the module generated for another one
(for example an Effect `Schema` in the editor and a Zod schema at runtime).

For Vite, Rollup or Rolldown:

```ts
import utilizeSchema from '@utilize/content-mapper/vite';

export default {
	plugins: [utilizeSchema({ target: 'zod' })],
};
```

## Options

- `target` — `zod` (default), `effect` or `typescript`.

The virtual module exports the generated declarations. For runtime targets, the root schema is also the default export.

## Status

This is a proof of concept. It uses a dedicated `.jsonschema` suffix so ordinary JSON imports keep their normal TypeScript and Node behavior. Only the Node loader and one Vite plugin are included; other bundlers, editor integration, caching and span-mapped diagnostics are not implemented yet.
