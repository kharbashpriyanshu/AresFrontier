# Phase 5 Scenarios — Deterministic Planetary Testbeds

## 1. Flagship Operations Scenarios

### Scenario 1: `MARSWALK-001` (Baseline Traverse & Reconnaissance)
- **Primary Objective**: Crew Commander Alex Vance conducts extravehicular activity (EVA) exploration from Octavia E. Butler landing site toward Kodiak Delta.
- **Agent Roles**:
  - `ROVER-01 SCOUT`: Drives 1.2 km ahead scanning for escarpments.
  - `ROVER-02 SCIENCE`: Samples delta silt deposits with Raman spectroscopy.
  - `ROVER-03 RELAY`: Anchors comm link from 5.0m elevated mast.
  - `ASTRONAUT-01`: Human explorer in xEMU planetary pressure suit.

### Scenario 2: `COMM-BLACKOUT-001` (Orbital Blackout & Buffer Recovery)
- **Trigger**: MRO orbiter elevation drops below 15° mask; pass terminates.
- **Behavior**:
  - Telemetry transmission throttles to local UHF relay.
  - Non-essential bulk science packets (4.5 MB spectral cubes) transition to `BUFFERED` state.
  - Critical telemetry packets queue at head of the FIFO priority queue.
  - Next orbital pass restores high-speed contact; critical packets burst-transmit first.

### Scenario 3: `SECURITY-001` (Unauthorized Command Injection & Anti-Replay)
- **Trigger**: Unauthenticated user or `VIEWER` attempts to issue `EMERGENCY_STOP` or replay a spent nonce.
- **Behavior**:
  - Server denies request (`403 Forbidden`).
  - Command is discarded without mutating agent state.
  - Security violation is recorded into the persistent SHA-256 cryptographic audit chain.

### Scenario 4: `EMERGENCY-001` (Critical Rover Power Depletion)
- **Trigger**: Scout rover battery falls below 20% safe return reserve (S1 violation).
- **Behavior**:
  - Autonomous decision cycle commands emergency stop.
  - Rover pulls off traverse path to preserve astronaut walking corridor.
  - Flight Director alerted with structured Copilot recommendation.
