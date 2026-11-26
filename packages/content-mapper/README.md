# @utilize/content-mapper

[![npm version](https://img.shields.io/npm/v/@utilize/content-mapper)](https://www.npmjs.com/package/@utilize/content-mapper)
[![npm weekly downloads](https://img.shields.io/npm/dw/@utilize/content-mapper)](https://www.npmjs.com/package/@utilize/content-mapper)
[![Unit test coverage](https://raw.githubusercontent.com/MatejBransky/utilize-schema/main/.github/badges/coverage-content-mapper.svg)](https://github.com/MatejBransky/utilize-schema/blob/main/CONTRIBUTING.md#coverage-badge)

Import `.jsonschema` files directly and get a generated Zod or Effect Schema
module, without a separate codegen step.

```ts
import Person from './person.jsonschema';

const person = Person.parse(input);
```

The content mapper plus runtime loader shape is inspired by
[Reylo](https://reylo.dev/) and [Motherload](https://motherload.dev/).

> The content mapper needs **TypeScript 7.1 beta** for `tsc` and the editor. The
> Node loader and the Vite plugin need **Node 24**.

## Install

```sh
pnpm add -D @utilize/content-mapper
# The generated module imports the target runtime from your project:
pnpm add zod        # or: pnpm add effect
```

`@utilize/content-mapper` is a build and editor tool. Keep it available when
`node --import @utilize/content-mapper/register` runs the app, or install it as
a dependency if your deployment prunes dev dependencies.

## Setup

```jsonc
// tsconfig.json
{
	"contentMappers": [
		{
			"package": "@utilize/content-mapper",
			"extensions": [".jsonschema"],
			"options": { "target": "zod" }
		}
	]
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

`UTILIZE_SCHEMA_TARGET` selects `zod` (default) or `effect` for the loader.
`typescript` is types-only and has no runtime module, so the loader rejects it.

### Target consistency

The loader does not read `tsconfig.json`, so keep this env var in sync with the
mapper `options.target`. Otherwise the editor type-checks the target from
`tsconfig.json` while the runtime imports the module generated for another one
(for example an Effect `Schema` in the editor and a Zod schema at runtime).

### Vite, Rollup and Rolldown

```ts
import utilizeSchema from '@utilize/content-mapper/vite';

export default {
	plugins: [utilizeSchema({ target: 'zod' })],
};
```

The plugin resolves the same virtual module as the content mapper and lets the
bundler watch every file pulled in through `$ref`. It accepts `zod` and
`effect`; the types-only `typescript` target is rejected because it has no
runtime output.

## Options

- `target` — `zod` (default), `effect` or `typescript`.
  `zod` and `effect` produce a runtime module and a default export.
  `typescript` produces declarations only; it has no default export.

## Editor setup

Content mappers are a TypeScript 7.1 language-server feature. The editor must
run TypeScript 7.1 and allow content mappers / external code. Map
`.jsonschema` to JSON so the editor keeps JSON syntax, jsonls and schema
suggestions.

Neovim:

```lua
vim.filetype.add({ extension = { jsonschema = "json" } })
```

Use the native `tsc --lsp` server, not `ts_ls` or `vtsls`:

```lua
local root = vim.fs.root(0, { 'tsconfig.json' })

if root then
  vim.lsp.start({
    name = 'tsc-content-mapper',
    cmd = { root .. '/node_modules/.bin/tsc', '--lsp', '--stdio' },
    root_dir = root,
    init_options = { runExternalCode = true },
  })
end
```

VS Code:

```jsonc
{
	"files.associations": { "*.jsonschema": "json" },
	"js/ts.contentMappers.enabled": true
}
```

Select the TypeScript 7.1 SDK with `typescript.tsdk`, then restart the TS
server. Disable any other TypeScript server for the project; otherwise it keeps
reporting `Cannot find module './person.jsonschema'`.

## Limitations

- The parser and generators run on every transform; there is no cache or
  incremental transform yet.
- Diagnostics report JSON and generation errors at the start of the file;
  span-mapped diagnostics are not implemented.
- Only the Node loader and one Vite/Rollup/Rolldown plugin are included. Other
  bundlers and test runners are not integrated. The plugin relies on Node 24's
  experimental `stripTypeScriptTypes`, which prints one `ExperimentalWarning`
  per process.
- The content mapper does not infer project options; `tsconfig.json` and
  `UTILIZE_SCHEMA_TARGET` must agree.
- The transform returns `$ref` files in `watchedFiles` and the Vite plugin
  watches them. TypeScript 7.1 beta's own watch/editor refresh for those files
  is still limited; touching the importing `.jsonschema` is the reliable
  refresh.
- The coverage badge measures the in-process API (`module.ts`, `vite.ts`). The
  loader, mapper server and JSON-RPC server run in the child process TypeScript
  or Node spawns and are covered by the integration tests instead.
