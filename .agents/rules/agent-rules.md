<!-- Antigravity Workspace Rule: SkillSwap Agent Rules -->

# SkillSwap Agent Rules

Apply these rules to every session working on the SkillSwap project:

1. **Always read `PROJECT_STATUS.md` before starting any task.**
   It is the single source of truth for current progress, active phase, and technical decisions.
2. **Always write a plan to `docs/plans/<task-id>-<slug>.md` before coding, and follow it.**
   Every task requires an explicit plan detailing the goal, files to touch (`server/`, `client/`, `prisma/`, `scripts/`, `docs/`), steps, risks, and verification. No code before the plan exists.
3. **Never modify files outside the scope of the current task.**
   Keep changes tightly focused on the assigned task ID. Avoid unrelated refactoring.
4. **Never delete data, run destructive DB commands, or change `prisma/dev.db` without asking.**
   Preserve existing user data, seed records, avatar files, and relational schemas.
   - For MongoDB: Only touch the main database named in `MONGODB_URL` (`skillswap`) and ephemeral scratch databases named `<main>_test_<timestamp>` created for testing. Drop a database ONLY if its name contains `_test_` (strictly guarded in code). Never write test data into the main database. Never touch external databases on the Mongo server (e.g. `zipi`, `smart_city`).
   - `prisma/dev.db` is the READ-ONLY source archive. Never modify, delete, or reset it.
5. **Never hardcode secrets; use environment variables and keep `server/.env.example` (and `.env.example`) current.**
   All credentials must use `process.env`. The connection string lives ONLY in `server/.env` (and `.env`) as `MONGODB_URL`. Never print it, log it, echo it, put it in a report or commit it. In logs show at most the database name (`DB_NAME`). Keep `server/.env.example` updated with safe placeholders.
6. **Run the quality gates (`lint`, `test`, `build`, check scripts) before marking a task done.**
   All code is plain JavaScript (`.js`, `.mjs`, and `.jsx` — zero TypeScript). All gates must pass before a task is considered complete:
   * `npm run lint` -> 0 errors (server + client)
   * `npm test` -> passes (server + client Vitest suites)
   * `npm run build` -> exit code 0 (`client/dist/`)
   * Relevant real-server check scripts in `server/scripts/` (`npm run check`, `foundation-check.mjs`, `prod-smoke-check.mjs`) and `client/scripts/` (`smoke-check.mjs`, `m4a-check.mjs`, `m4b-check.mjs`) -> all pass
7. **After finishing: update project tracking documentation.**
   * Tick the checkbox in `PROJECT_STATUS.md`.
   * Update "Current phase" and "Next task".
   * Add a detailed entry in the Changelog.
   * Update Known Issues and `docs/DECISIONS.md`.
8. **Stop after the requested task and report.**
   Report what changed, what was verified, and any risks. Do not start the next task automatically.
