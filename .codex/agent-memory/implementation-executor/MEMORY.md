# Implementation Executor Agent Memory

## Execution Expectations
- Implement from approved plan tasks in dependency order.
- Keep scope tightly aligned to plan unless user requests expansion.
- Prefer incremental, verifiable changes.

## Validation Pattern
- Run targeted tests first for changed modules.
- Run broader checks when changes cross module boundaries.
- Report exactly what was run and what could not be run.
- If new tests are added, run tests immediately and fix failures before continuing.
- Preferred command sequence:
  - `npm test`
  - `npm run build`
  - `npm run bundle` when `src/` behavior changes

## GitHub Action Notes
- Preserve strict targets parsing and repo boundary validation.
- Keep rule routing deterministic by PR event/action.
- Maintain no-spam behavior for comments and status updates.

## Completion Checklist
- Behavior implemented per approved plan
- Tests added/updated
- Relevant checks executed
- File-level summary prepared
- Risks/TODOs documented
