# Releasing

Releases are controlled by Matej. Other maintainers can review, merge and
trigger work, but cannot publish a package or change the release controls.

## Roles

| Role             | Who   | Can do                                                                                                                                |
| ---------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Repository admin | Matej | Change repository settings, rulesets, environments and secrets; bypass the `main` ruleset; approve the `npm-publish` environment.     |
| Maintainer       | Phil  | Triage issues, review pull requests, push branches and merge after Matej's approval. Cannot change settings, read secrets or publish. |

Invite a maintainer with:

```sh
gh api -X PUT repos/MatejBransky/utilize-schema/collaborators/<github-login> \
  -f permission=maintain
```

Do not grant `admin` on GitHub or `maintainer` on npm to anyone who should not
be able to publish.

## Release controls

The following settings are required on GitHub. They are UI/API settings, not
files in the repository.

### `main` branch ruleset

- Require a pull request before merging.
- Require **1** approval.
- Dismiss stale approvals when new commits are pushed.
- Require review from Code Owners (`.github/CODEOWNERS`).
- Require the **Run code quality tools and tests** status check.
- Block force pushes and branch deletion.
- Allow the repository admin (Matej) to bypass the ruleset so a solo change
  is still possible; maintainers cannot bypass it.

### Version pull request token

Pull requests created with the repository `GITHUB_TOKEN` do not trigger
`pull_request` workflows. Configure a GitHub App with `contents: write` and
`pull-requests: write`, install it on this repository, and set:

- repository variable `RELEASE_APP_CLIENT_ID`
- repository secret `RELEASE_APP_PRIVATE_KEY`

The Version workflow uses that app token for the version PR, so the required
`Run code quality tools and tests` check runs. Without it, the workflow falls
back to `GITHUB_TOKEN` and the version PR will be blocked by the ruleset.

### `npm-publish` environment

- Required reviewer: Matej.
- Prevent self-review is optional, but the reviewer must be Matej.
- Deployment branches: `main` only.

The release job references this environment, so no publish step starts until
Matej approves the deployment.

### Tag ruleset

Protect `v*` and `@utilize/*` tags from updates and deletion. Changesets creates
package tags such as `@utilize/zod@0.5.0`, so a `v*`-only rule would not cover
release tags. This keeps a published version pointing at the commit that
produced it.

### npm trusted publishing

For `@utilize/json-schema`, `@utilize/zod` and `@utilize/effect`, configure a
trusted publisher on npmjs.com:

- Provider: GitHub Actions
- Repository: `MatejBransky/utilize-schema`
- Workflow: `release.yml`
- Environment: `npm-publish`
- Allowed action: `npm publish`

Publishing uses the GitHub OIDC token. The workflow does not use `NPM_TOKEN`.
After a successful OIDC release, delete the old `NPM_TOKEN` repository secret.

A trusted publisher only applies to a package that already exists on npm, and
npm removes a fresh configuration that does not complete a publish within about
48 hours. Add it right before the release that uses it.

### First publish of a new package

npm cannot trust a package that does not exist yet, so a new package needs one
manual publish before its trusted publisher can be added. Do it **before** the
version pull request bumps the package, so the release workflow still publishes
the real version and creates its tag:

```sh
git switch main && git pull
pnpm install
pnpm --filter @utilize/<name> build
npm login
(cd packages/<name> && npm publish --access public)   # placeholder version
```

`npm publish` has to run inside the package directory: npm does not read
`pnpm-workspace.yaml`, so `npm publish --workspace …` fails. Publishing the
already bumped version instead would make `changeset publish` skip the package,
and no git tag or GitHub release would be created for it.

Publishing from an agent or a script fails with `EOTP` when the account requires
2FA, so a maintainer runs this step in an interactive terminal. Finish the npm
web authentication prompt and the placeholder version is published.

Then add the trusted publisher right before the release that uses it:

```sh
npm trust github @utilize/<name> --file release.yml \
  --repo MatejBransky/utilize-schema --env npm-publish --allow-publish --yes
```

Peer dependencies are declared, not bundled: `@utilize/effect` expects
`effect >=4.0.0 <5`, so consumers install `effect` themselves.

## Normal release flow

1. Add a changeset to the pull request:

   ```sh
   pnpm changeset
   pnpm changeset status
   ```

2. Merge the pull request into `main` after CI and Matej's review.

3. The **Version** workflow opens or updates the `chore: update versions`
   pull request. Merge it once CI passes.

4. Run the **Release** workflow manually. It waits for approval of the
   `npm-publish` environment. Matej approves it.

5. `changesets/action` publishes the bumped packages with OIDC, creates the
   release tags and creates the GitHub releases.

If the Release workflow finds unmerged changesets, it opens the version pull
request instead of publishing. Merge that pull request and run Release again.

## Local commands

```sh
pnpm changeset            # describe a change and choose its bump
pnpm changeset status     # show pending changesets and the next versions
pnpm ci:version           # apply changesets and update changelogs
pnpm ci:publish           # publish packages and create tags (maintainers only)
```
