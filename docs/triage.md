# Issue triage

Bug reports labeled `bug` are triaged by the bot in
[Triage](../.github/workflows/triage.yml). It uses
[OpenCode](https://opencode.ai) as the agent and the skill in
[`.agents/skills/triage`](../.agents/skills/triage) for the actual work.

The model is **not hardcoded**. It is a repository variable in the
`provider/model` format that OpenCode understands, so the same bot can run on
OpenCode Go today, Anthropic next month, or a self-hosted OpenAI-compatible
endpoint. Switching providers is a variable and a secret change, not a code
change.

Feature requests are not triaged. The bug report template applies the `bug`
label at creation time, and the workflow only runs for issues that have it.

## Why this is not `triagebot-action`

The upstream `withastro/triagebot-action` is a good reference, but its bundled
`pi-ai` model catalog is static and its credential handling is provider-specific.
At v0.4.0 it cannot use the current OpenCode Go catalog:

- `opencode-go/deepseek-v4.1-flash` is not in the bundled catalog, so
  `resolveModel` throws before the first request.
- The Go gateway requires a session header (`x-opencode-session`, also satisfied
  by `session_id` or `x-session-affinity`); the bundled `opencode-go` models do
  not send it and get HTTP 400 `MissingSessionID`.
- The action's credential check does not know `OPENCODE_API_KEY`.

Patching that action would still leave us maintaining a provider catalog. This
bot owns the small state machine and delegates all model/provider quirks to
OpenCode, which is the component that already supports the providers we care
about.

## How it works

```text
GitHub event
  → .github/workflows/triage.yml
  → agent step: scripts/triage/run.mjs (read token + model key)
      ├─ label state machine (scripts/triage/router.mjs)
      └─ `opencode run --model "$TRIAGE_MODEL" ...`
            └─ .agents/skills/triage → report.md, result.json, comment.md, pr.md
  → App token created only after the agent exits
  → apply step: scripts/triage/apply.mjs (write token)
      └─ commit, push, PR, comment, labels
```

The agent gets a read-only GitHub token and the model key. The App token used
for writes is created only after the agent process exits and stays in
`apply.mjs`, so it is not in the agent's environment or its parent process. See
[Security](#security).

## Model configuration

Set these repository variables and secrets:

| Name                     | Type     | Required | Value                                                         |
| ------------------------ | -------- | -------- | ------------------------------------------------------------- |
| `TRIAGE_MODEL`           | variable | yes      | Any OpenCode model, e.g. `opencode-go/deepseek-v4.1-flash`    |
| `TRIAGE_MODEL_API_KEY`   | secret   | yes      | The key for that provider                                     |
| `TRIAGE_MODEL_BASE_URL`  | variable | no       | OpenAI-compatible base URL for a custom provider              |
| `TRIAGE_OPENCODE_CONFIG` | variable | no       | Full `opencode.json` content, as JSON, for advanced providers |

`run.mjs` maps the provider prefix to the environment variable OpenCode expects:

| Provider prefix                | Environment variable                                 |
| ------------------------------ | ---------------------------------------------------- |
| `opencode-go`, `opencode`      | `OPENCODE_API_KEY`                                   |
| `anthropic`                    | `ANTHROPIC_API_KEY`                                  |
| `openai`                       | `OPENAI_API_KEY`                                     |
| `openrouter`                   | `OPENROUTER_API_KEY`                                 |
| `deepseek`                     | `DEEPSEEK_API_KEY`                                   |
| `google`                       | `GEMINI_API_KEY`                                     |
| `xai`                          | `XAI_API_KEY`                                        |
| `groq`                         | `GROQ_API_KEY`                                       |
| `mistral`                      | `MISTRAL_API_KEY`                                    |
| `cerebras`                     | `CEREBRAS_API_KEY`                                   |
| `fireworks`                    | `FIREWORKS_API_KEY`                                  |
| `together`                     | `TOGETHER_API_KEY`                                   |
| `minimax`, `moonshotai`, `zai` | `MINIMAX_API_KEY`, `MOONSHOT_API_KEY`, `ZAI_API_KEY` |
| `cloudflare-workers-ai`        | `CLOUDFLARE_API_KEY`                                 |

Anything else needs `TRIAGE_MODEL_BASE_URL` (an OpenAI-compatible endpoint) or
`TRIAGE_OPENCODE_CONFIG` with a full provider definition. The script fails with
a clear error instead of silently using the wrong provider.

Some built-in providers need more than an API key (for example
`CLOUDFLARE_ACCOUNT_ID` for Workers AI, or an AWS role for Bedrock). Add those
variables to both triage steps, or put the whole provider definition in
`TRIAGE_OPENCODE_CONFIG`.

Examples:

- **OpenCode Go:** `TRIAGE_MODEL=opencode-go/deepseek-v4.1-flash`, and
  `TRIAGE_MODEL_API_KEY` is the Go API key from the OpenCode Console.
- **Anthropic:** `TRIAGE_MODEL=anthropic/<model-id>` (take the current Sonnet
  or Opus id from `opencode models`), and the secret is an Anthropic API key.
- **OpenAI:** `TRIAGE_MODEL=openai/<model-id>`, and the secret is an OpenAI key.
- **OpenRouter:** `TRIAGE_MODEL=openrouter/<vendor>/<model>`, and the secret is
  an OpenRouter key.
- **Custom OpenAI-compatible endpoint:** `TRIAGE_MODEL=custom/<model-id>`,
  `TRIAGE_MODEL_BASE_URL=https://example.test/v1`, and the secret is that
  provider's key. The bot generates a provider config using
  `@ai-sdk/openai-compatible`.

A model variant can be appended: `TRIAGE_MODEL=opencode-go/deepseek-v4.1-flash#high`.

Run `opencode models` with the same provider key to see the exact model IDs the
pinned CLI knows. The model must support tool calling, file edits, and shell
commands. A model without reliable tool use can still answer, but it cannot run
the triage pipeline. Test a new model with a small issue before enabling it for
everything.

## Setup

### 1. Create a GitHub App

Create a dedicated App (for example `utilize-triage`) with these repository
permissions and install it only on this repository:

- **Contents:** read and write (push the fix branch).
- **Issues:** read and write (comments and labels).
- **Pull requests:** read and write (open the PR).
- **Metadata:** read-only (implicit).

Do **not** grant Actions, Workflows, Packages, or organization permissions. The
App cannot modify workflow files, which keeps a prompt-injected agent from
changing CI or the release process.

### 2. Configure variables and secrets

| Name                     | Type     | Value                                                  |
| ------------------------ | -------- | ------------------------------------------------------ |
| `TRIAGE_APP_CLIENT_ID`   | variable | The App's client ID                                    |
| `TRIAGE_BOT_LOGIN`       | variable | The App's bot login, for example `utilize-triage[bot]` |
| `TRIAGE_MODEL`           | variable | `provider/model` for the agent                         |
| `TRIAGE_APP_PRIVATE_KEY` | secret   | The App's private key                                  |
| `TRIAGE_MODEL_API_KEY`   | secret   | The model provider's API key                           |

`TRIAGE_BOT_LOGIN` is required. Without it the bot may react to its own
comments and loop.

The workflow is a no-op until `TRIAGE_MODEL`, `TRIAGE_BOT_LOGIN`, and
`TRIAGE_APP_CLIENT_ID` exist. The secrets must also be set, or the configuration
check fails before any model call.

### 3. Create the labels

```sh
./scripts/setup-triage-labels.sh
```

The bot adds labels through the API. A missing state label fails the run, and
the failure handler posts an error comment, so create all of them first. The
script also creates the priority (`- P0` … `- P3`) and `pkg:` labels that the
agent can select in `result.json`.

### 4. Test it

Open an issue through the **Bug report** template. The `bug` label is applied
at creation, which is what starts the run. Start with a bug whose answer you
already know, and review the PR. Change `TRIAGE_MODEL` and
`TRIAGE_MODEL_API_KEY` to switch providers; no workflow or code change is
needed.

The agent CLI is pinned in the root `package.json` (`@opencode/cli@2.4.2`)
and installed by `pnpm install`. Update the pin deliberately, after a test run.

## State machine

Every issue has at most one `triage:` label. The label is the state; the issue
comments are the audit trail. There is no database.

| Label                         | Meaning                                                              |
| ----------------------------- | -------------------------------------------------------------------- |
| `triage: needs triage`        | Waiting for a run, or a re-run after a new comment                   |
| `triage: not actionable`      | Not a bug report, or the behavior is intended                        |
| `triage: needs reproduction`  | Missing schema, steps, or expected behavior                          |
| `triage: skipped`             | Cannot triage in CI (browser-only, unsupported runtime, old version) |
| `triage: unable to reproduce` | The failing test could not be produced                               |
| `triage: unable to fix`       | Reproduced and diagnosed, but no fix was found                       |
| `triage: failed`              | Unexpected failure; a human comment can retry                        |
| `triage: fix pending`         | Reserved for a preview-release flow; unused by this bot              |
| `triage: fix rejected`        | The reporter says the fix does not work                              |
| `triage: fix verified`        | A pull request was opened (or the fix was confirmed)                 |

The bot opens PRs directly (`auto-PR`). An `intended-behavior` verdict maps to
`triage: not actionable`, not `unable to fix`.

## Operating the bot

- **Retry an issue:** comment with new information (a schema, an error, a
  version). Comments on retriageable labels are re-run if they look actionable,
  and maintainers can always trigger a re-run with a comment.
- **Stop the bot for an issue:** remove the `bug` label.
- **Disable the bot:** disable the **Triage** workflow, or clear
  `TRIAGE_MODEL`.
- **Fix branch:** `triagebot/fix-<issue-number>`. It is force-pushed on each
  run and deleted when the issue is closed.
- **Failure:** the bot posts the error, labels the issue `triage: failed`, and
  fails the workflow. A maintainer can retry by commenting.

## Security

- The agent runs with the read token (`GH_TOKEN` / `GITHUB_TOKEN`) and the model
  key. The App token is created only after the agent exits, so it cannot be read
  from the agent's environment or the parent process environment.
- `OPENCODE_CONFIG_CONTENT` denies `git push`, writes through `gh`, and publish
  commands. Explicit denies stay enforced with `--auto`.
- `run.mjs` rejects changes to `.github/`, any `package.json`,
  `pnpm-workspace.yaml`, the lockfile, `scripts/triage/`, credential files, and
  the known-failure baselines. It also requires a changeset when a fix touches
  `packages/`.
- Changed files are scanned for the model key and GitHub tokens before commit,
  and the comment/PR text is redacted before it is posted.
- No npm token, release environment, or workflow permission is available in the
  job. The bot cannot publish, change CI, or bypass the `main` ruleset.
- The bot PR is a normal PR: required review, Code Owners, and the
  `Run code quality tools and tests` check all apply.
- The issue body is untrusted input. The prompt treats it as data, and the
  agent never receives the write token.
- The agent and apply steps share a runner. The App token is created after the
  agent exits, but a background process deliberately left by the agent could
  observe the apply step's environment. The runner is ephemeral; for stronger
  isolation, move the apply step to a separate job on a fresh runner.

## Limitations

- **Model quality varies.** A model that cannot call tools reliably will not
  finish the pipeline; test a new model before switching the default.
- **OpenCode is pinned.** A new CLI release is adopted by changing the
  `@opencode/cli` version in the root `package.json`.
- **No preview releases.** The bot opens a PR directly. Reporter confirmation
  happens in the PR thread; `triage: fix pending` is reserved.
- **No playground browser tests.** The runner does not install Playwright.
  Package tests and `check:types` run; browser-only playground bugs should be
  labeled `triage: skipped` and handled manually.
- **Closing the issue deletes the fix branch.** If a bot PR is still open, merge
  or close the PR before closing the issue.
- **The bot can be wrong.** It is a triage assistant, not an auto-merge. The PR
  review is the safety gate.

## Local use

The same skill works in a local OpenCode session:

```sh
opencode run --standalone --model opencode-go/deepseek-v4.1-flash \
  "triage issue #123"
```

The bot scripts are plain Node.js and can be tested without GitHub:

```sh
pnpm triage:test
```

`run.mjs` writes its working files to `triage/gh-<number>/`, which is
gitignored; `apply.mjs` reads them after the agent exits.

## Cost

Each run is one OpenCode agent session; a re-triage starts another. Cost
depends entirely on the model and how many test runs the agent performs. Set a
monthly budget on the provider account, and keep the model key in a repository
secret. The workflow timeout is 60 minutes; the agent itself is capped at 45.
