# Persistence Model — State Recovery & Checkpoints

## 1. Multi-Tier Persistence Strategy
Ares Frontier ensures persistent operations survive server restarts through cohesive storage layers:
1. **Planned Routes & Missions (`backend/data/routes.json`, `backend/data/missions.json`)**:
   - Persisted via `MissionRepository` using atomic write patterns.
   - Survives backend restarts and cold restarts.
   - Concurrency-safe via promise serialization lock.
   - Corrupted file recovery: backs up corrupted file to `.corrupted.<timestamp>` and recovers defaults.
2. **Canonical Unified Mission State (`backend/data/unified_mission_state.json`)**:
   - 18 modular domains validated by Zod schemas (`UnifiedMissionStateSchema`).
   - Coordinated via `MissionStateCoordinator`.
   - Domain-level updates (`updateDomain()`) with audit logging.
3. **Runtime Operational Snapshot (`backend/data/mission_state.json`)**:
   - Current simulation MET (Mission Elapsed Time).
   - Agent telemetry and operational states.
   - Active replan proposals and collaborative science queue.
   - Saved automatically after every state transition.
4. **Event Ledger (`backend/data/mission_events.json`)**:
   - Immutable, cryptographically chained SHA-256 historical log of all operations events.
5. **Named Checkpoints (`backend/data/checkpoints/checkpoint-<id>.json`)**:
   - Immutable operational baselines created via `POST /api/operations/state/checkpoint`.
   - Restored via `POST /api/operations/state/restore`.

## 2. Recovery Protocol
Upon startup, `MissionPersistenceService.initialize()` and `MissionStateCoordinator.initialize()` automatically check for existing persistent state and recover in-memory stores seamlessly without administrative intervention. If disk corruption is detected, files are safely backed up to `.corrupted.<timestamp>` and the system recovers defaults without crashing.
