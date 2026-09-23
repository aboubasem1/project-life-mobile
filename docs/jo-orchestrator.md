# Jo Orchestrator

**Status:** IMPLEMENTED (deterministic Phase-1 routing; provider-ready)

Jo distinguishes:

| Route | Meaning | Status |
|---|---|---|
| CAPTURE | Log data | IMPLEMENTED (existing decision engine) |
| QUERY | Ask about history | PARTIAL (classified; answers still via existing surfaces) |
| CHANGE | System change intent | IMPLEMENTED |
| SUGGEST | Ask for improvement ideas | PARTIAL (classified + adaptation suggestions) |
| EXPERIMENT | Temporary variant | IMPLEMENTED (engine; Jo can open experiment hypothesis) |

## System change flow

Natural language → intent → context → ChangeSpec → validate → risk → preview UI → approve → Change Engine apply → events → history → undo.

Universal Capture / Jo FAB is the primary input. Model output never mutates the DB directly.

## How to use

1. Open **Jo AI** (capture).
2. Say e.g. `Energy only belongs in Morning and Evening Gate. Remove it from NOW.`
3. Review the compact **LifeOS Update** preview.
4. Tap **Übernehmen**, then **Rückgängig** if needed.

Developer debug: `?adaptiveDev=1` shows ChangeSpec JSON in the preview sheet.
