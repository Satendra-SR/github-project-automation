# Agent Operating Guide

## Routing
- Use `.codex/agents/implementation-planner.md` for analysis, sequencing, risk identification, and acceptance criteria.
- Use `.codex/agents/implementation-executor.md` only after a plan is approved.

## Intent Routing
- If user intent is planning, route to `.codex/agents/implementation-planner.md`.
- Planning intent keywords:
  - `plan`
  - `execution plan`
  - `technical breakdown`
  - `break into tasks`
  - `how should we implement`
- If user intent is implementation, route to `.codex/agents/implementation-executor.md`.
- Execution intent keywords:
  - `execute plan`
  - `implement plan`
  - `start implementation`
  - `start coding`
  - `build this`
- If issue URL/number is provided, treat it as the primary source context.
- If issue URL/number is missing, ask for it before planner/executor proceeds.
- Default behavior:
  - planning-like prompt -> planner
  - implementation-like prompt -> executor

## Local-Only Operation
- Run planner/executor locally from your machine; do not use GitHub Actions triggers for this flow.
- Trigger by explicit local command (example target interface):
  - `npm run agent:plan -- <issue-url>`
  - `npm run agent:execute -- <issue-url>`
- Parse comment directives from GitHub, but do not auto-run from GitHub events.

## Global Rules
- Keep scope strictly tied to the user request.
- Do not silently expand requirements.
- Make assumptions explicit and minimal.
- Prefer small, reversible changes.
- If implementation changes `src/`, validate build and test results before closing.
- Accept execution/update directives only from approved user(s) (at minimum your GitHub username).

## Handoff Contract
The planner must output:
- Objective
- Scope and explicit out-of-scope
- Files expected to change
- Ordered implementation steps
- Risks and mitigations
- Validation commands and expected outcomes
- Ready-for-execution checklist

The executor must:
- Implement only the approved plan
- Flag and pause on unclear or conflicting plan details
- Report actual file changes
- Report commands run and outcomes
- Report deviations from plan with rationale

## GitHub Issue Plan Lifecycle
- Planner must create or update a single issue comment for the plan, not multiple drifting comments.
- Use a stable marker in that comment, for example:
  - `<!-- impl-plan:issue-<number> -->`
- Re-planning must edit the same comment and increment version label (`v1`, `v2`, ...).
- Planner updates should incorporate user feedback from newer issue comments.
- Execution should only start after explicit approval:
  - local operator trigger, and/or
  - approved issue comment command such as `/plan-approve` or `/execute` by allowed user.

## Branch and PR Automation
- Execution runs on a dedicated branch, never directly on `main`.
- Branch name must be prefixed with `codex/` and include issue number when available.
  - Example: `codex/123-targets-parser-fix`
- Before creating a branch, sync base branch locally:
  - `git checkout main`
  - `git pull origin main`
- Commit only changed files relevant to the task; avoid broad staging.
- Use conventional commit style and reference issue number when available.
  - Example: `feat: improve targets parsing (#123)`
- After implementation and validation:
  - push branch
  - create PR to `main`
  - include `Related: <issue-url>` in PR body
- Do not use `Fixes`/`Closes` keywords automatically unless explicitly requested.

## Repo-Specific Validation
- Use `npm test` for tests.
- Use `npm run build` for TypeScript compile checks.
- When source behavior changes, run `npm run bundle` and include `dist/index.js` in changes when required by release flow.

## Codex Custom Agents

Custom Codex agents are defined in `.codex/agents/`.

| Agent | When to Use |
|-------|-------------|
| `implementation-planner` | When asked to create an implementation plan, technical breakdown, phased tasks, or task decomposition for a feature/issue. |
| `implementation-executor` | When asked to implement a feature based on an existing plan (GitHub issue comment or markdown plan), with stepwise execution and verification. |
| `requirement-refiner` | When asked to refine raw feature requests so requirements are clear, complete, and easy to understand without implementation details. |

### Agent Invocation Convention

When the user asks to use an agent, follow this format in prompt language:
- `Use implementation-planner for issue #<number>: <feature request>`
- `Use implementation-executor for issue #<number> using latest plan comment`
- `Use implementation-executor with plan from <path-to-plan-md>`
- `Use requirement-refiner for issue #<number>: <raw requirement>`

## Workflow: Plan -> Execute

1. Generate plan with `implementation-planner`
2. Post/attach plan to GitHub issue
3. Execute in order with `implementation-executor`
4. Validate via tests and build/bundle checks

## Workflow: Refine Requirements

1. Use `requirement-refiner` on raw request text
2. Produce clear scope, assumptions, acceptance criteria, and open questions
3. Share refined requirement before planning/execution
