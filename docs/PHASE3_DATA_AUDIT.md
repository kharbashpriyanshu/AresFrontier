# Phase 3 Planetary Data & Grounding Audit

**Project:** Martian Map — Interplanetary Survival Guide  
**Audit Date:** Local System Time (Phase 3 Initiation)  
**Evaluator:** Software / Planetary Full-Stack Engineer  
**Objective:** Transparently evaluate all data sources, pipelines, assumptions, heuristics, synthetic models, and security boundaries across the codebase before implementing Phase 3.

---

## 1. Executive Summary

Martian Map was developed to support human extravehicular activity (EVA) mission planning on Mars. While Phase 1 & 2 established an operational full-stack application (interactive Mars map, WMS tile layers, MOLA elevation profiles, and deterministic EVA feasibility), portions of the system relied on:
1. **Synthetic planetary models** (e.g. mathematical approximations of MOLA topographic dichotomy without fine-grained local DEM raster querying).
2. **Hardcoded confidence values** (e.g. arbitrary constants `0.92`, `0.94`, `0.95`, `0.88` placed on derived metrics without empirical uncertainty propagation).
3. **Implicit data provenance** where derived, benchmark, and heuristic data were sometimes co-mingled in UI presentations.
4. **Non-persistent security audit logs** stored in ephemeral in-memory arrays without hash-chaining or tamper verification.

Phase 3 introduces **rigorous data provenance, empirical uncertainty modeling, multi-tier planetary data providers, Pareto route frontier analysis, JWT-based RBAC, and hash-chained audit verification**.

---

## 2. Current Data Sources & Ingestion Pathways

| Data Domain | Original Primary Source | Current Implementation Mode | Storage / Ingestion Path | Provenance Classification |
|:---|:---|:---|:---|:---|
| **Visible Basemap Mosaic** | USGS Astrogeology / Viking Orbiter MDIM 2.1 | Live WMS Tile Layer | External USGS WMS Endpoint | `USGS` / `LIVE_EXTERNAL_DATA` |
| **Color Shaded Altimetry** | NASA MGS MOLA 128 ppd DEM | Live WMS Tile Layer | External USGS WMS Endpoint | `NASA` / `LIVE_EXTERNAL_DATA` |
| **Daytime Thermal IR** | 2001 Mars Odyssey THEMIS Day IR | Live WMS Tile Layer | External USGS WMS Endpoint | `NASA` / `LIVE_EXTERNAL_DATA` |
| **Landing Sites / Bases** | NASA PDS Analyst's Notebook | Static Benchmark Records | `backend/src/services/nasa/adapters/benchmarkData.ts` | `BENCHMARK_DATA` |
| **Science Targets** | NASA Mars 2020 & MSL Rover Science Planners | Static Benchmark Records | `backend/src/services/nasa/adapters/benchmarkData.ts` | `BENCHMARK_DATA` |
| **MOLA Elevation Profile** | MGS MOLA PEDR & Gridded Topography | Mathematical Interpolation Model | `marsDataService.estimateMolaElevation()` | `DERIVED` / `DETERMINISTIC_FALLBACK` |
| **Metabolic Pace** | Human planetary traversal literature (Tobler adaptation) | Deterministic Physics Formula | `missionEngine.calculateWalkingSpeedKmH()` | `HEURISTIC` / `PROJECT_RULE` |
| **EVA Life Support** | NASA Flight Rules (30-min return reserve) | Deterministic Rule Engine | `missionEngine.assessEVAFeasibility()` | `PROJECT_RULE` |
| **Hazards Catalog** | NASA HiRISE / MOLA regional scarp surveys | Static Catalog + Dynamic Slope | `hazardEngine.ts` | `BENCHMARK_DATA` & `DERIVED` |
| **AI Assessment** | Person 3 ML Contract | Rule-based Fallback / Optional HTTP | `mlEngineAdapter.ts` | `MODEL_OUTPUT` / `HEURISTIC` |

---

## 3. Data Gaps & Scientific Limitations

1. **Topographic Spatial Resolution**:
   - The current `estimateMolaElevation` accurately anchors to real landing coordinates (Jezero crater floor: $-2530\text{ m}$, Gale crater floor: $-4450\text{ m}$, Olympus Mons summit: $21229\text{ m}$, Hellas basin floor: $-7200\text{ m}$) and scales with crustal dichotomy tilting.
   - However, micro-topography $(<50\text{ m}$ lateral features such as sand dunes or small boulder fields) is statistically generated rather than extracted from $1\text{ m/pixel}$ HiRISE DTMs.
