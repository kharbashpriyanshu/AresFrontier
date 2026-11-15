# ARES FRONTIER — CRITICAL FINDINGS & ARCHITECTURAL RISKS

**Audit Date**: November 12, 2026  
**Auditor**: Antigravity Technical Audit Agent  
**Repository**: `ares-frontier`  

---

## 1. Executive Risk Summary

This audit identified **6 major categories of architectural risk and technical deficiency** that impact the realism, scalability, and mission-readiness of the platform:
1. **Mocked / Missing External Intelligence Services** (ML/AI and Science are empty shells).
2. **Synthetic Topography Disguised as Calibrated Data** (Analytical mathematical formula used instead of true raster MOLA DEM sampling).
3. **Canned What-If & Perturbed Constant Monte Carlo** (Simulations are statistical illusions rather than physical runs).
4. **Keyword-Regex Copilot Posing as AI** (String template matching without LLM intelligence or tool execution).
5. **Absent 3D Visualization Infrastructure** (No 3D libraries or components exist in the repository).
6. **Decoupled Persistence & Ephemeral Route Storage** (Routes stored in memory while events stored on disk).

---

## 2. Detailed Findings

### Finding 1: Disconnected ML/AI and Science Subsystems
- **Severity**: HIGH
- **Files Affected**:
  - `ml/README.md`
  - `science/README.md`
  - `backend/src/services/ml/mlEngineAdapter.ts`
  - `backend/src/services/science/scienceEngineAdapter.ts`
- **Description**:
  The project documentation repeatedly highlights advanced AI hazard modeling, machine learning route scoring, and planetary geological rules. However, both `ml/` and `science/` directories contain only documentation files (`README.md`). The adapters `mlEngineAdapter.ts` and `scienceEngineAdapter.ts` are hardcoded to fallback heuristics (`calculateBaselineAssessment` and `evaluatePlanetaryGeology`).
- **Impact**:
  The system currently performs zero machine learning inference. All safety and science scores are deterministic linear formulas with arbitrary static weights.
- **Remediation**:
  Develop the planned microservices or embed direct lightweight ONNX/JavaScript inference pipelines into the backend.

---

### Finding 2: Synthetic Elevation Formula Substituting for MOLA Grids
- **Severity**: HIGH
- **Files Affected**:
  - `backend/src/services/nasa/marsDataService.ts` (`estimateMolaElevation()`, lines 208-320)
  - `data/README.md`
- **Description**:
  The elevation calculation for any arbitrary coordinate on Mars does not sample digital elevation rasters (such as MOLA MEGDR 128ppd or HRSC DTMs). Instead, it runs an analytical mathematical formula:
  ```ts
  const dichotomyTilt = Math.sin((lon * Math.PI) / 180) * 15;
  const latDiff = lat - dichotomyTilt;
  let baseElevation = -4000 / (1 + Math.exp(-latDiff * 0.15)) + 1500 * (1 / (1 + Math.exp(latDiff * 0.15)));
  ```
  It adds manual sinusoidal and Gaussian bumps for Olympus Mons, Hellas Basin, and Jezero Crater.
- **Impact**:
  Traverses planned outside the benchmark coordinates traverse mathematically synthesized elevations rather than true Martian terrain. Slopes and elevation gains are approximated, leading to inaccurate life-support and rover battery estimates.
- **Remediation**:
  Store preprocessed binary elevation tiles or GeoTIFF slices in `data/processed/` and implement bilinear interpolation over true raster cells.

---

### Finding 3: Canned What-If Simulations and Perturbed Constant Monte Carlo
- **Severity**: HIGH
- **Files Affected**:
  - `backend/src/services/simulation/whatIfSimulationEngine.ts` (lines 64-160)
  - `backend/src/services/simulation/monteCarloEngine.ts` (lines 76-120)
- **Description**:
  - In `WhatIfSimulationEngine`, alternate decision paths (`IGNORE_HAZARD`, `CONSERVATIVE_STANDBY`, `MAX_SPEED_BURST`) return static, hardcoded comparison numbers (e.g. `distanceKm: 6.9`, `durationMin: 36.0`, `batteryPercent: 65.0`, `safetyScore: 51`).
  - In `MonteCarloEngine`, 100 runs are executed using a pseudo-random number generator, but instead of traversing waypoints and simulating physics, it merely perturbs static baseline constants:
    ```ts
    const finalBattery = Number((78.0 + z0 * 4.5).toFixed(1));
    const duration = Number((42.0 + z1 * 3.2).toFixed(1));
    const scienceScore = Math.round(91 + z0 * 3.0);
    ```
- **Impact**:
  Monte Carlo analysis reports identical statistical distributions regardless of route length, waypoint count, or terrain gradient. It does not provide real engineering risk analysis.
