# Mission Event Model — Cryptographic Event Sourcing

## 1. Immutable Event Sourcing Ledger
The mission state is modeled as an append-only stream of cryptographically chained events managed by `MissionEventStore`.

### 1.1 Cryptographic Chain Integrity
Each event block contains:
- `eventId`: Unique identifier (`mevt-<timestamp>-<nonce>`).
- `timestamp`: UTC ISO timestamp.
- `missionId`: Active mission identifier (`MARSWALK-001`).
- `actor`: Initiator ID (agent callsign, controller ID).
- `eventType`: Event category (`TELEMETRY_LOGGED`, `HAZARD_DETECTED`, `COMMUNICATION_LOST`, `REPLAN_PROPOSED`, `COMMAND_REJECTED`, etc.).
- `previousEventHash`: SHA-256 hash of the preceding block (or 64-zero genesis hash).
- `eventHash`: SHA-256 hash of the entire concatenated payload:
$$\text{eventHash} = H(\text{previousEventHash} \parallel \text{eventId} \parallel \text{timestamp} \parallel \text{actor} \parallel \text{eventType} \parallel \text{payload})$$

### 1.2 Verification API
The ledger provides an automated verification method:
`GET /api/operations/events/verify` returns whether any historical block has been altered, deleted, or inserted out of order.