2. **Missing Coverage Quantification**:
   - The system previously lacked an engine to assess *how well-characterized* a traversal corridor is (e.g. whether HiRISE stereo coverage exists or only coarse MOLA orbital altimetry).
3. **Arbitrary Scientific Confidence**:
   - Several services assigned static confidence floats (e.g. `confidence = 0.94`) regardless of sample count, data resolution, or interpolation variance.
4. **Single-Metric Optimization**:
   - Route optimization compared routes using a weighted sum score rather than a true **Pareto non-dominated frontier**, potentially obscuring trade-offs between scientific sample return and operational terrain risk.

---

## 4. Hardcoded & Demo Data Audit

The following hardcoded items were identified for refactoring into explicit provenance models:
- Static `confidence` properties in `hazardEngine.ts` (e.g., `0.95`, `0.90`, `0.92`).
- Static `confidence` properties in `terrainEngine.ts` (`0.92`, `0.94`).
- Static `confidence` in `missionReasoningService.ts` (`0.94`) and `mlEngineAdapter.ts` (`0.88`).
- Static catalog in `benchmarkData.ts` which, while historically accurate to Mars 2020 and MSL mission planning data, must be formally wrapped in `BENCHMARK_DATA` provenance envelopes with clear uncertainty markers.

---

## 5. Security Gaps

1. **Authentication**: `securityMiddleware.ts` contained stub pass-throughs when `REQUIRE_AUTH` was not set.
2. **Role-Based Access Control**: `authorizeRequest` had empty role enforcement hooks.
3. **Audit Log Persistence & Tamper Proofing**: Audit logs were stored in an in-memory array (`auditLogStore`), meaning records were lost on server restart, and individual entries could theoretically be reordered without detection.

---

## 6. Recommended Phase 3 Architecture

```text
                                  CLIENT UI
                                     │
                                     ▼
 ┌─────────────────────────────────────────────────────────────────────────┐
 │                   PLANETARY DATA SERVICE ABSTRACTION                    │
 │ ┌───────────────────┐ ┌──────────────────┐ ┌──────────────────────────┐ │
 │ │  LIVE / REMOTE    │ │   CACHED DATA    │ │      BENCHMARK DATA      │ │
 │ │  (USGS WMS / PDS) │ │  (Local Cache)   │ │  (Mars 2020 / MSL Sites) │ │
 │ └─────────┬─────────┘ └────────┬─────────┘ └────────────┬─────────────┘ │
 │           │                    │                        │               │
 │           └────────────────────┼────────────────────────┘               │
 │                                ▼                                        │
 │                  DETERMINISTIC FALLBACK ENGINE                          │
 └────────────────────────────────┬────────────────────────────────────────┘
                                  │
                                  ▼
 ┌─────────────────────────────────────────────────────────────────────────┐
 │                  SCIENTIFIC REASONING & COVERAGE                        │
 │  • DataCoverageEngine (Elevation, Imagery, Thermal, Rover Coverage)     │
 │  • TerrainIntelligence (Empirical uncertainty & roughness derivation)   │
 │  • HazardEngine (Evidence-backed hazards + DERIVED dynamic anomalies)   │
 │  • ScienceObjectiveEngine (Factorized scoring + Observed vs Rule)       │
 └────────────────────────────────┬────────────────────────────────────────┘
                                  │
                                  ▼
 ┌─────────────────────────────────────────────────────────────────────────┐
 │                   DECISION & OPTIMIZATION LAYER                         │
 │  • Pareto Frontier Analysis (Non-dominated route trade-offs)            │
 │  • Risk-Adjusted Ranking (Value - Uncertainty Penalty)                  │
 │  • EVA Feasibility Engine (GREEN / YELLOW / RED status)                 │
 │  • Mission Copilot (Structured NLP extraction + Explainable reasoning)  │
 └────────────────────────────────┬────────────────────────────────────────┘
                                  │
                                  ▼
 ┌─────────────────────────────────────────────────────────────────────────┐
 │                 SECURITY & CRYPTOGRAPHIC INTEGRITY                      │
 │  • JWT Authentication & Role-Based Access Control (5 Roles)             │
 │  • Tamper-Evident Hash-Chained Persistent Audit Trail                   │
 │  • Chain Verification Endpoint (POST /api/security/verify-audit-chain) │
 │  • Mission Plan Lifecycle Versioning (DRAFT → ASSESSED → APPROVED/LOCK) │
 └─────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Compliance Checklist

- [x] Identify duplicate and hardcoded logic
- [x] Trace all existing NASA / USGS datasets
- [x] Document mathematical approximations and physical formulas
- [x] Map out replacement strategy for arbitrary confidence numbers
- [x] Formulate requirements for cryptographic audit chaining and RBAC
