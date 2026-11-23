# Task Plans (`docs/plans/`)

Before beginning implementation on any task, create a task plan following the naming convention:
`docs/plans/<task-id>-<slug>.md` (e.g., `docs/plans/P1.1-fix-lint-errors.md`).

## Plan Template Structure
1. **Task Goal & Context**: What problem is being solved and why?
2. **Files to Touch**: Explicit list of files that will be added, edited, or removed.
3. **Step-by-Step Implementation**: Chronological instructions for execution.
4. **Security & Architecture Considerations**: Impact on auth, data integrity, or performance.
5. **Verification Plan**: Exact commands (`tsc`, `lint`, `build`) and manual UI verification steps.
6. **Risks & Rollback Plan**: Potential breaking changes and recovery path.
