# Martian Map — API Documentation

All endpoints return JSON wrapped in the standardized `APIResponse<T>` envelope:

```typescript
interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  metadata?: {
    source?: string;
    timestamp?: string;
    cached?: boolean;
  };
}
```

---

## 1. Planetary Locations

### `GET /api/locations`
Retrieves all cataloged NASA landing sites or searches for locations near coordinates.

- **Query Parameters**:
  - `lat` (optional): Latitude in degrees [-90 to 90]
  - `lon` (optional): Longitude in degrees [-180 to 360]
  - `maxDistanceKm` (optional): Search radius in km (default 500)
- **Response**: `APIResponse<LocationData[] | LocationData>`

### `GET /api/locations/:id`
Retrieves detailed location report by ID (e.g. `loc-jezero-crater`), including `nearbyScienceTargets`.

- **Response**: `APIResponse<LocationData>`
- **Sample Data**:
  ```json
  {
    "id": "loc-jezero-crater",
    "name": "Jezero Crater (Octavia E. Butler Landing)",
    "coordinate": { "latitude": 18.4447, "longitude": 77.4508 },
    "elevationM": -2530,
    "terrainType": "Deltaic fan / crater lacustrine deposit with clay and carbonate outcrops",
    "geologicalUnit": "Nf-ld (Noachian-Hesperian Fluvial-Lacustrine Deltaic Unit)",
    "scienceTargetsCount": 2,
    "nearbyScienceTargets": [
      {
        "id": "tgt-seitah-olivine",
        "name": "South Séítah Cumulate Outcrop",
        "category": "mineralogy",
        "scientificValue": "high"
      }
    ]
  }
  ```

---

## 2. Terrain & Topography

### `GET /api/terrain`
Evaluates MOLA elevation, slope gradient, and traversal roughness index at specific coordinates.

- **Query Parameters**:
  - `lat` (required): Latitude
  - `lon` (required): Longitude
- **Response**: `APIResponse<TerrainData>`

---

## 3. Planetary Science & Geology

### `GET /api/science/targets`
Returns cataloged planetary science targets (sedimentary beds, deltas, mineral outcrops).

- **Query Parameters**:
  - `north`, `south`, `east`, `west` (optional): Bounding box filters
- **Response**: `APIResponse<ScienceTarget[]>`

### `GET /api/science/targets/:id`
Returns a specific target by ID.

### `GET /api/science/assessment`
Generates geological unit interpretation and mineral context (Person 4 contract).

- **Query Parameters**: `lat`, `lon`
- **Response**: `APIResponse<ScientificAssessment>`

---

## 4. Routes & Traverses

### `POST /api/routes`
Constructs a continuous traverse route, sampling elevations and calculating slope physics.

- **Request Body**:
  ```json
  {
    "name": "Jezero Delta Front Traverse",
    "points": [
      { "coordinate": { "latitude": 18.4447, "longitude": 77.4508 }, "type": "start", "label": "Jezero Base" },
      { "coordinate": { "latitude": 18.4350, "longitude": 77.4380 }, "type": "science", "label": "South Séítah Outcrop" },
      { "coordinate": { "latitude": 18.4230, "longitude": 77.4110 }, "type": "destination", "label": "Delta Camp" }
    ]
  }
  ```
- **Response**: `APIResponse<MarsRoute>` (HTTP 201)

### `GET /api/routes/:id`
Returns an existing route by ID.

### `GET /api/routes`
Returns all planned routes.

---

## 5. EVA Missions & Operations

### `POST /api/missions`
Calculates life-support reserve margins, feasibility, and oxygen consumption.

- **Request Body**:
  ```json
  {
    "routeId": "route-jezero-delta-sol100",
    "maxDurationMinutes": 240,
    "startCoordinate": { "latitude": 18.4447, "longitude": 77.4508 },
    "returnRequired": true
  }
  ```
- **Response**: `APIResponse<StoredMission>`

---

## 6. AI/ML Safety Scoring (Person 3)

### `POST /api/assessment`
Evaluates traverse hazards and predicts safety/science scores.

