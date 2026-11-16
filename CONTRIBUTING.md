# Contributing to Utilize Schema

Thank you for your interest in contributing! We welcome bug reports, feature requests, and pull requests.

## Getting Started

This repository requires Node.js 24 and pnpm 11. The exact pnpm version is
pinned in `package.json#packageManager`; Corepack can install it for you.

1. **Clone the repository:**

   ```sh
   git clone https://github.com/your-org/utilize-schema.git
   cd utilize-schema
   ```

2. **Install dependencies:**

   ```sh
   pnpm install
   ```

3. **Run the tests:**
   ```sh
   pnpm test
   ```

## Project Structure

- `packages/json-schema`: Core JSON Schema utilities and parser.
- `packages/zod`: Zod code generator and related logic.
- `packages/effect`: Effect Schema code generator and related logic.
- `playground`: Browser app for editing multi-file schemas and previewing the generated Zod or Effect Schema code.

## Playground previews

Every pull request gets a preview deployment of the playground on Vercel. The
project uses the **Root Directory** `playground` and `playground/vercel.json`,
so Vercel installs the pnpm workspace from the repository root and then builds
only the playground (`playground/dist`).

Keep `vercel.json` inside the Root Directory: Vercel resolves its paths relative
to it, so a `vercel.json` at the repository root would point at
`playground/playground/dist` and fail with `STATIC_BUILD_NO_OUT_DIR`.

To set this up on a fork or a new repository:

1. Import the repository in Vercel and set the **Root Directory** to
   `playground`.
2. Keep the framework preset on Vite; `playground/vercel.json` supplies the
   build command and output directory.
3. Do not add a custom domain to preview deployments, so every PR keeps its own
   URL.

## Development Workflow

- Use [pnpm](https://pnpm.io/) for all scripts and dependency management.
- Make sure all tests pass before submitting a PR.
- Write or update tests for any new features or bug fixes.
- Use TypeScript and follow the existing code style (oxlint and oxfmt).

## Running Tests

- Run all tests:
  ```sh
  pnpm test
  ```
- Run tests in watch mode:
  ```sh
  pnpm test -- --watch
  ```

## Dependency Versions

Shared dependencies are pinned once in the `catalog` section of `pnpm-workspace.yaml`.
Package manifests reference them with `"catalog:"` instead of a version range, so an upgrade
only changes the catalog entry. Use `pnpm add --save-catalog` for a new shared dependency.

## Code Style

- Format code with oxfmt:
  ```sh
  pnpm format
  ```
- Lint code with oxlint:
  ```sh
  pnpm check:lint
  ```

## Making a Pull Request

1. Fork the repository and create your branch from `main`.
2. Add your changes and tests.
3. Ensure all tests pass and code is formatted.
4. Open a pull request with a clear description of your changes.

## Reporting Issues

- Please include:
  - A clear description of the problem.
  - Steps to reproduce.
  - Example schema/code if possible.

## Feature Requests

- Open an issue describing your use case and proposed solution.
- If you want to implement it yourself, mention that in the issue.

## Contact

For questions, open an issue or start a discussion.

---

Thank you for helping make Utilize Schema better!
