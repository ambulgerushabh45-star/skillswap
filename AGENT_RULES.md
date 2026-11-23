# SkillSwap — Agent Rules (`AGENT_RULES.md`)

> **Mandatory protocol for all AI coding agents working on the SkillSwap codebase.**  
> These rules must be strictly adhered to in every session without exception.

---

## 1. Core Operating Rules

1. **Always read `PROJECT_STATUS.md` before starting any task.**  
   It is the single source of truth for current progress, active phase, and technical decisions.
2. **Always write a plan to `docs/plans/<task-id>-<slug>.md` before coding, and follow it.**  
   Every task requires an explicit plan detailing the goal, files to touch, step-by-step implementation, risks, and verification steps. No code may be written before this plan exists.
3. **Never modify files outside the scope of the current task.**  
   Keep changes tightly focused on the assigned task ID. Respect boundaries across `server/` (Express API & SPA server), `client/` (React Vite SPA), and `prisma/` (schema & database). Avoid unrelated refactoring or scope creep.
4. **Never delete data, run destructive DB commands, or change `prisma/dev.db` without asking.**  
   Preserve existing user data, seed records, avatar files, and relational schemas.
   - For MongoDB: Only touch the main database named in `MONGODB_URL` (`skillswap`) and ephemeral scratch databases named `<main>_test_<timestamp>` created for testing. Drop a database ONLY if its name contains `_test_` (strictly guarded in code). Never write test data into the main database. Never touch external databases on the Mongo server (e.g. `zipi`, `smart_city`).
   - `prisma/dev.db` is the READ-ONLY source archive. Never modify, delete, or reset it.
5. **Never hardcode secrets; use environment variables and keep `server/.env.example` (and `.env.example`) current.**  
   All credentials, JWT secrets, database URIs, and API keys must be loaded via `process.env`. The connection string lives ONLY in `server/.env` (and `.env`) as `MONGODB_URL`. Never print it, log it, echo it, put it in a report or commit it. In logs show at most the database name (`DB_NAME`). Whenever a new environment variable is introduced, document it immediately in `server/.env.example` with a safe placeholder.
6. **Run the quality gates (`lint`, `test`, `build`, check scripts) before marking a task done.**  
   All code is plain JavaScript (ESM `.js`, `.mjs`, and JSX `.jsx` — zero TypeScript). All gates must pass before a task is considered complete:
   * `npm run lint` -> 0 errors, 0 warnings across `server/` and `client/`
   * `npm test` -> passes (`server` Vitest suite + `client` Vitest suite)
   * `npm run build` -> exit code 0 (Vite production bundle in `client/dist/`)
   * Relevant real-server check scripts in `server/scripts/` (`npm run check`, `foundation-check.mjs`, `prod-smoke-check.mjs`) and `client/scripts/` (`smoke-check.mjs`, `m4a-check.mjs`, `m4b-check.mjs`) -> all pass with 0 unintended DB mutations
7. **After finishing: update project tracking documentation.**  
   * Tick the completed task checkbox in `PROJECT_STATUS.md`.
   * Update **"Current phase"** and **"Next task"**.
   * Add a detailed entry in the **Changelog**.
   * Update **Known Issues** if new issues were discovered or resolved.
   * Record architectural choices in `docs/DECISIONS.md`.
8. **Stop after the requested task and report.**  
   Report what changed, what was verified, and any risks. Do not automatically proceed to the next roadmap task without user instruction.

---

## 2. Planning Mode Protocol

* When in Planning mode, **do not modify application source code** (`server/src/*`, `client/src/*`). Only documentation, plans, and workspace rules may be authored.
* Plans in `docs/plans/` should follow the structure:
  1. Task Goal & Context
  2. Files to Touch (within `server/`, `client/`, `prisma/`, `scripts/`, `docs/`)
  3. Step-by-Step Implementation Steps
  4. Security & Architecture Considerations
  5. Verification Plan (Quality Gates & Manual Checks)
  6. Potential Risks & Rollback Strategy