- **Request Body**:
  ```json
  {
    "routeId": "route-jezero-delta-sol100",
    "missionParameters": {
      "maxDurationMinutes": 240
    }
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "safetyScore": 85,
      "scienceScore": 90,
      "accessibilityScore": 82,
      "overallScore": 86,
      "confidence": 0.88,
      "scoringSource": "rule-based",
      "missionStatus": "MISSION FEASIBLE",
      "scoringExplanation": "Deterministic evaluation combining MOLA slope risk (45%), science stops count (35%), and metabolic traversal distance (20%).",
      "warnings": []
    }
  }
  ```

---

## 8. Mission Intelligence, Hazards & Copilot (Phase 2)

### `GET /api/intelligence/hazards`
Retrieves cataloged Martian topographic, slope, and scarp hazards (Jezero delta scarp, Belva rim, Neretva breach, etc.).

### `GET /api/intelligence/science-objectives`
Returns the 6 predefined MEPAG planetary exploration science objectives (Ancient Water Activity, Past Habitability, Mineralogical Diversity, Volcanic History, Sedimentary History, Astrobiology Relevance).

### `POST /api/intelligence/assess-terrain`
Assesses local slope, roughness, and traversal difficulty for a coordinate or segment.
- **Request Body**:
  ```json
  {
    "coordinate": { "latitude": 18.4447, "longitude": 77.4508 }
  }
  ```

### `POST /api/intelligence/assess-hazards`
Evaluates hazards along a route or single point, returning detected hazards, risk level (`LOW`, `MODERATE`, `HIGH`, `CRITICAL`), and mitigation recommendations.

### `POST /api/intelligence/optimize-route`
Generates 4 differentiated route candidate profiles (`shortest`, `safest`, `highest_science`, `balanced`) for given start/dest and science objective.

### `POST /api/intelligence/mission-recommendation`
Generates structured, explainable mission reasoning across route candidates with cryptographic SHA-256 audit hash.

### `POST /api/copilot/mission-plan`
High-level Copilot pipeline combining candidate solving, reasoning, and audit trail in one call.

### `GET /api/intelligence/audit-log`
Returns security audit logs with SHA-256 telemetry signatures.

---

## 9. Phase 3 Planetary Grounding & Cybersecurity Endpoints

### `POST /api/security/verify-audit-chain`
Performs cryptographic verification of the entire SHA-256 persistent audit block chain (`data/audit_chain.json`), checking genesis block, sequence numbers, and hash integrity.

- **Response**: `APIResponse<AuditVerificationResult>`
- **Sample Output**:
  ```json
  {
    "success": true,
    "data": {
      "isValid": true,
      "chainLength": 12,
      "totalBlocks": 12,
      "verifiedAt": "2026-11-07T14:30:00.000Z",
      "message": "Audit chain verified. All 12 blocks cryptographically intact."
    }
  }
  ```

### `GET /api/security/audit-chain`
Returns the complete list of persistent audit blocks in the chain.

### `POST /api/security/token`
Issues HMAC-SHA256 JWT tokens for RBAC authentication (`MISSION_COMMAND`, `SCIENCE_OFFICER`, `ASTRONAUT`, `ANALYST`, `VIEWER`).

### `POST /api/missions/:id/approve`
Formally approves a mission plan (requires `MISSION_COMMAND` role), bumping the plan version.

### `POST /api/missions/:id/lock`
Cryptographically locks a mission plan, preventing further waypoint or parameter mutations.

### `GET /api/planetary/coverage`
Evaluates observational sensor density (MOLA, HiRISE, THEMIS, Rover, Science Targets) at given coordinates.
- **Query Parameters**: `lat`, `lon`
- **Response**: `APIResponse<DataCoverage>`

### `GET /api/science/targets/breakdown`
Returns factorized science scoring breakdown for cataloged outcrops, separating physical observed evidence from project rules.
- **Response**: `APIResponse<ScienceValueBreakdown[]>`

---

## 10. Data Sources & Health

### `GET /api/data/sources`
Returns catalog of NASA datasets, missions, and attribution requirements.

