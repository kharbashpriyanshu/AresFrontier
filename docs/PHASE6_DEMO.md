# PHASE 6 DEMO & NASA JUDGING GUIDE

## 1. Quick Launch

Open the application in any modern web browser:
- **Local Dev**: `http://localhost:5173`
- **Replay Page**: `http://localhost:5173/replay`
- **Analytics Page**: `http://localhost:5173/mission-analytics`
- **Judging Demo Console**: `http://localhost:5173/demo`

## 2. Four Judge-Ready Demonstration Scenarios

Navigate to `/demo` to run each automated evaluation scenario with a single click:

### Scenario 1: `MARSWALK-001` (Flagship Reconnaissance & Hazard Detour)
- **What to look for**:
  - Scout Rover (ROVER-01) encounters a 21.8° scarp slope along Jezero Crater delta.
  - Dual-sensor corroboration: HazCam (21.8°) + Laser Altimeter confirm rollover risk.
  - Closed-loop pause triggers 3 Pareto route alternatives.
  - Flight Director human authorization approves Valley Detour (+0.3 km, +6 min).
  - SHA-256 tamper-evident audit block generated.
  - Compare Baseline (+0.3 km, Safety: 92) vs What-If Ignore Hazard (Safety: 51, Rollover risk).

### Scenario 2: `COMM-BLACKOUT-001` (Keplerian Orbital Pass & Mesh Telemetry Buffer)
- **What to look for**:
  - MRO orbital pass drops below 15° horizon mask; direct X-band bandwidth drops to 0 kbps.
  - Telemetry queue automatically buffers 4.5 MB bulk science spectral cubes into flash storage.
  - Local surface UHF mesh routes critical telemetry through ROVER-03 RELAY mast.
  - Zero packet loss across the 92-minute orbital blackout window.

### Scenario 3: `SENSOR-HAZARD-001` (Degraded Sensor & Dual-Instrument Fusion)
- **What to look for**:
  - HazCam noise artificially spikes +300% (confidence drops to 0.42).
  - The fusion engine tags the hazard as `MODEL_EVIDENCE` until the Laser Altimeter independently confirms the 22.1° slope, upgrading evidence to `CORROBORATED_CONFIRMED`.
  - Proves the system prevents false alarms while ensuring vehicle safety.

### Scenario 4: `EMERGENCY-001` (Battery Critical Hold & Crew RTB)
- **What to look for**:
  - Simulated battery drop to 14.5% breaches Invariant S1 (20.0% safe return reserve).
  - Immediate vehicle halt commanded; auxiliary heating locked to survival mode.
  - Mission status updates to `DEGRADED` with auditable incident report.

## 3. Replay & Scrubber Walkthrough (`/replay`)

1. Click **Play** to watch the mission unfold in reconstructed digital twin state.
2. Scrub the timeline slider or use **Step Forward** / **Step Backward** to inspect state changes.
3. Click **Decision Lineage** to view the 7-step causal graph for the flagship detour.
4. Click **What-If Analysis** to run an alternate simulation branching off from the hazard event.
5. Click **Provenance** on any metric to view NASA PDS dataset IDs and uncertainty intervals.