- **Remediation**:
  Implement true forward propagation simulating rover kinematics, motor power curves, and obstacle collision probabilities over the route's elevation profile.

---

### Finding 4: Dual Storage and Ephemeral Route Persistence
- **Severity**: MEDIUM
- **Files Affected**:
  - `backend/src/repositories/missionRepository.ts`
  - `backend/src/services/persistence/missionPersistenceService.ts`
  - `backend/src/models/schema.sql`
- **Description**:
  The system possesses two unlinked storage layers:
  1. `missionRepository.ts` stores planned routes and missions in volatile JavaScript `Map` objects in RAM.
  2. `MissionPersistenceService.ts` writes agent states, checkpoints, and events to JSON files on disk.
  3. `schema.sql` defines PostGIS database tables, but no database connection driver exists in `package.json`.
- **Impact**:
  If the server restarts, all user-planned routes and mission definitions in `missionRepository` vanish immediately, while operations events persist. This causes foreign key / route reference breakages.
- **Remediation**:
  Unify storage into SQLite via `better-sqlite3` or implement atomic JSON disk persistence for routes in `backend/data/routes.json`.

---

### Finding 5: Completely Absent 3D Visualization Infrastructure
- **Severity**: MEDIUM
- **Files Affected**:
  - `frontend/package.json`
  - `frontend/src/components/MarsMap.tsx`
- **Description**:
  Requirements 39 and 40 mandate 2D/3D Mars visualization with 3D terrain, rovers, routes, and communication rays. However, the frontend dependencies include only Leaflet 1.9.4 and Recharts 2.15.0. No 3D rendering engine (Three.js, CesiumJS, WebGL, React Three Fiber) is installed or referenced in any source file.
- **Impact**:
  Requirement 40 is 0% implemented. Operators cannot inspect vertical scarp drop-offs, rover orientation pitch/roll, or 3D orbital communication rays.
- **Remediation**:
  Install Three.js / `@react-three/fiber` and build a 3D tactical terrain component toggled from the 2D map.

---

### Finding 6: Pre-Baked Route Offsets Rather than Algorithmic Pathfinding
- **Severity**: MEDIUM
- **Files Affected**:
  - `backend/src/services/intelligence/routeOptimizationEngine.ts` (lines 89-148, 189-236)
- **Description**:
  The 4 route candidates (`shortest`, `safest`, `highest_science`, `balanced`) are not generated using pathfinding algorithms like A*, Dijkstra, or Fast Marching Method. Instead, the engine creates waypoints using static latitude/longitude offsets:
  ```ts
  const safeMidCoord: MarsCoordinate = {
    latitude: (start.latitude + dest.latitude) / 2 - 0.006,
    longitude: (start.longitude + dest.longitude) / 2 + 0.004,
  };
  ```
- **Impact**:
  If the destination or start coordinate changes, the "safest" detour might lead directly into a canyon or scarp rather than finding a truly optimal low-slope contour.
- **Remediation**:
  Implement a 2D cost-grid A* pathfinder navigating cost maps weighted by slope, hazards, and science target locations.

---

### Finding 7: Frontend Bundle Size Exceeding 500 kB
- **Severity**: LOW
- **Files Affected**:
  - `frontend/dist/assets/index-ZnJoiHWu.js` (990.91 kB uncompressed, 264.50 kB gzip)
  - `frontend/vite.config.ts`
- **Description**:
  The frontend builds all pages and components into a single massive chunk (`990.91 kB`), triggering Vite's build warning. There is no route-based dynamic code splitting (`React.lazy()`).
- **Impact**:
  Initial page load time is unnecessarily delayed, particularly on constrained or mobile connections.
- **Remediation**:
  Introduce `React.lazy()` for page routes and configure `rollupOptions.output.manualChunks` in `vite.config.ts`.

---

## 3. External Dependencies & Credential Audit

| Service / Dependency | Current Status | Hardcoded Credentials? | Exposure Risk |
| :--- | :--- | :--- | :--- |
| **USGS Astrogeology WMS** | Operational (public tile server) | None (public endpoint) | Low |
| **NASA Open APIs** | Configured via `NASA_API_KEY=DEMO_KEY` in `.env.example` | None committed | Low |
| **JWT Secret** | Configured via `JWT_SECRET` in `.env.example` | Default development fallback in code | Medium (must be overridden in production) |
| **External ML Service** | Disconnected (`http://localhost:8000`) | N/A | None |
| **External Science Service** | Disconnected (`http://localhost:8001`) | N/A | None |
| **PostgreSQL Database** | Inactive (`USE_IN_MEMORY_FALLBACK=true`) | Default local credentials in `.env.example` | Low |

No sensitive production keys, tokens, or private secrets were found hardcoded in source files.