### `GET /api/data/status`
Returns health of NASA planetary data pipelines and integrated subsystems:
```json
{
  "success": true,
  "data": {
    "status": "operational",
    "pipelines": {
      "molaElevation": "Available",
      "vikingImagery": "Available",
      "themisThermal": "Available",
      "scienceTargets": "Available",
      "mlService": "Fallback Mode (Rule-based)",
      "database": "Local In-Memory Repository",
      "lastCheck": "2026-11-07T13:00:00.000Z"
    }
  }
}
```

---

## 11. Multi-Agent Planetary Field Operations (Phase 4)

### `GET /api/operations/agents`
Returns all registered planetary surface and orbital agents with current coordinates, battery level, telemetry status, and capabilities.

### `GET /api/operations/agents/:id`
Returns individual agent record with deep telemetry, payload suite, and assigned task.

### `POST /api/operations/agents/:id/tasks`
Assigns an operational task to a rover or astronaut after running safe-return energy and slope feasibility checks.

### `POST /api/operations/agents/:id/commands`
Issues teleoperations command (`PAUSE`, `RESUME`, `RETURN_TO_BASE`) to an active field agent.

### `GET /api/operations/communications`
Evaluates active planetary communications topology, chord line of sight, direct surface links, and rover relay hops.

### `GET /api/operations/communications/windows`
Calculates incoming orbital pass windows for `ORBITER-01 (MRO-Relay)`.

### `GET /api/operations/timeline`
Retrieves chronological mission timeline events and MET marks.

### `POST /api/operations/simulation/advance`
Advances deterministic mission simulation time by `minutes` and executes rover decision cycles.

### `POST /api/operations/replan`
Triggers dynamic route replanning evaluation on hazard or communication triggers.

### `POST /api/operations/replan/:id/approve`
Mission Command approval gate for an active replanning proposal. Appends signed block to audit chain.

### `POST /api/operations/demo-hazard-recon`
Executes flagship demonstration scenario: Scout rover encounters 22.4° scarp, pauses, requests detour, and alerts Flight Director.

### `GET /api/operations/science-queue`
Returns shared multi-agent planetary science target queue.

### `POST /api/operations/copilot/query`
Natural language collaborative operations Copilot query answering operational and tactical field questions.

---

## 12. Verified Planetary Simulation & Autonomous Intelligence (Phase 5)

### `GET /api/operations/observations`
Retrieves live and historical onboard sensor observations (Laser Altimeter, HazCam, Raman Spectrometry, Thermal IR) with physical uncertainty bounds and calibration provenance.

### `GET /api/operations/orbital/current`
Calculates real-time Keplerian orbital geometry for Mars Reconnaissance Orbiter (MRO) over Jezero Crater (elevation angle, slant range, bandwidth, pass state).

### `GET /api/operations/comms/queue`
Retrieves the prioritized communication packet queue (`CRITICAL` vs `BULK` science) and packet delivery statuses.

### `POST /api/operations/comms/flush`
Processes and flushes queued telemetry packets based on active orbital visibility.

### `GET /api/operations/events`
Returns the cryptographically chained, immutable mission event stream.

### `GET /api/operations/events/verify`
Performs SHA-256 cryptographic chain verification on the historical event ledger.

### `GET /api/operations/security/permissions`
Inspects the RBAC authorization matrix for the authenticated user token.

### `POST /api/operations/commands/validate`
Validates command envelopes against anti-replay, nonce, expiration, and role boundaries before execution.

### `POST /api/operations/scenarios/:scenarioId`
Executes verified deterministic operations scenarios (`MARSWALK-001`, `COMM-BLACKOUT-001`, `SECURITY-001`, `EMERGENCY-001`).

### `POST /api/operations/state/checkpoint`
Creates an immutable named snapshot of the entire runtime mission state.

### `POST /api/operations/state/restore`
Restores mission state from a named checkpoint.

### `POST /api/operations/state/reset`
Resets runtime simulation state to default baseline without wiping the cryptographic audit chain.


