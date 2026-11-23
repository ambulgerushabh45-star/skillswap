# SkillSwap — Antigravity Prompt Playbook

How to use: paste ONE prompt at a time into Antigravity (Planning mode). Wait for it to finish, check the result, then ask me (Claude) for the next prompt. Tell me anything that failed and I will adjust the plan.

Copy `PROJECT_STATUS.md` and this file into the project root (`d:\project`) before starting.

---

## PROMPT 0 — Bootstrap and audit (run this first)

```
You are working on the SkillSwap project in this workspace.

MODE: Planning and documentation only. Do NOT change any application source code in this task.

STEP 1 — READ
Read PROJECT_STATUS.md in the project root completely. It is the single source of truth for project status and the agent protocol.

STEP 2 — AUDIT (task P0.1)
Compare PROJECT_STATUS.md against the real codebase. Open and check:
- package.json (exact dependency versions and scripts)
- prisma/schema.prisma (list every model, field, relation, enum and onDelete rule)
- every file under src/app (pages and api routes) and src/components, src/lib
- .env / .env.example (variable names only; never print secret values)
For each API route, record in a table: path, HTTP methods, whether it checks the session, whether it validates input with Zod, and whether it checks resource ownership.
Write the findings to docs/AUDIT.md.
Fix any inaccuracies in PROJECT_STATUS.md sections 2, 3 and 4. Add any newly found problems to section 7 (Known Issues).

STEP 3 — RULES (task P0.2)
Create AGENT_RULES.md containing these rules:
1. Always read PROJECT_STATUS.md before starting any task.
2. Always write a plan to docs/plans/<task-id>-<slug>.md before coding, and follow it.
3. Never modify files outside the scope of the current task.
4. Never delete data, run destructive DB commands, or change prisma/dev.db without asking.
5. Never hardcode secrets; use environment variables and keep .env.example current.
6. Run the quality gates (tsc, lint, build, tests) before marking a task done.
7. After finishing: tick the checkbox, update "Current phase" and "Next task", add a Changelog entry, update Known Issues and docs/DECISIONS.md.
8. Stop after the requested task and report what changed, what was verified, and any risks.
Also save the same rules as a workspace rule in .agent/rules/ so they apply to every session (use the Antigravity workspace-rules format).
Create the folder docs/plans/ and the file docs/DECISIONS.md (empty template with columns: Date, Decision, Options considered, Reason).

STEP 4 — BASELINE (task P0.3)
Run: npx tsc --noEmit, npm run lint, npm run build. Record exact error/warning counts and the build result in the Changelog of PROJECT_STATUS.md. Do not fix anything yet.

STEP 5 — CLOSE OUT
Tick P0.1, P0.2, P0.3 in PROJECT_STATUS.md, set "Current phase" to Phase 1 and "Next task" to P1.1.
Finish with a short report: discrepancies found between the old report and the real code, the baseline numbers, and anything that worries you before Phase 1.
```

---

## Standard prefix for every later prompt (I will include it in each prompt I give you)

```
Follow the protocol in PROJECT_STATUS.md and AGENT_RULES.md: read both first, analyze the relevant code, write the plan to docs/plans/ before coding, execute only the plan, run the quality gates, update PROJECT_STATUS.md, then stop and report.
```

---

## Upcoming prompts (I will write each one in full when you are ready)

| # | Prompt | Tasks |
|---|---|---|
| 1 | Fix lint errors and clear warnings | P1.1, P1.4 |
| 2 | Env/port alignment and Navbar Messages link | P1.2, P1.3 |
| 3 | API security audit and fixes (auth guards, ownership) | P2.1 |
| 4 | Zod validation and standard error format | P2.2, P2.3 |
| 5 | Schema hardening (indexes, enums, constraints) | P2.4 |
| 6 | Matching engine refactor and tests | P2.5 |
| 7 | Pagination, rate limiting, review rules | P2.6–P2.8 |
| 8 | Public profile page | P3.1 |
| 9 | Geocoding and distance | P3.2, P3.3 |
| 10 | Avatar upload and event management | P3.4, P3.5 |
| 11 | Chat unread counts and notifications | P4.x |
| 12 | PostgreSQL migration | P5.x |
| 13 | Security pass, tests, CI | P6.x |
| 14 | Deployment, email, monitoring, docs | P7.x |
