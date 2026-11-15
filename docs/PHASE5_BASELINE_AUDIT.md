# Phase 5 Baseline Audit: Ares Frontier Planetary Operations Platform

**Audit Timestamp:** 2026-11-07T21:56:00+05:30  
**Repository:** `https://github.com/shrutirai29/nasa`  
**Current Branch:** `main`  
**Auditor:** Lead Systems & Operations Architecture Engineer  

---

## 1. Current Architecture Overview

Ares Frontier contains the following interconnected subsystems implemented across Phases 1 through 4:

### 1.1 Subsystem Inventory

| Subsystem | Source Location | Implementation Mechanism | State Model |
| :--- | :--- | :--- | :--- |
| **Frontend Client** | `frontend/src/` | React 18, Vite, Tailwind CSS, Leaflet, Recharts | Component state + REST polling |
| **Backend API** | `backend/src/` | Node.js 24, Express, TypeScript, Helmet, Morgan | REST controllers, middleware pipeline |
| **Security Pipeline** | `backend/src/middleware/securityMiddleware.ts` | JWT HMAC-SHA256, RBAC checks, rate limiter, HMAC integrity | Bearer token verification |
| **Audit Chain** | `backend/src/services/security/auditChainService.ts` | Cryptographic SHA-256 block chain with genesis block | Persistent (`backend/data/audit_chain.json`) |
| **Agent Registry** | `backend/src/services/agents/agentRegistry.ts` | Static roster of 5 agents (`ASTRONAUT-01`, 3 rovers, `ORBITER-01`) | In-memory `Map<string, PlanetaryAgent>` |
| **Agent State Store** | `backend/src/services/agents/agentStateStore.ts` | Operational event log and agent subscriber bus | In-memory `OperationEvent[]` |
| **Task Planner** | `backend/src/services/agents/agentTaskPlanner.ts` | Safe-return feasibility evaluator (20% battery reserve rule) | In-memory task objects |
| **Decision Engine** | `backend/src/services/agents/agentDecisionEngine.ts` | 9-stage autonomous rover control loop | Evaluates terrain directly from model |
| **Comms / Line of Sight**| `backend/src/services/comms/lineOfSightEngine.ts` | Great-circle chord ray-tracing with Mars curvature drop | Derived geometry ($R_{\text{Mars}} = 3396.19\text{ km}$) |
| **Comms Topology** | `backend/src/services/comms/communicationEngine.ts` | Surface mesh, relay hops, and orbital links | Dynamic evaluation function |
| **Orbital Coverage** | `backend/src/services/comms/communicationCoverage.ts`| Simplified 112-minute pass calculation | Heuristic trigonometric window |
| **Resource Allocator**| `backend/src/services/operations/resourceAllocator.ts` | Crew safety preemption arbitration | In-memory allocation map |
| **Replanning Engine** | `backend/src/services/operations/replanningEngine.ts` | Multi-objective Pareto route generation on hazard | In-memory proposal store + audit append |
| **Science Queue** | `backend/src/services/operations/multiAgentCoordinator.ts`| 5-stage science collection lifecycle | In-memory target queue |
| **Mission Operations**| `backend/src/services/operations/missionOperationsEngine.ts`| Deterministic MET simulation stepper (Play/Pause/Reset) | In-memory simulation state |
| **Mission Reasoning** | `backend/src/services/intelligence/missionReasoningService.ts`| Operations Copilot decision tree reasoning | Rule-based NLP synthesizer |

---

## 2. Actual Implementation Verification Against Phase 4 Claims

Every capability is rigorously classified to ensure scientific and engineering truthfulness:

| Feature / Model | Claimed Role | Actual Classification | Grounding & Limitations |
| :--- | :--- | :--- | :--- |
| **USGS Viking MDIM 2.1** | Global visible basemap | `REAL_DATA` | NASA PDS/USGS planetary WMS tile server. Real planetary imagery. |
| **MOLA Topography** | Digital Elevation Model | `REAL_DATA` / `BENCHMARK` | NASA MOLA MEGDR 128 px/deg elevation profiles with benchmark fallback. |
| **THEMIS Day IR** | Thermal regolith mosaic | `REAL_DATA` | 2001 Mars Odyssey 100 m/px thermal IR layer. |
| **Jezero Science Targets**| Geologic outcrops | `BENCHMARK` | Coordinates and units matched to Mars 2020 Perseverance published routes. |
| **Tobler Walking Pace** | EVA metabolic speed | `HEURISTIC` | Biomechanical model adapted for Mars gravity ($0.38g$); heuristic curve. |
| **Oxygen Consumption** | Suit consumables | `SIMULATED` | Deterministic $0.95\text{ L/min}$ baseline adjusted for slope work rate. |
| **Rover Locomotion** | Rocker-bogie traverse | `SIMULATED` | Parametric speed (2.4–4.2 km/h) based on chassis mass and terrain slope. |
| **Rover Battery Model** | Energy depletion | `SIMULATED` | Linear depletion rate ($80\text{--}140\text{ Wh/km}$) with incline factor. |
| **Line-of-Sight LOS** | Surface UHF comms | `DERIVED` | Ray-trace chord against MOLA elevation + Mars curvature ($R=3396.19\text{ km}$). |
| **Orbiter Connectivity**| Orbital relay pass | `DETERMINISTIC_DEMO` | Hardcoded `isPassActive = true` in `communicationEngine.ts` line 95. **Must be fixed**. |
| **Flagship 22.4° Scarp** | Rover hazard detection | `DETERMINISTIC_DEMO` | Directly injected in `triggerDemoScenario()`. Lacks sensor observation pipeline. |
| **Operations Copilot** | Decision intelligence | `DERIVED` / `RULE_BASED`| Deterministic decision logic; explainable structured directives. |
| **Cryptographic Audit** | Chain of custody | `REAL_DATA` (Cryptographic) | Genuine SHA-256 block chain written to disk with hash verification. |

