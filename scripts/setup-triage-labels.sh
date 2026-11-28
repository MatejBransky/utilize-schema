#!/usr/bin/env sh
# Create the labels the triage bot and its state machine rely on.
#
# Usage:
#   ./scripts/setup-triage-labels.sh
#   REPO=owner/name ./scripts/setup-triage-labels.sh
#
# `gh label create --force` updates an existing label in place, so the script is
# idempotent. The `--` is required for the priority labels because their names
# start with a dash.

set -eu

REPO="${REPO:-MatejBransky/utilize-schema}"

create_label() {
	name="$1"
	color="$2"
	description="$3"

	gh label create \
		--repo "$REPO" \
		--color "$color" \
		--description "$description" \
		--force \
		-- "$name"
}

# State labels. Every one of these is added by the bot through the API.
create_label "triage: needs triage" "FBCA04" "Waiting for the triage bot to run"
create_label "triage: not actionable" "E4E669" "Not a bug report (feature request, question, discussion)"
create_label "triage: needs reproduction" "D876E3" "Missing schema, steps, or expected behavior"
create_label "triage: skipped" "C5DEF5" "Cannot be triaged in CI (browser-only, unsupported runtime, old version)"
create_label "triage: unable to reproduce" "E99695" "The bot could not reproduce the report"
create_label "triage: unable to fix" "D93F0B" "Reproduced and diagnosed, but no fix was found"
create_label "triage: failed" "B60205" "Unexpected triage failure; retried up to three times"
create_label "triage: fix pending" "1D76DB" "Fix branch exists, waiting for reporter confirmation"
create_label "triage: fix rejected" "B60205" "The reporter says the fix does not work"
create_label "triage: fix verified" "0E8A16" "Reporter confirmed the fix, or the PR was opened directly"

# Applied to PRs opened by the bot.
create_label "fix verified" "0E8A16" "Fix verified by the triage pipeline"

# Priority labels. The bot asks the agent to select exactly one. Keep the
# "- P" prefix.
create_label "- P0" "B60205" "Critical: data loss, security, or a broken core workflow"
create_label "- P1" "D93F0B" "High: a common workflow is broken, no workaround"
create_label "- P2" "FBCA04" "Normal: a real bug with a workaround"
create_label "- P3" "0E8A16" "Low: niche combination, cosmetic, or an experimental feature"

# Package labels. The bot selects zero to three. Keep the "pkg:" prefix.
create_label "pkg: json-schema" "1D76DB" "Parsing, linking, refs, dialects, and normalization"
create_label "pkg: zod" "5319E7" "The Zod generator and runtime behavior"
create_label "pkg: effect" "5319E7" "The Effect Schema generator and runtime behavior"
create_label "pkg: typescript" "5319E7" "The TypeScript type generator"
create_label "pkg: playground" "0E8A16" "The browser playground"
create_label "pkg: docs" "0075CA" "Documentation and examples"
