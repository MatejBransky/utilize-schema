## Key Points about the Workspace (utilize-schema)

- This is an actively developed project.
- It is necessary to regularly check if any new packages have been added to `packages/` or if any new key files have appeared.

### 1. **Project Architecture**

- The project is a monorepo with npm packages in `packages/`, each package has its own `package.json`, `src/` (source code), and `test/` (tests).
- The main motivation and architecture are described in `NOTES.md`, which is the central document and should be part of the context for all workspace groups.
- The first and main package is `packages/core`.

### 2. **Testing Structure and Philosophy**

- Source code and tests are handled together; tests are named analogously to source files with the `.test.ts` postfix.
- Tests are data-driven, often using a `testCases` array for different scenarios.
- Some files (e.g.: `types/JSONSchema.ts`, `types/AST.ts`) do not have tests.

### 3. **Key Files in `packages/core`**

- `src/types/JSONSchema.ts`
- `src/types/AST.ts`
- `src/dereference.ts` + `test/dereference.test.ts`
- `src/linker.ts` + `test/linker.test.ts`
- `src/normalizer.ts` + `test/normalizer.test.ts`
- `src/rules.ts`
- `src/traverse.ts` + `test/traverse.test.ts`
- `src/utils.ts` + `test/utils.test.ts`
- `test/test-utils.ts`
- `package.json` (and possibly other configuration files)

### 4. **Workspace Groups**

- **@utilize/json-schema-core – key modules and their tests:**  
  Contains all the above source files and tests + always includes `NOTES.md`.
- **Core library – configuration:**  
  Contains `package.json` and `NOTES.md`.

### 5. **Important Notes**

- `NOTES.md` is always part of every workspace group.
- Future files (e.g. `parser.ts`, `optimizer.ts`) can be added to the workspace in advance, even if they do not exist yet.
- It is recommended to store the workspace JSON in the root of the repository (e.g. `codecompanion.workspace.json`).
- Manual workspace edits can be tedious – you can use an assistant for generating and editing.

---

**Example workspace groups in JSON:**

```json
"groups": [
  {
    "name": "@utilize/json-schema-core – key modules and their tests",
    "system_prompt": "You are working with the core package of a JSON Schema to Zod generator. Always consider the architectural notes in NOTES.md.",
    "data": [
      "notes_md",
      "jsonschema_ts",
      "ast_ts",
      "dereference_ts",
      "dereference_test_ts",
      "linker_ts",
      "linker_test_ts",
      "normalizer_ts",
      "normalizer_test_ts",
      "rules_ts",
      "traverse_ts",
      "traverse_test_ts",
      "utils_ts",
      "utils_test_ts",
      "test_utils_ts"
    ]
  },
  {
    "name": "Core library – configuration",
    "data": [
      "notes_md",
      "core_package_json"
    ]
  }
]
```

---
