# Content mapper demo

```sh
pnpm install
pnpm build:dev
pnpm --filter @utilize/content-mapper-demo check:types
pnpm --filter @utilize/content-mapper-demo start
```

`check:types` should finish with exit code 0. `start` should print:

```text
Ada { name: 'Ada', age: 36 } true
```

## Verify the type is generated

Change `name` in `src/person.jsonschema` to `{ "type": "number" }` and run `check:types`. The assignment `const name: string = person.name` must fail.

## Verify runtime validation

Change the input in `src/main.ts` to `{ name: 1 }` and run `start`. The generated Zod schema rejects it.

## Editor

Content mappers are a TypeScript 7.1 language-server feature. The editor must run TypeScript 7.1 and allow content mappers / external code.

The extension cannot be `.json` or `*.json`: TypeScript rejects every built-in JSON extension. Map `.jsonschema` to JSON in the editor to keep JSON syntax, jsonls and schema suggestions.

Neovim:

```lua
vim.filetype.add({ extension = { jsonschema = "json" } })
```

VS Code:

```jsonc
{
	"files.associations": { "*.jsonschema": "json" },
}
```

### Neovim

Use the native TypeScript server, not `ts_ls` or `vtsls`:

```lua
local root = vim.fs.root(0, { 'tsconfig.json' })

if root and root:match('content%-mapper') then
  vim.lsp.start({
    name = 'tsc-content-mapper',
    cmd = { root .. '/node_modules/.bin/tsc', '--lsp', '--stdio' },
    root_dir = root,
    init_options = { runExternalCode = true },
  })
end
```

The ready-to-copy version is in `nvim.lua`. The important parts are:

- `cmd` points at this demo's `node_modules/.bin/tsc`, which is `7.1.0-beta`
- `root_dir` is this demo, so its `tsconfig.json` is used
- `init_options.runExternalCode = true`; `--runExternalCode` is not an LSP flag in the beta

Disable any other TypeScript language server for this project, otherwise it keeps reporting `Cannot find module './person.jsonschema'`.

### VS Code

Select the TypeScript version from `examples/content-mapper/node_modules/typescript/lib` and enable content mappers in settings:

```jsonc
{
	"typescript.tsdk": "examples/content-mapper/node_modules/typescript/lib",
	"js/ts.contentMappers.enabled": true,
}
```

Then restart the TS server. Without that, VS Code uses the repo's TypeScript 7.0.2 and reports the same missing-module error.

If the editor's TypeScript client does not support content mappers yet, the CLI commands above are the supported way to try the PoC. Editor integration and span-mapped diagnostics are not implemented yet.
