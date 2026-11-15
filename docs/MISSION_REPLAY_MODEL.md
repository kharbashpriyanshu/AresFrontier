# MISSION REPLAY MODEL

## 1. Overview

The Ares Frontier Replay Engine provides deterministic, step-by-step reconstruction of any executed Mars surface mission. Rather than playing back static video or lossy logs, the engine re-evaluates the mission's immutable event ledger into full digital twin states.

## 2. Replay State Model

The replay state is decoupled from the live operational stores and encapsulates:
- `missionId`: Target mission identifier (e.g., `MARSWALK-001`).
- `replayStatus`: Current status (`IDLE`, `PLAYING`, `PAUSED`, `COMPLETED`).
- `currentEventIndex`: Zero-based index into the mission event stream.
- `currentSimTimeSeconds`: Mission elapsed time (MET) in seconds corresponding to current cursor.
- `playbackSpeed`: Execution speed multiplier (0.5x, 1x, 2x, 5x, 10x).
- `agents`: Array of planetary agents reconstructed at the cursor instant (coordinates, battery, heading, status).
- `metrics`: Running mission metrics (distance, elapsed time, energy spent, hazards detected, hazards avoided, science return).
- `currentEvent`: Full event record currently inspected.

## 3. Control Operations

- **Start Replay** (`POST /api/replay/:missionId/start`): Initializes the replay cursor at index 0, loads the immutable event sequence, and emits the initial state.
- **Step Replay** (`POST /api/replay/:missionId/step`):
  - `FORWARD`: Increments the event pointer, applies state delta to agent positions and metrics.
  - `BACKWARD`: Decrements the event pointer, rolling back state to the previous event index.
- **Seek Replay** (`POST /api/replay/:missionId/seek`): Jumps to a specific target. Targets > 60 are evaluated as simulation elapsed seconds (`simulationTime`), while targets <= 60 are evaluated as event index numbers.
- **Reset Replay** (`POST /api/replay/:missionId/reset`): Returns the playback cursor to index 0, resetting state to mission start.

## 4. State Reconstruction & Memory Safety

Replay state reconstruction is strictly read-only:
```typescript
const reconstructedAgents = baseAgents.map(a => ({
  ...a,
  position: { ...a.position },
  telemetry: { ...a.telemetry },
}));
```
This guarantees that scrubbing forward or backward through hours of mission history will never pollute the live agent fleet or disrupt active mission teleoperations.
