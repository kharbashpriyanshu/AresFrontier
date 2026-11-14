# PHASE 6 ARCHITECTURE: MISSION VALIDATION, DIGITAL TWIN & DETERMINISTIC REPLAY

## 1. System Overview

Martian Map Phase 6 evolves the multi-agent planetary operations simulator into a **Reproducible Planetary Mission Digital Twin**. The architecture provides mission recording, deterministic step replay, what-if decision branching with multi-dimensional delta comparison, seeded Monte Carlo uncertainty analysis, a failure injection testing harness, automated S1–S8 safety invariant verification, a transparent health model, decision explanation lineage, and deep data provenance.

```
+-----------------------------------------------------------------------------------+
|                            MISSION OPERATIONS RUNTIME                             |
|                                                                                   |
|  [Agent Fleet] <---> [Multi-Agent Sim Engine] <---> [Sensor Fusion / Hazards]     |
|         |                        |                               |                |
|         v                        v                               v                |
|  +-----------------------------------------------------------------------------+  |
|  |                 IMMUTABLE CRYPTOGRAPHIC MISSION EVENT LEDGER                |  |
|  |        (Deterministic IDs, Sim MET, Actor, Payload, Audit Hash Chain)       |  |
|  +-----------------------------------------------------------------------------+  |
|         |                                        |                                |
+---------|----------------------------------------|--------------------------------+
          | Read-only trace snapshot               | Checkpoints (3-phase atomic)
          v                                        v
+-----------------------+                +--------------------+
|  MISSION REPLAY       |                | WHAT-IF SIMULATION |
|  ENGINE               |                | ENGINE             |
|  - Play / Pause       |                | - Clone Sandbox    |
|  - Step Fwd / Back    |                | - Mutate Decision  |
|  - Seek by Sec / Idx  |                | - Simulate Trajectory|
|  - Decoupled State    |                | - Delta Comparator |
+-----------------------+                +--------------------+
          |                                        |
          +-------------------+--------------------+
                              |
                              v
        +----------------------------------------------+
        | SAFETY VALIDATION & REPRODUCIBILITY HARNESS  |
        | - S1 to S8 Invariant Validation Engine       |
        | - 100-Run Seeded Monte Carlo Engine          |
        | - Failure Injection Harness                  |
        | - 7-Step Decision Explanation Lineage Graph  |
        | - Deep Data Provenance Registry              |
        +----------------------------------------------+
                              |
                              v
        +----------------------------------------------+
        | OPERATOR & JUDGING INTERFACES                |
        | - /replay: Timeline Scrubber & State View    |
        | - /mission-analytics: Monte Carlo & S1-S8    |
        | - /demo: Interactive 4-Scenario Evaluation   |
        +----------------------------------------------+
```

## 2. Digital Twin Architectural Principles

1. **State Isolation & Clean Decoupling**:
   - The replay engine reconstructs a cloned state (`ReplayState`) without mutating live `AgentRegistry` or operational stores.
   - What-If simulations clone state at the decision fork time into an isolated sandbox, ensuring live mission telemetry remains untouched.

2. **Deterministic Reproducibility**:
   - Every event, replan, and message ID is deterministically derived from `(seed, missionId, simulationTime, agentId, entityType, sequenceNumber)`.
   - Monte Carlo iterations use a seeded linear congruential generator (LCG) with Box-Muller transforms to guarantee identical distributions across runs.

3. **Truth in Telemetry & Provenance**:
   - Explicit distinction between `MODEL_EVIDENCE`, `SENSOR_EVIDENCE`, and dual-instrument `CORROBORATED_CONFIRMED`.
   - Data labeled truthfully (`BENCHMARK`, `SIMULATED / MONTE CARLO`, `MOLA MEGDR 128 px/deg`). Synthetic data is never falsely claimed as live planetary downlinks.

4. **Cryptographic Protection & Replay Attack Defense**:
   - S8 security invariants enforce command TTL bounds (`MAX_COMMAND_TTL_MS = 300000`).
   - Command nonce and timestamp deduplication persist to disk via 3-phase atomic writes (`.tmp` -> `fsync` -> `rename`), surviving backend restarts.
