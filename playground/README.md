# Utilize Schema Playground

A browser playground for the generators in this monorepo: edit several JSON
Schema files, keep references between them, and see the generated Zod, Effect
Schema or TypeScript code next to the schemas.

## Features

- Multiple schema files in tabs, each with an editable name
- Drop JSON Schema files or folders onto the editor to open them as tabs, adding
  to the current files or starting from the dropped ones
- One file is the root; every other file is bundled into its `$defs`
- Relative `$ref`s between files are rewritten to local refs, so cross-file
  references and cycles work in the browser
- Live code generation for every available generator (Zod, Effect Schema and
  TypeScript), selectable from the header and kept in the URL
  (`?generator=effect`)
- A `Format` switch for the runtime generators: `assert` (the default) turns
  `format` into validation, `annotate` keeps it as metadata
  (`?format-mode=annotate`). It is disabled for the TypeScript target, which
  cannot check a format.
- A `Pragmatic inference` switch for the TypeScript target: it reads an untyped
  schema's keyword family as the intended type (`format` → `string`, `minimum` →
  `number`, `contains` → `array`; `?inference=pragmatic`). It is hidden for the
  runtime generators.
- Generated code is formatted with Prettier at 80 columns; the editor's
  TypeScript worker gets the real Zod and Effect declarations plus
  `@utilize/json-schema/formats`, so generated field types stay concrete
- Live JSON and JSON Schema validation with AJV (draft-07, 2019-09 and
  2020-12 meta-schemas)
- Unresolved `$ref`s and remote refs are reported
- A test-data editor below the schemas, resized with the divider above it or
  collapsed to its header; dropping a JSON document on it replaces the data
- The pane beside the test data runs the selected generator's validator on that
  document in a Web Worker and shows the decoded value, defaults included, or
  every issue with its JSON path. Only Zod and Effect Schema have a runtime
  validator; the TypeScript target emits types only and says so instead.
- Every example carries valid and invalid documents: click a label to load one
  into the editor. `src/examples.test.ts` asserts that the generated validators
  accept and reject those documents as declared.
- The Validation panel collapses separately from the test data
- The whole workspace, including the test data, is saved to `localStorage` and
  can be shared through a URL hash

## Development

```sh
pnpm install
pnpm --filter playground dev
```

The app imports the library source directly, so no package build is needed.

## Build

```sh
pnpm --filter playground build
```

The output in `playground/dist` uses relative asset paths, so it works on
GitHub Pages under `/utilize-schema/`.

## Deployment

`.github/workflows/pages.yml` builds and deploys the playground to GitHub
Pages on every push to `main`. Only same-repository pull requests with the
`Preview` label get a Vercel preview deployment; see
[CONTRIBUTING.md](../CONTRIBUTING.md#playground-previews).

## Adding a generator

1. Implement the generator package (see `packages/effect` as the reference for a
   second target).
2. Add an alias for it in `vite.config.ts` and `tsconfig.json` so the browser
   imports its source instead of `dist`.
3. Add the target to `src/targets.ts`, a case to `generateCodeFor` in
   `src/generateCode.ts`, and — if the generator has a runtime validator — add
   it to `runtimeTargetIds` in `src/targets.ts` and to the `validators` map in
   `src/runtime.ts`, so the results pane can run it.
4. Add it to the generators list in `src/examples.test.ts`; the whole example
   suite then has to produce code for the new target.
