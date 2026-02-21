# GitHub Project Automation

Reusable GitHub Action to automate cross-repo PR + Issue + Projects V2 workflows. This repo is set up for Sneha first, but the action is configurable for other repo pairs through `.github/automation.yml`.

## Features (Phase 1)
- On PR `review_requested` or `ready_for_review`
  - Add label `Ready For Review` to the PR (if missing)
  - Parse `Targets: coloredcow-admin/sneha-lms#<issue_id>` from PR body
  - Move Issue to `In review` in Project V2 `SNEHA LMS`
  - Audit comments on the Issue for changes that occurred
- On PR review `submitted` with state `approved` or `changes_requested`
  - Remove any configured ready-for-review label from the PR
  - Add reviewed label `status : reviewed` (if missing)
- On PR `opened` or `synchronize`
  - Optionally self-assign the targeted issue to the PR author (without removing existing assignees)
  - Move Issue to `In Progress` if not already at/after `In review`
  - Audit comments only if status changed
- If Issue is not in the Project, add it first
- No spam: comments are only posted when an actual change occurred
- If Targets line is missing/invalid, comment on the PR and exit

## Usage

## Prerequisites
- A pull request template that includes a Targets line:
  - `Targets: owner/repo#<issue_id>` (cross-repo)
  - `Targets: #<issue_id>` (same-repo)
- A GitHub Project V2 with a single-select Status field and options matching your config.
- Repository files:
  - `.github/automation.yml`
  - `.github/workflows/pr_automation.yml`

## Setup (Consuming Repo)
1. Create a **classic PAT** (recommended, works reliably with Projects V2):
   - Settings -> Developer settings -> Personal access tokens -> Tokens (classic)
   - Scopes:
     - `repo`
     - `read:project`
     - `write:project`
   Note: We tried fine-grained PATs, but Projects permissions are not always available there. Classic PATs work consistently for Projects V2.
2. Add the token as a secret in the PR repo:
   - Secret name: `GH_AUTOMATION_TOKEN`
3. Add `.github/automation.yml` and `.github/workflows/pr_automation.yml` (examples below).

### Workflow example (coloredcow-admin/sneha)
```yaml
name: PR Automation

on:
  pull_request:
    types: [opened, synchronize, ready_for_review, review_requested]
  pull_request_review:
    types: [submitted]

permissions:
  contents: read
  pull-requests: write
  issues: write

jobs:
  pr-automation:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run automation
        uses: satendra-sr/github-project-automation@v1
        with:
          token: ${{ secrets.GH_AUTOMATION_TOKEN }}
          config-path: .github/automation.yml
```

### Config schema
Create `.github/automation.yml` in the consuming repo:
```yaml
issue_repo:
  owner: coloredcow-admin
  name: sneha-lms
project:
  owner: coloredcow-admin
  name: SNEHA LMS
  status_field: Status
  status_order:
    - Backlog
    - Ready
    - On Hold
    - In Progress
    - In review
    - QA
    - Completed
labels:
  ready_for_review: Ready For Review
  ready_for_review_any:
    - Ready For Review
    - "status: ready for review"
  reviewed: "status : reviewed"
  reviewed_any:
    - "status : reviewed"
    - Reviewed
rules:
  - on:
      event: pull_request
      actions: [opened]
    do:
      - assign_issue_to_pr_author: true
  - on:
      event: pull_request
      actions: [opened, synchronize]
    do:
      - ensure_issue_in_project: true
      - ensure_status_at_least: In Progress
      - audit_on_change: true
  - on:
      event: pull_request
      actions: [review_requested, ready_for_review]
    do:
      - add_pr_label_if_missing: Ready For Review
      - ensure_issue_in_project: true
      - ensure_status_at_least: In review
      - audit_on_change: true
  - on:
      event: pull_request_review
      actions: [submitted]
    do:
      - remove_pr_labels_if_present:
          - Ready For Review
          - "status: ready for review"
      - add_pr_label_if_missing: "status : reviewed"
```

`assign_issue_to_pr_author` adds the PR author to the issue assignees list only if not already assigned. Existing assignees are preserved.

## Inputs
- `token` (required): Token with cross-repo + Projects V2 permissions
- `config-path` (optional): Defaults to `.github/automation.yml`
- `dry-run` (optional): Defaults to `false` and skips writes when true

## Outputs
- `did_label_change`
- `did_status_change`
- `issue_number`
- `target_status`

## Targets line format
Required in PR body:
```
Targets: coloredcow-admin/sneha-lms#123
```
This format is intentionally strict. The action will only accept a `Targets` line that matches the repo configured under `issue_repo` in `.github/automation.yml`. This keeps cross-repo automation explicit and safe.
Supported whitespace variants:
- `Targets:coloredcow-admin/sneha-lms#123`
- `Targets: coloredcow-admin/sneha-lms #123`
For same-repo cases, a short format is also accepted:
- `Targets: #123`

If missing or invalid, the action comments on the PR and exits.

## Permissions / Token scopes
`GITHUB_TOKEN` often lacks cross-repo + Projects V2 permissions. Use a secret token input named `GH_AUTOMATION_TOKEN`.

### PAT classic
Required scopes:
- `repo` (read/write issues + PRs)
- `read:project` and `write:project` (Projects V2)

### Fine-grained PAT
Grant access to both repos and:
- Issues: Read & write on `coloredcow-admin/sneha-lms`
- Pull requests: Read & write on `coloredcow-admin/sneha`
- Projects: Read & write (organization-level Projects V2)

### GitHub App
Grant installation to both repos and add:
- Issues: write
- Pull requests: write
- Projects: read/write

## Build and bundle
This action is bundled via `esbuild` (CJS output) and committed to `dist/index.js`.
Runtime: Node.js 24 (set in `action.yml`).

```bash
npm run build
npm run bundle
```

## Troubleshooting
- **Project not found**: Ensure `project.owner` and `project.name` match exactly, or set `project.number`.
- **Status option mismatch**: Ensure `status_order` entries exactly match the Project Status options.
- **Missing Targets**: Add `Targets: coloredcow-admin/sneha-lms#<issue_id>` to the PR body.
- **Permissions errors**: Use a token with cross-repo issue/PR write and Projects V2 read/write scopes.

## Example consuming repo files
See `examples/coloredcow-admin-sneha/.github/workflows/pr_automation.yml` and `examples/coloredcow-admin-sneha/.github/automation.yml`.
