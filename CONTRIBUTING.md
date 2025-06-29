# Contributing to Utilize Schema

Thank you for your interest in contributing! We welcome bug reports, feature requests, and pull requests.

## Getting Started

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

## Development Workflow

- Use [pnpm](https://pnpm.io/) for all scripts and dependency management.
- Make sure all tests pass before submitting a PR.
- Write or update tests for any new features or bug fixes.
- Use TypeScript and follow the existing code style (see `.editorconfig` and Prettier config).

## Running Tests

- Run all tests:
  ```sh
  pnpm test
  ```
- Run tests in watch mode:
  ```sh
  pnpm test -- --watch
  ```

## Code Style

- Format code with Prettier:
  ```sh
  pnpm format
  ```
- Lint code:
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
