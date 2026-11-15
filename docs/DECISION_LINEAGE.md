# DECISION EXPLANATION LINEAGE & REASONING GRAPH

## 1. Overview

Autonomous planetary systems must never operate as "black boxes." When Ares Frontier recommends a detour, halts a rover, or reprioritizes an EVA route, it generates a complete 7-step decision lineage graph showing the full causal chain from raw sensor observation to human authorization and execution.

## 2. The 7-Step Decision Explanation Lineage

```
[1. Sensor Observation]
      | (HazCam detects 21.8° slope; Laser Altimeter confirms 22.1°)
      v
[2. Hazard Classification]
      | (Fused Hazard: Steep Scarp Slope, Confidence: 0.94, CORROBORATED_CONFIRMED)
      v
[3. Safety Invariant Check]
      | (Invariant S2: Rover Slope Limit = 20.0°. Exceeded by 1.8°. State: VIOLATION_PREVENTED)
      v
[4. Pareto Route Optimization]
      | (Generates 3 candidates: Direct steep, Valley detour, Ridge traverse)
      v
[5. Copilot Synthesis]
      | (Recommends Candidate A: Valley Corridor. Trade-off: +0.3 km, +6 min, Safety: +41 pts)
      v
[6. Human Authorization]
      | (Flight Director Alex Vance signs approval with Role: MISSION_COMMAND)
      v
[7. Autonomous Execution & Audit]
      | (Detour waypoints uploaded to ROVER-01; SHA-256 block locked to audit ledger)
```

## 3. Lineage Step Specifications

1. **Sensor Observation**:
   - Primary: HazCam Stereo Disparity ($21.8^\circ \pm 1.1^\circ$).
   - Corroborating: Mars Orbiter Laser Altimeter (MOLA MEGDR 128 px/deg) elevation gradient ($22.1^\circ \pm 0.8^\circ$).
   - Classification: `CORROBORATED_CONFIRMED`.

2. **Hazard Classification**:
   - Category: `STEEP_SCARP_SLOPE`.
   - Risk: Rollover hazard, loose regolith wheel trenching risk.

3. **Safety Invariant Check (S2)**:
   - Threshold: Maximum permissible vehicle pitch/roll angle is $20.0^\circ$.
   - Outcome: Immediate rover traverse halt to prevent rollover.

4. **Candidate Generation**:
   - Evaluates multi-objective Pareto front balancing distance, battery reserve, science yield, and safety score.

5. **Copilot Synthesis**:
   - Explains the quantitative trade-off in human-understandable mission terms.

6. **Human Authorization Gate**:
   - Enforces human-in-the-loop Flight Director gate for non-nominal route alterations.

7. **Cryptographic Audit Execution**:
   - Writes the signed transition block into the SHA-256 audit chain.
