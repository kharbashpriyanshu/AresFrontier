# Martian Map — Data Provenance Model

## 1. Provenance Specification & Design

In planetary science and aerospace mission operations, decisions must be auditable back to specific sensors, orbits, and calibration steps. The Martian Map provenance standard enforces that every response envelope includes explicit scientific citations.

```typescript
export interface DataProvenance {
  sourceType: SourceType;          // "NASA" | "USGS" | "ROVER" | "BENCHMARK_DATA" | "DERIVED" | "PROJECT_RULE" ...
  sourceName: string;              // e.g., "NASA MGS MOLA MEGDR Altimetry"
  datasetId?: string;              // e.g., "MGS-M-MOLA-5-MEGDR-L3-V1.0"
  observationId?: string;          // e.g., "SOL-100-M2020-SUPERCAM"
  sourceUrl?: string;              // Link to NASA PDS or USGS Planetary GIS
  acquiredAt?: string;             // ISO-8601 acquisition timestamp or Sol date
  spatialResolutionM?: number;     // e.g., 463m, 1m, or 0.25m
  processingMethod?: string;       // e.g., "Bilinear interpolation on MOLA MEGDR grid"
  confidence?: number;             // 0.0 - 1.0 (dynamically calculated based on mode and roughness)
  dataMode?: DataMode;             // "LIVE" | "CACHED" | "BENCHMARK" | "FALLBACK" | "DEMO"
  uncertainty?: {
    absolute?: number;             // e.g., ±2.5 m
    relative?: number;             // e.g., ±1.0°
    unit?: string;                 // "meters" | "degrees" | "percent"
    methodology?: string;          // Mathematical uncertainty formulation
  };
}
```

---

## 2. Dynamic Confidence Formulation

Martian Map eliminates all arbitrary static confidence constants (e.g., hardcoded `0.95` or `0.88`). Confidence is dynamically derived from empirical observation mode and physical terrain properties:

$$C_{\text{terrain}} = C_{\text{base}}(\text{mode}) - k_{\text{roughness}} \cdot \text{RoughnessFactor}$$

Where:
- $C_{\text{base}}(\text{BENCHMARK}) = 0.95$
- $C_{\text{base}}(\text{CACHED}) = 0.90$
- $C_{\text{base}}(\text{FALLBACK}) = 0.78$
- $\text{RoughnessFactor} = \min(0.20, \frac{\Delta \text{Slope}_{\text{local}}}{50.0})$

If observational data is missing, the confidence is explicitly returned as `undefined` or flagged as low confidence rather than fabricating certainty.

---

## 3. Provenance Builders in Code

Standardized provenance generators in `backend/src/services/planetary/provenanceService.ts`:
- `createMolaProvenance(mode, lat, lon, roughness)`
- `createHiRiseProvenance(productName, dtmId, resolution)`
- `createThemisProvenance(thermalInertiaBand)`
- `createRoverProvenance(rover, sol, instrument, target)`
- `createDerivedProvenance(method, inputs, confidence)`
- `createProjectRuleProvenance(ruleId, rationale)`
