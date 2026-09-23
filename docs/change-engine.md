# Change Engine

**Status:** IMPLEMENTED

Location: `projectdashboardv1/src/lib/adaptive-core/change-engine/`

## Capabilities

| Capability | Status |
|---|---|
| parse | IMPLEMENTED |
| validate | IMPLEMENTED |
| preview | IMPLEMENTED |
| apply | IMPLEMENTED (CONFIG + UI_CONFIG only) |
| revert / undo | IMPLEMENTED |
| history | IMPLEMENTED |

## ChangeSpec

Supported types: `CONFIG_CHANGE`, `UI_CONFIG_CHANGE`, `CODE_CHANGE`, `CRITICAL_CHANGE`.

Operations (intentionally limited): `set`, `insert`, `remove`, `move`, `enable`, `disable`.

No arbitrary code execution. Sensitive paths force CRITICAL and are not auto-applied.

## Apply targets

- `surface.now` / `ui.lab` → `settings.adaptive`
- `routine.morning` → `settings.morningRitual`
- `routine.evening` → `settings.eveningGate`

CODE_CHANGE / CRITICAL_CHANGE are rejected by the apply path and routed to the Development Engine / elevated controls.
