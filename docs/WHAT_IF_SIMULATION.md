# WHAT-IF DECISION BRANCHING & COMPARATIVE ANALYSIS

## 1. Overview

The What-If Simulation Engine allows planetary mission planners, flight directors, and evaluation judges to branch off from any point in a mission timeline, alter a critical operational decision, and deterministically simulate the alternate outcome.

## 2. Forking Architecture

When a What-If scenario is triggered (`POST /api/simulation/what-if`):
1. **Fork Snapshot**: The state at the fork time (`forkSimTimeMinutes`) is cloned from the baseline mission.
2. **Decision Override**: The chosen decision branch is injected (e.g., `IGNORE_HAZARD`, `PROCEED_DIRECT_STEEP`, `CONSERVATIVE_STOP`, `DETOUR_VALLEY`).
3. **Simulation Propagation**: The simulation executes the alternative path deterministically, modeling wheel slip, battery drain rates, comm connectivity, and rollover risk.
4. **Structured Delta Comparison**: Both baseline and branched missions are compared across 8 quantitative dimensions.

## 3. Comparison Dimensions

| Dimension | Description | Typical Delta (Ignore vs Detour) |
|---|---|---|
| **Traverse Distance** | Total kilometers covered | -1.5 km (Direct path shorter) |
| **Duration** | Mission elapsed time in minutes | -6 minutes (No detour delay) |
| **Battery Reserve** | Final battery state-of-charge (%) | -13% (High torque scree climbing) |
| **Science Yield** | Scientific score collected | -30% (Instruments disabled in hazard) |
| **Comms Reliability** | Effective communication score | -5% |
| **Safety Score** | Quantitative composite safety (0-100) | -41 points (Severe degradation) |
| **Hazards Avoided** | Confirmed hazards safely bypassed | 0 vs 1 |
| **Hazards Encountered** | Hazardous zones directly entered | 1 vs 0 |

## 4. Key Takeaway: The Value of Human Authorization

The What-If Engine explicitly illustrates why human flight directors approved the detour:
- **Baseline Mission (Approved Detour)**: Added +0.3 km and +6 minutes, but maintained a **92/100 safety score** and protected the \$2.5B rover fleet.
- **What-If Mission (Ignored Hazard)**: Saved 6 minutes, but incurred a **51/100 degraded safety score** with a 72% probability of wheel entrapment in 24.5° scree scarp.
