# Martian Map — System Architecture & Integration Guide

## 1. System Overview

Martian Map is a full-stack planetary exploration and mission planning application built for the NASA Space Apps Challenge.
The system provides future Martian astronauts and flight controllers with real-time terrain evaluation, MOLA elevation profiling,
science target evaluation, and deterministic extravehicular activity (EVA) feasibility calculations.

```text
USER (Astronaut / Mission Planner)
 │
 ▼
FRONTEND (React 18 + Vite + TypeScript + Tailwind CSS + Leaflet + Recharts)
 │
 │ HTTPS / REST (Standardized APIResponse<T> envelope)
 ▼
BACKEND API (Node.js + Express + TypeScript + Zod)
 │
 ├────────────────────────────────┬───────────────────────────────┬───────────────────────────────┐
 ▼                                ▼                               ▼                               ▼
NASA DATA SERVICE            SCIENCE ENGINE                   AI/ML ENGINE                    EVA MISSION
(Unified Multi-Mission       (Geological Rules &             (Hazard & Safety                ENGINE
 MOLA Topography Provider)    Stratigraphic Context)          Scoring Adapter)               (Metabolic Physics)
 │                                │                               │                               │
 └────────────────────────────────┴───────────────┬───────────────┴───────────────────────────────┘
                                                  │
                                                  ▼
                                           MISSION REPOSITORY
                                         (PostgreSQL / PostGIS &
                                          Resilient Memory Fallback)
```

---

## 2. Implementation Status Classification

| Module / Component | Status | Description |
|--------------------|--------|-------------|
| **Interactive Mars Map** | `IMPLEMENTED` | Leaflet planetographic projection, USGS Viking MDIM 2.1, MOLA Topography, THEMIS Day IR, reticle HUD, waypoint markers, segment lines. |
| **Location Explorer** | `IMPLEMENTED` | Full reconnaissance drawer, MOLA elevation, slope index, NASA mission context, nearby science targets, action buttons (`Set as Start`, `Set as Destination`, `Add Science Stop`, `Plan Mission`). |
| **Tactical Route Planner** | `IMPLEMENTED` | Great-circle waypoint traversal, science target insertion, Tobler metabolic speed calculation for Mars gravity, MOLA cross-section profiling. |
| **Elevation Profile Chart** | `IMPLEMENTED` | Recharts SVG elevation chart, slope gradient, climb/descent stats, steep section warning badge, interactive cursor sync. |
| **EVA & Mission Engine** | `IMPLEMENTED` | Deterministic traversal physics, 30-min NASA flight safety reserve margin enforcement, oxygen consumption model, interactive parameter tuner. |
| **Science Target Catalog** | `IMPLEMENTED` | NASA Mars 2020 & MSL ground-truth targets (deltas, layered sulfates, olivine cumulates) with candidate sample targets and 1-click "Add to Marswalk". |
| **AI/ML Scoring Adapter** | `INTEGRATION READY` | Adapter connects to external microservice via `ML_SERVICE_URL`; transparent deterministic fallback model active with explicit scoring source badges (`model-generated` vs `rule-based`). |
| **Science Engine Adapter** | `INTEGRATION READY` | Adapter connects to external rules service via `SCIENCE_SERVICE_URL`; deterministic geological context and CRISM mineralogy active. |
| **Cybersecurity Middleware**| `INTEGRATION READY` | Security extension hooks (`authenticateRequest`, `authorizeRequest`, `checkRateLimit`, `validateRequest`, `verifyDataIntegrity`) in middleware chain. |
| **Data Provenance & Status**| `IMPLEMENTED` | In-map modal cards detailing NASA mission sources, instruments, and live pipeline operational health. |
| **Database Storage** | `IMPLEMENTED` | PostgreSQL/PostGIS DDL schema with automated in-memory repository fallback for zero-dependency local hackathon execution. |
| **External ML Microservice**| `EXTERNAL DEPENDENCY`| Person 3 Python FastAPI service (optional; fallback active). |
| **External Science Service** | `EXTERNAL DEPENDENCY`| Person 4 rule engine (optional; fallback active). |

---

## 3. End-to-End User Flow

The application enables a continuous single-page and cross-page mission workflow:

```text
LANDING PAGE (Launch Demo MARSWALK-001 or Explore Mars)
      ↓
INTERACTIVE MARS MAP (Viking / MOLA / THEMIS basemaps)
      ↓
LOCATION INSPECTOR (Click terrain -> MOLA elevation, slope, NASA mission context)
      ↓
SCIENCE TARGETS ("Science Along the Way" -> Browse or click target -> "Add to Marswalk")
      ↓
MARSWALK ROUTE PLANNER (Start, Destination, Intermediate Science Stops, pick on map)
      ↓
TERRAIN & ELEVATION CROSS-SECTION (Continuous distance vs elevation, climb/descent stats)
      ↓
EVA FEASIBILITY ASSESSMENT (30-min reserve margins, oxygen reserve, metabolic speed)
      ↓
AI / SCIENCE MISSION SCORING (Safety 0-100, Science 0-100, Accessibility 0-100, Overall)
      ↓
FLIGHT OPERATIONS RECOMMENDATION (FEASIBLE vs CONSTRAINT EXCEEDED with exact reasons)
```

---

## 4. Geodetic & Topographic Reference

- **Ellipsoid Datum**: Mars Areoid ($R = 3396.19\text{ km}$, equatorial radius $R = 3389.5\text{ km}$).
- **Elevation**: Relative to the MOLA zero-datum gravitational equipotential surface.
- **Traversal Speed Formula**:
  $$\text{Speed}(\text{slope}) = 3.2 \cdot \exp(-3.2 \cdot |\tan(\text{slope}) + 0.04|) \quad [\text{km/h}]$$
- **Metabolic Load**: Scaled for pressurized planetary exploration suits under Martian surface gravity ($0.38g$).
