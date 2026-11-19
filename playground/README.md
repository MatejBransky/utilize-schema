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
- A `Format` switch for the runtime generators: `annotate` keeps `format` as
  metadata, `assert` turns it into validation (`?format-mode=assert`). It is
  disabled for the TypeScript target, which cannot check a format.
- Generated code is formatted with Prettier at 80 columns, and the Effect target
  adds the real `effect` type declarations to the editor's TypeScript worker
- Live JSON and JSON Schema validation with AJV (draft-07, 2019-09 and
  2020-12 meta-schemas)
- Unresolved `$ref`s and remote refs are reported
- The whole workspace is saved to `localStorage` and can be shared through a
  URL hash

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
Pages on every push to `main`. Every pull request also gets a Vercel preview
deployment; see [CONTRIBUTING.md](../CONTRIBUTING.md#playground-previews).

## Adding a generator

1. Implement the generator package (see `packages/effect` as the reference for a
   second target).
2. Add an alias for it in `vite.config.ts` and `tsconfig.json` so the browser
   imports its source instead of `dist`.
3. Add the target to `src/targets.ts` and a case to `generateCodeFor` in
   `src/App.tsx`.
4. Add it to the generators list in `src/examples.test.ts`; the whole example
   suite then has to produce code for the new target.
