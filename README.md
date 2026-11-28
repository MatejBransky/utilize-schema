# Utilize Schema

**Convert JSON Schema to Zod, Effect Schema, or plain TypeScript.** One parser
resolves local, external and cyclic `$ref` links into standalone schemas and
types for every dialect from draft-04 to 2020-12.

[![Check](https://img.shields.io/github/actions/workflow/status/MatejBransky/utilize-schema/check.yml?branch=main&label=check)](https://github.com/MatejBransky/utilize-schema/actions/workflows/check.yml)
[![Codebase health](.github/badges/fallow-health.svg)](CONTRIBUTING.md#what-fallow-enforces-here)
[![npm version](https://img.shields.io/npm/v/@utilize/zod)](https://www.npmjs.com/package/@utilize/zod)
[![License](https://img.shields.io/github/license/MatejBransky/utilize-schema)](./LICENSE)

<details>
<summary>Table of contents</summary>

- [Features](#features)
- [Quick start](#quick-start)
- [Packages](#packages)
- [Usage](#usage)
- [Playground](#playground)
- [Supported features](#supported-features)
- [Learn more](#learn-more)
- [Contributing](#contributing)
- [License](#license)

</details>

<a id="features"></a>

## ✨ Features

- **Three targets, one pipeline.** `@utilize/zod`, `@utilize/effect` and
  `@utilize/typescript` share the same parser, linker and naming rules, so they
  agree on what a schema means.
- **`$ref` links resolve.** Local, external and cyclic, including `$id` and
  `$anchor`. External documents come from disk, HTTP, or memory with
  `externalSchemas`.
- **Every definition is standalone.** `$defs` and `definitions` each get their
  own schema or type. Zod also orders them by dependency.
- **Dialect-aware.** Draft-04/06/07 are read natively, 2019-09 and 2020-12 are
  normalized. `$schema` is resolved per schema resource and `$ref` siblings are
  applied only where the dialect defines them. The per-dialect rules are in
  [docs/dialects.md](./docs/dialects.md).
- **Proven on the official suite.** Draft-07 scores 304/304 cases for Zod,
  304/304 for Effect Schema and 192/285 for TypeScript; five dialects are
  measured. See [supported features](#supported-features).
- **Types without runtime.** `@utilize/typescript` emits interfaces and aliases
  only; the output imports nothing.

---

<a id="quick-start"></a>

## ⚡ Quick start

```sh
pnpm add zod @utilize/json-schema
pnpm add -D @utilize/zod
utilize-zod user.json user.zod.ts
```

Generated schemas import structural format validators from
`@utilize/json-schema/formats`, so `@utilize/json-schema` is a runtime
dependency of the app, not only a generator dependency.

`user.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "format": "date"
    }
  },
  "required": ["id"],
  "additionalProperties": false
}
```

`user.zod.ts` (banner omitted):

```ts
import { z } from 'zod';

export const User = z.strictObject({
  id: z.iso.date().meta({ format: 'date' }),
});
export type User = z.infer<typeof User>;
```

The date format keeps this example short. Formats that need structural
validation, such as `email`, `hostname` and `uri`, are imported from
`@utilize/json-schema/formats` as one validator per format, shared by every
schema that uses it.

The same three steps work for the other targets: `@utilize/effect` with
`utilize-effect`, and `@utilize/typescript` with `utilize-typescript` (no runtime
dependency). See [Usage](#usage) for the API and CLI; each package README
lists the options.

---

<a id="packages"></a>

## 📦 Packages

- **[@utilize/json-schema](./packages/json-schema)** — Resolves `$ref`, links nodes with metadata, provides the CLI runner and compile helpers the three generators share, exports the runtime format validators generated schemas import, and the optional Ajv adapter at `./validate/ajv`.

  [![npm version](https://img.shields.io/npm/v/@utilize/json-schema)](https://www.npmjs.com/package/@utilize/json-schema)
  [![weekly downloads](https://img.shields.io/npm/dw/@utilize/json-schema)](https://www.npmjs.com/package/@utilize/json-schema)
  [![coverage](.github/badges/coverage-json-schema.svg)](CONTRIBUTING.md#coverage-badge)

- **[@utilize/zod](./packages/zod)** — Emits Zod schemas and `z.infer` types.

  [![npm version](https://img.shields.io/npm/v/@utilize/zod)](https://www.npmjs.com/package/@utilize/zod)
  [![weekly downloads](https://img.shields.io/npm/dw/@utilize/zod)](https://www.npmjs.com/package/@utilize/zod)
  [![coverage](.github/badges/coverage-zod.svg)](CONTRIBUTING.md#coverage-badge)

- **[@utilize/effect](./packages/effect)** — Emits Effect Schema codecs and types, with every `$ref` going through `Schema.suspend`.

  [![npm version](https://img.shields.io/npm/v/@utilize/effect)](https://www.npmjs.com/package/@utilize/effect)
  [![weekly downloads](https://img.shields.io/npm/dw/@utilize/effect)](https://www.npmjs.com/package/@utilize/effect)
  [![coverage](.github/badges/coverage-effect.svg)](CONTRIBUTING.md#coverage-badge)

- **[@utilize/typescript](./packages/typescript)** — Emits interfaces and type aliases. No runtime dependency.

  [![npm version](https://img.shields.io/npm/v/@utilize/typescript)](https://www.npmjs.com/package/@utilize/typescript)
  [![weekly downloads](https://img.shields.io/npm/dw/@utilize/typescript)](https://www.npmjs.com/package/@utilize/typescript)
  [![coverage](.github/badges/coverage-typescript.svg)](CONTRIBUTING.md#coverage-badge)

The badges are committed to `.github/badges/` and checked in CI. Coverage is the
line coverage of each package's `src`, including the JSON Schema Test Suite and
the CLI entry points ([coverage badges](./CONTRIBUTING.md#coverage-badge)).
Conformance is the share of compatible JSON Schema Test Suite cases where every
expected result matches, with known gaps left in the denominator
([conformance badges](./CONTRIBUTING.md#conformance-badges)). The
`json-schema-to-typescript` row measures the pinned competitor through the same
type-level runner, for a like-for-like comparison ([methodology](./docs/conformance.md)).
Regenerate both with `pnpm badge:coverage` and `pnpm badge:suite`.

<details>
<summary>Conformance badges for all five dialects</summary>

| Project                                                                             | draft-04                                                                                                                            | draft-06                                                                                                                            | draft-07                                                                                                                            | 2019-09                                                                                                                           | 2020-12                                                                                                                           |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| [`@utilize/zod`](./packages/zod)                                                    | [![draft-04 conformance](.github/badges/suite-zod-draft-04.svg)](./packages/zod/README.md#conformance)                              | [![draft-06 conformance](.github/badges/suite-zod-draft-06.svg)](./packages/zod/README.md#conformance)                              | [![draft-07 conformance](.github/badges/suite-zod-draft-07.svg)](./packages/zod/README.md#conformance)                              | [![2019-09 conformance](.github/badges/suite-zod-2019-09.svg)](./packages/zod/README.md#conformance)                              | [![2020-12 conformance](.github/badges/suite-zod-2020-12.svg)](./packages/zod/README.md#conformance)                              |
| [`@utilize/effect`](./packages/effect)                                              | [![draft-04 conformance](.github/badges/suite-effect-draft-04.svg)](./packages/effect/README.md#conformance)                        | [![draft-06 conformance](.github/badges/suite-effect-draft-06.svg)](./packages/effect/README.md#conformance)                        | [![draft-07 conformance](.github/badges/suite-effect-draft-07.svg)](./packages/effect/README.md#conformance)                        | [![2019-09 conformance](.github/badges/suite-effect-2019-09.svg)](./packages/effect/README.md#conformance)                        | [![2020-12 conformance](.github/badges/suite-effect-2020-12.svg)](./packages/effect/README.md#conformance)                        |
| [`@utilize/typescript`](./packages/typescript)                                      | [![draft-04 conformance](.github/badges/suite-typescript-draft-04.svg)](./packages/typescript/README.md#conformance)                | [![draft-06 conformance](.github/badges/suite-typescript-draft-06.svg)](./packages/typescript/README.md#conformance)                | [![draft-07 conformance](.github/badges/suite-typescript-draft-07.svg)](./packages/typescript/README.md#conformance)                | [![2019-09 conformance](.github/badges/suite-typescript-2019-09.svg)](./packages/typescript/README.md#conformance)                | [![2020-12 conformance](.github/badges/suite-typescript-2020-12.svg)](./packages/typescript/README.md#conformance)                |
| [`json-schema-to-typescript`](https://github.com/bcherny/json-schema-to-typescript) | [![draft-04 conformance](.github/badges/suite-json-schema-to-typescript-draft-04.svg)](./docs/conformance.md#type-level-comparison) | [![draft-06 conformance](.github/badges/suite-json-schema-to-typescript-draft-06.svg)](./docs/conformance.md#type-level-comparison) | [![draft-07 conformance](.github/badges/suite-json-schema-to-typescript-draft-07.svg)](./docs/conformance.md#type-level-comparison) | [![2019-09 conformance](.github/badges/suite-json-schema-to-typescript-2019-09.svg)](./docs/conformance.md#type-level-comparison) | [![2020-12 conformance](.github/badges/suite-json-schema-to-typescript-2020-12.svg)](./docs/conformance.md#type-level-comparison) |

</details>

---

<a id="usage"></a>

## 📖 Usage

### Programmatic API

```ts
import { compile as compileZod } from '@utilize/zod';

await compileZod({
  input: './schema.json',
  output: './schema.zod.generated.ts',
});
```

`@utilize/effect` and `@utilize/typescript` export the same `compile`. All three
accept `externalSchemas` to serve a document from memory instead of disk or the
network; the runtime generators also take `formatMode`, and Zod maps individual
formats with `formatMap`. Each package README documents the full options.

### CLI

```sh
utilize-zod schema.json schema.generated.ts
utilize-effect --input 'schemas/**/*.json' --output generated/
utilize-typescript --input 'schemas/**/*.yaml' --output generated/
cat schema.yaml | utilize-zod > schema.generated.ts
```

The CLIs read JSON and YAML, take a file, directory or glob, and write a file,
directory or stdout. Generated files start with a "do not edit" banner
(`--no-banner` omits it). The runtime CLIs also accept `--format-mode`,
`--dialect`, `--fallback-dialect` and `--keyword-policy`; see
[docs/dialects.md](./docs/dialects.md) for the dialect flags.

`--validate` checks every resolved document against the meta-schema of the
dialect the parser resolves, and stops before writing anything when a schema is
invalid. It needs the optional `ajv` package; pass `--validator <module>`
to use another validator instead. Draft-04 schemas also need `ajv-draft-04`.
See [docs/dialects.md](./docs/dialects.md#schema-validation).

---

<a id="playground"></a>

## 🧪 Playground

<p align="center">
  <img src="docs/playground.png" alt="Playground with person.json split across referenced files, the generated Zod schema on the right, and below them a test-data editor next to the generated validator's decoded value" width="100%">
</p>

The [`playground`](./playground) is a browser app for editing multiple JSON
Schema files with references. Switch between the three generators, change the
keyword policy, the format mode or the TypeScript pragmatic inference,
and watch the generated code update live.
Start from one of the built-in examples: each comes with labelled valid and
invalid test documents, so you can compare the generated code with what the
validator does on the same screen.
A test-data editor below the schemas runs the selected generator's validator and
shows the decoded value, defaults included, or every issue with its JSON path;
the TypeScript target emits types only, so the pane says there is no runtime
validator.

- Hosted: <https://matejbransky.github.io/utilize-schema/>
- Reports: <https://matejbransky.github.io/utilize-schema/reports/>
- Pull requests from this repository labeled `Preview` get a Vercel preview
  deployment.

<details>
<summary>Watch the demo (20 s)</summary>

<p align="center">
  <img src="docs/playground.gif" alt="Dropping person.json and address.json onto the playground, choosing the Replace target, dropping a JSON document into the test data, then switching the Format mode to annotate and the generator to Effect Schema while the code and the validator result update" width="100%">
</p>

</details>

---

<a id="supported-features"></a>

## ✅ Supported features

Both runtime generators implement the validation keywords, including
`$ref`/`$defs`, `allOf`/`anyOf`/`oneOf`, conditionals, `patternProperties` and
`unevaluated*` (best effort). The exceptions are annotations a target cannot
enforce, such as `readOnly` in Effect Schema or `discriminator`; the full table
is in [docs/keywords.md](./docs/keywords.md).

The TypeScript generator has no runtime, so validation keywords such as
`minLength`, `pattern` or `uniqueItems` have no type-level equivalent and are
ignored. Use Zod or Effect Schema when you need runtime validation.

Official-suite numbers, with every measured dialect pinned in the package
baselines:

- **Zod:** 1,514 of 1,609 cases; draft-04, draft-06 and draft-07 are complete.
- **Effect Schema:** 1,510 of 1,609 cases; draft-04, draft-06 and draft-07 are complete.
- **TypeScript:** 192 of 285 draft-07 cases at the type level (795 of 972 instances).

The remaining runtime gaps are dynamic/recursive references, full `unevaluated*`
annotation propagation, and a few vocabulary/annotation cases.

---

<a id="learn-more"></a>

## 📚 Learn more

- [Architecture](./docs/architecture.md) — the parser, the linker and the three
  generators.
- [Recursive schemas](./docs/recursion.md) — how each target expresses cycles.
- [Keyword coverage](./docs/keywords.md) — every keyword per target, the dialect
  rules and how the conformance numbers add up.
- [Conformance comparison](./docs/conformance.md) — how the generators compare
  with json-schema-to-typescript.
- [TypeScript vs json-schema-to-typescript](./docs/typescript-vs-json-schema-to-typescript.md)
  — an example-by-example look at where each generator is more precise.

---

<a id="contributing"></a>

## 🛠 Contributing

- Clone the repo, run `pnpm install`
- Run tests: `pnpm test`
- Run the full check: `pnpm verify`
- Rebuild the hosted reports locally: `pnpm build:dev && pnpm --filter playground build && pnpm reports`
- Bug reports are triaged automatically; see [docs/triage.md](./docs/triage.md) for the bot's labels and retry flow.

Tooling: pnpm workspaces, [tsdown](https://tsdown.dev/) for builds,
[Vitest](https://vitest.dev/) for tests, [oxlint](https://oxc.rs/docs/guide/usage/linter)
and [oxfmt](https://oxc.rs/docs/guide/usage/formatter) for lint and format,
[Changesets](https://github.com/changesets/changesets) for releases, and
[fallow](https://fallow.tools/) for unused code, duplication, complexity,
dependency and architecture checks (`pnpm fallow`, `pnpm fallow:audit`).

The full guide, including changesets and release steps, is in
[CONTRIBUTING.md](./CONTRIBUTING.md) and [RELEASING.md](./RELEASING.md).
Participation is covered by the [Code of Conduct](./CODE_OF_CONDUCT.md).

---

<a id="license"></a>

## 📄 License

MIT. See [LICENSE](./LICENSE).

---

## 🙏 Credits

Inspired by [json-schema-to-typescript](https://github.com/bcherny/json-schema-to-typescript)
and the Zod community. [`@utilize/typescript`](./packages/typescript) is a
drop-in alternative to it, built on the same parser as the runtime generators.
