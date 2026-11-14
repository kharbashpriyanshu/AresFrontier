# Persistence Model — State Recovery & Checkpoints

## 1. Multi-Tier Persistence Strategy
Martian Map ensures persistent operations survive server restarts through three distinct storage layers:
1. **Runtime Snapshot (`backend/data/mission_state.json`)**:
   - Current simulation MET (Mission Elapsed Time).
   - Agent telemetry and operational states.
   - Active replan proposals and science queue.
   - Saved automatically after every state transition.
2. **Event Ledger (`backend/data/mission_events.json`)**:
   - Immutable, cryptographically chained SHA-256 historical log of all operations events.
3. **Named Checkpoints (`backend/data/checkpoints/checkpoint-<id>.json`)**:
   - Immutable operational baselines created via `POST /api/operations/state/checkpoint`.
   - Restored via `POST /api/operations/state/restore`.

## 2. Recovery Protocol
Upon startup, `MissionPersistenceService.initialize()` automatically checks for existing persistent state and recovers in-memory stores seamlessly without administrative intervention.
