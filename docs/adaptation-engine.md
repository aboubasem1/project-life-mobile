# Adaptation Engine

**Status:** IMPLEMENTED (deterministic, suggest-only)

Location: `projectdashboardv1/src/lib/adaptive-core/adaptation/`

## Mode

OBSERVE → SUGGEST → APPROVE (never auto-apply by default).

## Patterns detected

- Frequently skipped routine steps
- Abandoned gates
- Repeated deferrals
- Repeatedly rejected suggestions

Suggestions may include a ready `ChangeSpec` for user approval.

## Autonomy

Default L1. L3 auto-apply is not enabled in this phase.
