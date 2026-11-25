---
'@utilize/json-schema': minor
---

Add the `@utilize/json-schema/node` entry with the Node-only helpers the generators' `compile` functions and CLIs share: `runGeneratorCli`, `formatAndDialectFlags`, `readFormatAndDialectFlags` and `isEntrypoint` for the CLIs, and `readSchema`, `parseSchemaSource`, `parseForCompile`, `compilePaths`, `schemaFileLocation`, `generatedFileBanner` and `prependBanner` for compiling files. They read and write files, so they are not in the main entry, which stays free of `node:*` imports and keeps running in the browser. The package now has an `exports` map (`.`, `./node`, `./dist/*` and `./package.json`) and depends on `js-yaml` to read YAML schemas.
