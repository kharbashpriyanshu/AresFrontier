# PHASE 7 SCIENTIFIC CLAIM AUDIT & PROVENANCE CLASSIFICATION

## 1. Overview & Policy

In accordance with strict scientific truthfulness guidelines for the NASA Space Apps Challenge, this document audits every significant capability, telemetry, and numerical claim across the Martian Map repository.

No simulated value, physics model output, or benchmark dataset may be claimed as "LIVE" telemetry from active Mars rovers. Every claim is categorized under one of eight formal classifications:
1. **`VERIFIED`**: Directly executed and confirmed by automated tests and cryptographic proof.
2. **`PARTIALLY VERIFIED`**: Validated under benchmark or offline assumptions with documented constraints.
3. **`SIMULATED`**: Generated via deterministic mathematical/physics simulations.
4. **`BENCHMARK`**: Real historical NASA/USGS mission datasets used as ground truth.
5. **`DERIVED`**: Mathematically computed from benchmark or physical models.
6. **`HEURISTIC`**: Flight rule conventions, scoring weights, or expert operational thresholds.
7. **`DEMO-INJECTED`**: Scenarios pre-staged for reproducible evaluation.
8. **`UNVERIFIED`**: Hypotheses not backed by implementation (prohibited).

---

## 2. Comprehensive Master Claim Audit Table

| # | System Claim / Metric | Documented Source | Classification | Verified? | Verification / Action Taken |
|---|---|---|---|---|---|
| 1 | **IAU / IAG Mars Areoid Datum ($R_{\text{eq}} = 3396.19\text{ km}$, $R = 3389.5\text{ km}$)** | `backend/src/utils/marsCoordinates.ts` | `BENCHMARK` | **YES** | Verified against IAU/IAG 2000 cartographic standards in `marsCoordinates.test.ts`. |
| 2 | **MOLA MEGDR Topography (128 px/deg elevation)** | `backend/src/services/nasa/adapters/molaProvider.ts` | `BENCHMARK` | **YES** | Benchmark data sampled at ~463m resolution with 1m precision. |
| 3 | **Adapted Tobler Martian Metabolic Walk Pace** | `backend/src/services/routes/elevationService.ts` | `DERIVED` | **YES** | Calibrated to Mars $0.38g$ surface gravity in `missionEngine.test.ts`. |
| 4 | **NASA 30-Minute Return Safety Margin** | `backend/src/services/routes/elevationService.ts` | `HEURISTIC` | **YES** | Enforced as Invariant S3 in `safetyInvariants.test.ts`. |
| 5 | **20.0% Rover Battery Safe Return Reserve** | `backend/src/services/agents/agentStateStore.ts` | `HEURISTIC` | **YES** | Enforced as Invariant S1 in `safetyInvariants.test.ts`. |
| 6 | **Maximum Safe Rover Incline ($20.0^\circ$)** | `backend/src/services/hazard/hazardEngine.ts` | `HEURISTIC` | **YES** | Triggers Invariant S2 vehicle halt in `safetyValidationPhase6.test.ts`. |
| 7 | **MRO-Relay 112m Circular Orbit & 14m Pass** | `backend/src/services/comms/orbitalVisibilityEngine.ts` | `SIMULATED` | **YES** | Deterministic Keplerian orbit approximation validated in `orbitalPass.test.ts`. |
| 8 | **Surface UHF Packet Buffer during Blackout** | `backend/src/services/comms/communicationQueueService.ts` | `SIMULATED` | **YES** | Priority queue buffers science packets, validated in `phase5EndToEndScenarios.test.ts`. |
| 9 | **HazCam Optical Noise Perturbation ($\pm 1.2^\circ$)** | `backend/src/services/sensors/sensorNoiseModel.ts` | `SIMULATED` | **YES** | Box-Muller Gaussian noise model validated in `sensorObservations.test.ts`. |
| 10 | **Dual-Sensor Hazard Corroboration** | `backend/src/services/hazard/observationHazardFusion.ts` | `DERIVED` | **YES** | Fuses HazCam + Laser Altimeter into `CORROBORATED_CONFIRMED` in `hazardFusion.test.ts`. |
| 11 | **Deterministic Replay without Live Mutation** | `backend/src/services/replay/replayStateManager.ts` | `VERIFIED` | **YES** | Decoupled digital twin clone validated in `missionReplay.test.ts`. |
| 12 | **What-If Simulation Isolation** | `backend/src/services/simulation/whatIfSimulationEngine.ts`| `VERIFIED` | **YES** | Baseline state and event store proven unmodified in `whatIfSimulation.test.ts`. |
| 13 | **Seeded 100-Run Monte Carlo (Seed `20261107`)** | `backend/src/services/simulation/monteCarloEngine.ts` | `SIMULATED` | **YES** | Deterministic LCG reproducibility confirmed in `whatIfSimulation.test.ts`. |
| 14 | **Command Replay Defense & 300s TTL (S8)** | `backend/src/services/security/commandSecurityService.ts` | `VERIFIED` | **YES** | Duplicate nonce/commandId rejected across simulated server restart in `securityPhase5.test.ts`. |
| 15 | **Persistent SHA-256 Audit Hash Chain** | `backend/src/services/security/auditChainService.ts` | `VERIFIED` | **YES** | Tamper-evident hash chaining validated in `securityPhase3.test.ts`. |
| 16 | **Transparent Mission Health Score (89/100)** | `backend/src/services/validation/missionValidationEngine.ts`| `DERIVED` | **YES** | Decomposed into 7 weighted components in `safetyValidationPhase6.test.ts`. |
| 17 | **Multi-Agent Roster Telemetry** | `backend/src/services/agents/agentRegistry.ts` | `SIMULATED` | **YES** | 5 coordinated agents operating under deterministic sim clock. |
| 18 | **Flagship Recon Scenario (`MARSWALK-001`)** | `backend/src/controllers/operationsController.ts` | `DEMO-INJECTED` | **YES** | 1-click execution testbed with human flight director detour approval. |

---

## 3. Rectifications & Prohibitions

1. **Purged "LIVE TELEMETRY" Claims**:
   - Replaced copilot phrase `"Multi-agent live telemetry feed"` with `"Multi-agent simulated telemetry feed (deterministic seed)"`.
   - Verified that no simulated sensor value in the UI or backend is falsely tagged as `LIVE`.
2. **Explicit Statistical Labeling**:
   - Upgraded Monte Carlo display from `MISSION SUCCESS PROBABILITY` to `SIMULATED MISSION SUCCESS PROBABILITY (100 SEEDED RUNS, SEED: 20261107)`.
3. **Model Uncertainty vs Confidence Intervals**:
   - Optical sensor deviations are strictly documented as `MODEL UNCERTAINTY BOUNDS` rather than empirical planetary observations.