---

## 3. Specifically Audited Known Issues

### ISSUE A — Orbiter Communication: Unconditional Connectivity
- **Location:** [`backend/src/services/comms/communicationEngine.ts`](file:///D:/projects/nasa/backend/src/services/comms/communicationEngine.ts#L94-L98)
- **Defect:** 
  ```typescript
  // Elevation angle to orbiter (assume visible if pass window is active)
  const isPassActive = true; // Simulated orbital pass
  const distanceToOrbiterKm = 320; // Nominal altitude
  const linkStatus: "CONNECTED" | "DEGRADED" | "LOST" = isPassActive ? "CONNECTED" : "LOST";
  ```
- **Finding:** The orbital link to `ORBITER-01` was unconditionally marked as `CONNECTED` for all surface agents at all times, ignoring actual simulation time, orbital ground track, and elevation angle above the horizon.
- **Phase 5 Fix Required:** Replace with `OrbitalVisibilityEngine` calculating geometry-dependent pass states: `NO_CONTACT`, `PASS_APPROACHING`, `PASS_ACTIVE`, `PASS_ENDING`.

---

### ISSUE B — Scripted Hazard Detection vs. Sensor Observations
- **Location:** [`backend/src/services/operations/missionOperationsEngine.ts`](file:///D:/projects/nasa/backend/src/services/operations/missionOperationsEngine.ts#L101-L120) and [`agentDecisionEngine.ts`](file:///D:/projects/nasa/backend/src/services/agents/agentDecisionEngine.ts#L68)
- **Defect:** In `triggerDemoScenario()`, the 22.4° slope scarp is manually hardcoded into rover state and event messages without any sensor measurement. In `agentDecisionEngine.ts`, rovers directly read ground-truth terrain gradients (`terrain.maxSlopeDeg`) instead of taking sensor observations.
- **Phase 5 Fix Required:** Implement a true **Sensor Observation Framework** (`LaserAltimeter`, `Hazcam`, `Raman`, `ThermalIR`) where raw readings are degraded by noise, checked for quality, fused into slope/obstacle estimates, and fed into an `ObservationHazardFusion` engine before triggering decision loops.

---

### ISSUE C — Authentication Boundary & Client-Supplied Authorization
- **Location:** [`backend/src/controllers/operationsController.ts`](file:///D:/projects/nasa/backend/src/controllers/operationsController.ts#L130-L151) and [`operationsController.ts`](file:///D:/projects/nasa/backend/src/controllers/operationsController.ts#L207-L215)
- **Defect:**
  1. `executeCommand`: No role checks or authentication enforcement; executes any `PAUSE`, `RESUME`, `RETURN_TO_BASE` command without checking user identity or command nonce/replay.
  2. `approveReplan`: Accepts `req.body.approvedBy || "Mission Commander"` directly from the client request body.
- **Phase 5 Fix Required:** Enforce server-side authenticated identity (`req.user`) from JWT claims. Implement strict RBAC matrix, command replay protection (`commandId`, `nonce`, `issuedAt`, `expiresAt`), and reject unauthorized or unauthenticated operations.

---

### ISSUE D — Persistent State vs. Ephemeral In-Memory State
- **Audit Findings:**
  - **Persistent State:** Only `backend/data/audit_chain.json` survives a backend service restart.
  - **In-Memory Volatile State:** `AgentRegistry` (positions, telemetry, tasks), `AgentStateStore` (events), `ReplanningEngine` (active proposals), `ResourceAllocator` (locks), `MultiAgentCoordinator` (science queue), and `MissionOperationsEngine` (simulation clock) are completely wiped upon restart.
- **Phase 5 Fix Required:** Build `backend/src/services/persistence/` with a persistent SQLite or file-backed ledger supporting `SAVE`, `LOAD`, `RESET`, and `CHECKPOINT` operations.

---

### ISSUE E — Scientific Model Confidence & Heuristic Transparency
- **Identified Heuristic Constants:**
  1. Tobler velocity Mars multiplier: `3.2` and incline damping factor `3.2` with offset `0.04`.
  2. Suit metabolic oxygen consumption: `0.95 L/min` base rate.
  3. Rover energy expenditure: `80 Wh/km` (relay), `120 Wh/km` (scout), `140 Wh/km` (science).
  4. Line-of-sight clearance buffer: `1.5 m` areoid clearance.
  5. MRO orbit period: `112 min` circular assumption (real MRO orbit is eccentric with argument of periapsis drift).
- **Phase 5 Fix Required:** Attach explicit `DataProvenance` and bounded uncertainty intervals to all models. Formally document them in `docs/PHASE5_MODEL_VALIDATION.md` and explicitly prevent them from masquerading as physical ground observations.
