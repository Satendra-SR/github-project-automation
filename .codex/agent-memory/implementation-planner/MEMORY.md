# Implementation Planner Agent Memory

## Project Structure
- Action entrypoint: `src/index.ts`
- Rule orchestration: `src/rules/router.ts` and `src/rules/types.ts`
- GitHub integrations: `src/github/` (`issue.ts`, `pr.ts`, `projectsV2.ts`, `targets.ts`, `retry.ts`)
- Config loading: `src/config.ts`
- Tests: `tests/*.test.ts`

## Key Behavior Areas
- Parse strict `Targets:` line from PR body
- Route behavior by pull request event/action
- Ensure issue membership/status in Projects V2
- Add label/assignment/audit comments only when required by rules

## Validation Pattern
- Unit tests: `npm test`
- TypeScript compile check: `npm run build`
- Bundle update when `src/` behavior changes: `npm run bundle` and verify `dist/index.js`

## Repo / GitHub Context
- This is a reusable action consumed by other repositories.
- Changes should preserve configuration-driven behavior and cross-repo safety checks.
