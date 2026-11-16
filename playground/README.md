# Utilize Schema Playground

A browser playground for `@utilize/zod`: edit several JSON Schema files, keep
references between them, and see the generated Zod/TypeScript code next to the
schemas.

## Features

- Multiple schema files in tabs, each with an editable name
- One file is the root; every other file is bundled into its `$defs`
- Relative `$ref`s between files are rewritten to local refs, so cross-file
  references and cycles work in the browser
- Live Zod code generation
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
Pages on every push to `main`.
