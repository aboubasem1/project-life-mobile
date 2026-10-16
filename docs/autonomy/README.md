# JO Autonomy Engine — Phase 1

Status: proposal, not deployed.

## Objective
Continuously improve LifeOS without unattended production changes.

## Architecture
- GitHub Actions schedule triggers read-only repository audit.
- Agent runtime (future separate isolated service) reads an allowlisted task queue.
- Developer agent produces a feature branch and draft pull request.
- Independent QA verifies typecheck, tests, build, security and diff scope.
- Human approves production merges and deployments.
- OVH hosts orchestration only after resource and credential review.

## Hard limits
- No direct write to main, production database, backups or R2.
- No modification of policy, secrets, auth, billing, health decisions, medication or infrastructure without human approval.
- No access to production credentials in coding-agent sandboxes.
- No automatic merge or deployment in phase 1.
- Run concurrency = 1, hard timeouts, explicit monthly spending cap, kill switch.
- Treat issue bodies, logs and external content as untrusted input.
- Record immutable audit entries for proposals, tool calls and results.

## Phases
1. Repository audit + proposal workflow (read-only).
2. Isolated cloud coding agent + draft PR.
3. QA gates + staging preview.
4. Explicitly allowlisted low-risk auto-merge, only after demonstrated reliability.

## Acceptance criteria
- Scheduled audit runs without modifying production.
- Audit reports failing tests, missing checks and actionable issues.
- Disabling workflow stops further scheduled activity.
- No token, user data or production secrets appear in artifacts.
