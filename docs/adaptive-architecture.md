# Adaptive Architecture

**Status:** IMPLEMENTED (Phase 1 foundation + Adaptive Foundation core)

## Layering

```
UI (Heute, Gates, Lab, Capture, Change Preview)
        ↓
Jo Orchestrator (CAPTURE | QUERY | CHANGE | SUGGEST | EXPERIMENT)
        ↓
Adaptation Engine (observe → suggest; L1 default)
        ↓
Life Model + Change Engine (validate → preview → apply → history → undo)
        ↓
Event Store (behavioral adaptive events)
        ↓
Connectors / existing data (settings, morningRitual, dailyEvents, LifeOS store)
```

AI models are **not** the source of truth. `AdaptiveLifeConfig`, ritual configs, and the Change Engine apply path are.

## Key modules

| Module | Path | Status |
|---|---|---|
| Feature flags | `src/lib/adaptive-core/flags.ts` | IMPLEMENTED |
| Life Model / config | `src/lib/adaptive-core/life-model.ts` | IMPLEMENTED |
| NOW dedupe | `src/lib/adaptive-core/now-dedupe.ts` | IMPLEMENTED |
| Change Engine | `src/lib/adaptive-core/change-engine/` | IMPLEMENTED |
| Jo orchestrator | `src/lib/adaptive-core/jo/` | IMPLEMENTED |
| Events | `src/lib/adaptive-core/events/` | IMPLEMENTED |
| Adaptation | `src/lib/adaptive-core/adaptation/` | IMPLEMENTED |
| Experiments | `src/lib/adaptive-core/experiments/` | IMPLEMENTED |
| Development Engine | `src/lib/adaptive-core/development/` | IMPLEMENTED (interface + local provider) |
| Change Preview UI | `src/components/ChangePreviewSheet.tsx` | IMPLEMENTED |

## Autonomy

Default **L1 SUGGEST**. L3 unrestricted auto-apply is not enabled.

## Persistence

Adaptive config lives in `life-os-v1-settings.adaptive` (synced with settings).
Change history: `life-os-v1-change-history`.
Adaptive events: `life-os-v1-adaptive-events`.
Experiments: `life-os-v1-experiments`.
