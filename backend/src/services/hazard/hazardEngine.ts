import {
  Hazard,
  HazardAssessment,
  HazardSeverity,
  MarsCoordinate,
  MarsRoute,
} from "../../types/index.js";
import { calculateMarsDistanceKm } from "../../utils/marsCoordinates.js";
import { terrainEngine } from "../terrain/terrainEngine.js";
import { ProvenanceService } from "../planetary/provenanceService.js";

/**
 * Catalog of known Martian geological and topographic hazards with empirical evidence.
 */
export const DOCUMENTED_MARS_HAZARDS: Hazard[] = [
  {
    id: "hzd-jezero-delta-scarp",
    name: "Jezero Delta Front Scarp",
    type: "SCARP",
    severity: "HIGH",
    location: { latitude: 18.448, longitude: 77.402 },
    radiusM: 450,
    reason: "Steep 60m vertical drop along the western delta front with loose boulder talus.",
    recommendation: "Maintain minimum 100m standoff from cliff edge; descend via mapped gentle ramps only.",
    confidence: 0.95,
    sourceType: "NASA",
    evidence: [
      {
        id: "ev-jezero-scarp-mola",
        description: "60m vertical elevation drop measured over 120m horizontal distance",
        dataset: "NASA MGS MOLA 128ppd Altimetry",
        observedMetric: "Slope: 26.5°",
        provenance: ProvenanceService.createMolaProvenance("BENCHMARK_DATA", 2.5),
      },
      {
        id: "ev-jezero-scarp-hirise",
        description: "Exposed vertical delta foreset cliff with boulder collapse apron",
        dataset: "MRO HiRISE Stereo DTM PSP_002172_1985",
        observedMetric: "Resolution: 0.25m/pixel",
        provenance: ProvenanceService.createHiriseProvenance("PSP_002172_1985"),
      },
    ],
    uncertainty: {
      absolute: 25,
      unit: "m",
      methodology: "HiRISE stereo DTM edge triangulation and MOLA pulse margin",
    },
    provenance: ProvenanceService.createHiriseProvenance("PSP_002172_1985"),
  },
  {
    id: "hzd-belva-crater-rim",
    name: "Belva Crater Structural Rim",
    type: "STEEP_SLOPE",
    severity: "MODERATE",
    location: { latitude: 18.485, longitude: 77.442 },
    radiusM: 500,
    reason: "Impact rim slope exceeding 16 degrees with perched megabreccia blocks.",
    recommendation: "Avoid traversing directly over perched boulders; follow low-gradient rim gaps.",
    confidence: 0.9,
    sourceType: "NASA",
    evidence: [
      {
        id: "ev-belva-slope",
        description: "Rim crest slope incline exceeds nominal EVA walking boundary",
        dataset: "MRO CTX & HiRISE Orthomosaic",
        observedMetric: "Measured Slope: 16.8°",
        provenance: ProvenanceService.createHiriseProvenance("ESP_037146_1985"),
      },
    ],
    uncertainty: {
      absolute: 50,
      unit: "m",
      methodology: "Crater structural rim delineation from orbital optical imagery",
    },
    provenance: ProvenanceService.createHiriseProvenance("ESP_037146_1985"),
  },
  {
    id: "hzd-neretva-chokepoint",
    name: "Neretva Fluvial Breach Bottleneck",
    type: "ROUTE_BOTTLENECK",
    severity: "HIGH",
    location: { latitude: 18.52, longitude: 77.38 },
    radiusM: 350,
    reason: "Narrow canyon passage with 25-degree scarp walls, eliminating emergency egress options.",
    recommendation: "Confirm rover/suit battery reserves before ingress; designate return turnaround points.",
    confidence: 0.92,
    sourceType: "USGS",
    evidence: [
      {
        id: "ev-neretva-chokepoint",
        description: "Fluvial valley gorge width narrows to 140m with sheer confining walls",
        dataset: "HRSC Mars Express & MOLA Combined Elevation Model",
        observedMetric: "Channel Width: 140m",
        provenance: ProvenanceService.createVikingProvenance(),
      },
    ],
    uncertainty: {
      absolute: 40,
      unit: "m",
      methodology: "HRSC stereo photogrammetry channel profile cross-sections",
    },
    provenance: ProvenanceService.createVikingProvenance(),
  },
  {
    id: "hzd-seitah-dune-field",
    name: "South Séítah Transverse Aeolian Ridges (TARs)",
    type: "ROUGH_TERRAIN",
    severity: "MODERATE",
    location: { latitude: 18.432, longitude: 77.445 },
    radiusM: 600,
    reason: "Soft, poorly consolidated ripple bedforms with high risk of wheel entrapment or slip.",
    recommendation: "Cross rippled terrain perpendicular to crests at lowest possible slope angle.",
    confidence: 0.94,
    sourceType: "NASA",
    evidence: [
      {
        id: "ev-seitah-tars",
        description: "Perseverance rover navcam slip monitoring recorded 18-24% wheel slip in dune sand",
        dataset: "NASA Mars 2020 Mobility Logs Sol 150-250",
        observedMetric: "Wheel Slip: 22%",
        provenance: ProvenanceService.createRoverProvenance("Mars 2020 (Perseverance)", "Navcam/Mobility", 200),
      },
    ],
    uncertainty: {
      absolute: 30,
      unit: "m",
      methodology: "Rover traverse drive slip telemetry and orbital HiRISE TAR mapping",
    },
    provenance: ProvenanceService.createRoverProvenance("Mars 2020 (Perseverance)", "Navcam/Mobility", 200),
  },
  {
    id: "hzd-gale-gediz-vallis-cliff",
    name: "Gediz Vallis Ridge Scarp",
    type: "SCARP",
    severity: "HIGH",
    location: { latitude: -4.71, longitude: 137.37 },
    radiusM: 400,
    reason: "Near-vertical debris-flow deposit ridge with unstable basaltic blocks.",
    recommendation: "Traverse base of ridge only; do not attempt unassisted astronaut ridge ascent.",
    confidence: 0.91,
    sourceType: "NASA",
    evidence: [
      {
        id: "ev-gediz-scarp",
        description: "Debris-flow boulder levee with unstable perched rocks up to 3m diameter",
        dataset: "MSL Mastcam Imaging & HiRISE DTM",
        observedMetric: "Slope: 28°",
        provenance: ProvenanceService.createRoverProvenance("MSL (Curiosity)", "Mastcam", 3100),
      },
    ],
    provenance: ProvenanceService.createRoverProvenance("MSL (Curiosity)", "Mastcam", 3100),
  },
  {
    id: "hzd-olympus-caldera-fault",
    name: "Olympus Mons Ring Fault System",
    type: "SCARP",
    severity: "CRITICAL",
    location: { latitude: 18.65, longitude: -133.8 },
    radiusM: 1200,
    reason: "Nested collapse cliff with 2 km vertical cliff face.",
    recommendation: "Strict EVA no-traverse zone. Observation from designated vantage point only.",
    confidence: 0.98,
    sourceType: "USGS",
    evidence: [
      {
        id: "ev-olympus-fault",
        description: "Caldera boundary fault cliff with 2000m vertical drop",
        dataset: "MGS MOLA Gridded Elevation Model",
        observedMetric: "Vertical Drop: 2100m",
        provenance: ProvenanceService.createMolaProvenance("BENCHMARK_DATA", 10.0),
      },
    ],
    provenance: ProvenanceService.createVikingProvenance(),
  },
  {
    id: "hzd-melas-chasma-cliff",
    name: "Melas Chasma Wall Scarp",
    type: "LARGE_ELEVATION_CHANGE",
    severity: "CRITICAL",
    location: { latitude: -9.8, longitude: -76.5 },
    radiusM: 1500,
    reason: "Catastrophic 3.5 km elevation drop with frequent rockfalls and active landslides.",
    recommendation: "Unfeasible for surface pedestrian EVA. Aerial or tethered traversal only.",
    confidence: 0.96,
    sourceType: "USGS",
    evidence: [
      {
        id: "ev-melas-cliff",
        description: "Tectonic chasma wall with 3500m relief",
        dataset: "MGS MOLA / THEMIS Daytime Thermal Infrared",
        observedMetric: "Elevation Change: -3500m",
        provenance: ProvenanceService.createMolaProvenance("BENCHMARK_DATA", 15.0),
      },
    ],
    provenance: ProvenanceService.createVikingProvenance(),
  },
];

/**
 * Mars Hazard Engine (Phase 3 Upgrade)
 * Dynamically detects terrain hazards, attaches rigorous evidence, and computes risk levels.
 */
export class HazardEngine {
  public getAllHazards(): Hazard[] {
    return [...DOCUMENTED_MARS_HAZARDS];
  }

  /**
   * Assesses hazards along a planned route, synthesizing known catalog hazards
   * and dynamically derived topographic hazards.
   */
  public assessRouteHazards(route: MarsRoute): HazardAssessment {
    const detectedHazards: Hazard[] = [];
    const affectedSegments: string[] = [];
    const reasons: string[] = [];
    const mitigationSuggestions: string[] = [];

    let highestSeverityScore = 0;

    // 1. Check known spatial hazard proximity along each segment
    for (let i = 0; i < route.segments.length; i++) {
      const segment = route.segments[i];
      const segStart = segment.start;
      const segEnd = segment.end;
      const segLabel = `Segment ${i + 1} (${segment.id})`;

      for (const knownHazard of DOCUMENTED_MARS_HAZARDS) {
        const dStartKm = calculateMarsDistanceKm(segStart, knownHazard.location);
        const dEndKm = calculateMarsDistanceKm(segEnd, knownHazard.location);
        const minDistanceKm = Math.min(dStartKm, dEndKm);
        const radiusKm = (knownHazard.radiusM || 500) / 1000;

        if (minDistanceKm <= radiusKm + 0.2) {
          const hazardCopy: Hazard = {
            ...knownHazard,
            affectedRouteSegment: segLabel,
          };
          detectedHazards.push(hazardCopy);
          affectedSegments.push(segLabel);
          reasons.push(
            `${segLabel} passes within ${Math.round(minDistanceKm * 1000)}m of ${knownHazard.name} (${knownHazard.severity}): ${knownHazard.reason}`
          );
          if (knownHazard.recommendation) {
            mitigationSuggestions.push(knownHazard.recommendation);
          }
        }
      }

      // 2. Dynamic slope hazard detection (labeled explicitly as DERIVED)
      if (segment.averageSlopeDegrees >= 18) {
        const slopeHazard: Hazard = {
          id: `dyn-slope-crit-${segment.id}`,
          name: `Extreme Incline (${segment.averageSlopeDegrees.toFixed(1)}°)`,
          type: "EXTREME_SLOPE",
          severity: "CRITICAL",
          location: segment.start,
          affectedRouteSegment: segLabel,
          reason: `Measured segment average slope of ${segment.averageSlopeDegrees.toFixed(1)}° approaches safe EVA walking limits (20° astronaut mobility ceiling).`,
          recommendation: "Re-route around ridgeline or engage switchback traverse pattern with mechanical tether support.",
          confidence: 0.91,
          sourceType: "DERIVED",
          evidence: [
            {
              id: `ev-slope-${segment.id}`,
              description: `MOLA elevation delta calculation yielded ${segment.averageSlopeDegrees.toFixed(1)}° incline`,
              dataset: "Derived MOLA Altimetry Bilateral Step Interpolation",
              observedMetric: `Slope: ${segment.averageSlopeDegrees.toFixed(1)}°`,
              provenance: ProvenanceService.createDerivedProvenance(
                "Segment Slope Calculation",
                ["MGS MOLA MEGDR", "Great-circle distance formula"],
                "arctan(deltaH / stepDistance)"
              ),
            },
          ],
          uncertainty: {
            absolute: 2.0,
            unit: "degrees",
            methodology: "Propagated vertical altimetry resolution over segment baseline distance",
          },
          provenance: ProvenanceService.createDerivedProvenance("Extreme Slope Hazard", ["MGS MOLA Altimetry"], "Dynamic incline detection"),
        };
        detectedHazards.push(slopeHazard);
        affectedSegments.push(segLabel);
        reasons.push(slopeHazard.reason);
        mitigationSuggestions.push(slopeHazard.recommendation!);
      } else if (segment.averageSlopeDegrees >= 12) {
        const slopeHazard: Hazard = {
          id: `dyn-slope-high-${segment.id}`,
          name: `Steep Incline (${segment.averageSlopeDegrees.toFixed(1)}°)`,
          type: "STEEP_SLOPE",
          severity: "HIGH",
          location: segment.start,
          affectedRouteSegment: segLabel,
          reason: `Segment slope reaches ${segment.averageSlopeDegrees.toFixed(1)}°, causing elevated metabolic workload and slowed traversal pace.`,
          recommendation: "Increase oxygen reserve allocation and incorporate 5-minute cooling pauses every 250m.",
          confidence: 0.88,
          sourceType: "DERIVED",
          evidence: [
            {
              id: `ev-slope-${segment.id}`,
              description: `Segment average slope reaches ${segment.averageSlopeDegrees.toFixed(1)}°`,
              dataset: "Derived MOLA Altimetry",
              observedMetric: `Slope: ${segment.averageSlopeDegrees.toFixed(1)}°`,
              provenance: ProvenanceService.createDerivedProvenance("Segment Slope Calculation", ["MGS MOLA MEGDR"], "arctan(deltaH / dist)"),
            },
          ],
          provenance: ProvenanceService.createDerivedProvenance("Steep Slope Hazard", ["MGS MOLA Altimetry"], "Dynamic incline detection"),
        };
        detectedHazards.push(slopeHazard);
        affectedSegments.push(segLabel);
        reasons.push(slopeHazard.reason);
      }

      // 3. Dynamic descent hazard detection
      if (segment.elevationLossM > 100 && segment.averageSlopeDegrees >= 14) {
        const descentHazard: Hazard = {
          id: `dyn-descent-${segment.id}`,
          name: `High-Risk Descent (-${segment.elevationLossM.toFixed(0)}m @ ${segment.averageSlopeDegrees.toFixed(1)}°)`,
          type: "HIGH_RISK_DESCENT",
          severity: "HIGH",
          location: segment.start,
          affectedRouteSegment: segLabel,
          reason: `Rapid downward descent of ${segment.elevationLossM.toFixed(0)}m vertical at ${segment.averageSlopeDegrees.toFixed(1)}° incline creates regolith slippage risk.`,
          recommendation: "Engage heel-strike stance, verify boot traction, and avoid traversing directly behind lead crewmember.",
          confidence: 0.89,
          sourceType: "DERIVED",
          evidence: [
            {
              id: `ev-descent-${segment.id}`,
              description: `Net descent of ${segment.elevationLossM}m measured over ${segment.distanceKm.toFixed(2)}km`,
              dataset: "Derived MOLA Altimetry",
              observedMetric: `Loss: ${segment.elevationLossM}m`,
              provenance: ProvenanceService.createDerivedProvenance("Descent Hazard", ["MGS MOLA MEGDR"], "Downhill slope delta"),
            },
          ],
          provenance: ProvenanceService.createDerivedProvenance("High-Risk Descent", ["MGS MOLA Altimetry"], "Downhill traversal assessment"),
        };
        detectedHazards.push(descentHazard);
        affectedSegments.push(segLabel);
        reasons.push(descentHazard.reason);
      }

      // 4. Dynamic large elevation change hazard
      const elevDelta = segment.elevationGainM + segment.elevationLossM;
      if (elevDelta > 150 && segment.distanceKm < 1.0) {
        const dropHazard: Hazard = {
          id: `dyn-drop-${segment.id}`,
          name: `Rapid Topographic Transition (${elevDelta.toFixed(0)}m over ${(segment.distanceKm * 1000).toFixed(0)}m)`,
          type: "LARGE_ELEVATION_CHANGE",
          severity: elevDelta > 250 ? "CRITICAL" : "HIGH",
          location: segment.end,
          affectedRouteSegment: segLabel,
          reason: `Rapid topographic transition of ${elevDelta.toFixed(0)}m vertical in under 1 km.`,
          recommendation: "Ascent/descent safety checks and suit pressure verification required before proceeding.",
          confidence: 0.9,
          sourceType: "DERIVED",
          evidence: [
            {
              id: `ev-drop-${segment.id}`,
              description: `Vertical relief delta of ${elevDelta.toFixed(0)}m within 1000m baseline`,
              dataset: "Derived MOLA Altimetry",
              observedMetric: `Delta: ${elevDelta.toFixed(0)}m`,
              provenance: ProvenanceService.createDerivedProvenance("Large Elevation Change", ["MGS MOLA MEGDR"], "Vertical gradient"),
            },
          ],
          provenance: ProvenanceService.createDerivedProvenance("Large Elevation Change", ["MGS MOLA Altimetry"], "Topographic transition"),
        };
        detectedHazards.push(dropHazard);
        affectedSegments.push(segLabel);
        reasons.push(dropHazard.reason);
      }
    }

    // 5. Aggregate hazard score (0 to 100)
    for (const h of detectedHazards) {
      let weight = 15;
      if (h.severity === "MODERATE") weight = 25;
      if (h.severity === "HIGH") weight = 45;
      if (h.severity === "CRITICAL") weight = 70;
      highestSeverityScore = Math.min(100, highestSeverityScore + weight);
    }

    let riskLevel: HazardSeverity = "LOW";
    if (highestSeverityScore >= 70 || detectedHazards.some((h) => h.severity === "CRITICAL")) {
      riskLevel = "CRITICAL";
    } else if (highestSeverityScore >= 40 || detectedHazards.some((h) => h.severity === "HIGH")) {
      riskLevel = "HIGH";
    } else if (highestSeverityScore >= 20 || detectedHazards.some((h) => h.severity === "MODERATE")) {
      riskLevel = "MODERATE";
    }

    const uniqueSegments = Array.from(new Set(affectedSegments));
    const uniqueReasons = Array.from(new Set(reasons));
    const uniqueMitigations = Array.from(new Set(mitigationSuggestions));

    return {
      hazardScore: highestSeverityScore,
      riskLevel,
      hazards: detectedHazards,
      affectedSegments: uniqueSegments,
      reasons: uniqueReasons,
      mitigationSuggestions: uniqueMitigations,
      provenance: ProvenanceService.createDerivedProvenance(
        "Route Hazard Assessment",
        ["NASA Documented Geological Catalog", "MOLA Dynamic Slope Gradients"],
        "Spatial proximity buffer intersection and slope limit evaluations"
      ),
    };
  }

  public assessPointHazards(coord: MarsCoordinate): HazardAssessment {
    const terrain = terrainEngine.assessPoint(coord);
    const hazards: Hazard[] = [];

    for (const h of DOCUMENTED_MARS_HAZARDS) {
      const dKm = calculateMarsDistanceKm(coord, h.location);
      if (dKm <= ((h.radiusM || 500) + 200) / 1000) {
        hazards.push(h);
      }
    }

    if (terrain.maxSlopeDeg > 18) {
      hazards.push({
        id: "dyn-point-slope",
        name: `High Local Incline (${terrain.maxSlopeDeg}°)`,
        type: terrain.maxSlopeDeg > 22 ? "EXTREME_SLOPE" : "STEEP_SLOPE",
        severity: terrain.maxSlopeDeg > 22 ? "CRITICAL" : "HIGH",
        location: coord,
        reason: `Local 4-point slope gradient is ${terrain.maxSlopeDeg}°.`,
        confidence: 0.88,
        sourceType: "DERIVED",
        evidence: [
          {
            id: "ev-pt-slope",
            description: `4-point finite difference gradient: ${terrain.maxSlopeDeg}°`,
            dataset: "Derived MOLA Altimetry",
            provenance: terrain.provenance || ProvenanceService.createDerivedProvenance("Point Gradient", ["MOLA"], "Finite difference"),
          },
        ],
        provenance: ProvenanceService.createDerivedProvenance("Local Slope Hazard", ["MGS MOLA Altimetry"], "Finite difference gradient"),
      });
    }

    let score = 0;
    for (const h of hazards) {
      if (h.severity === "CRITICAL") score += 60;
      else if (h.severity === "HIGH") score += 35;
      else if (h.severity === "MODERATE") score += 20;
      else score += 10;
    }
    score = Math.min(100, score);

    let riskLevel: HazardSeverity = "LOW";
    if (score >= 60) riskLevel = "CRITICAL";
    else if (score >= 35) riskLevel = "HIGH";
    else if (score >= 15) riskLevel = "MODERATE";

    return {
      hazardScore: score,
      riskLevel,
      hazards,
      affectedSegments: [],
      reasons: hazards.map((h) => h.reason),
      mitigationSuggestions: hazards.map((h) => h.recommendation).filter((r): r is string => Boolean(r)),
      provenance: ProvenanceService.createDerivedProvenance("Point Hazard Assessment", ["MOLA Topography"], "Single-point spatial gradient"),
    };
  }
}

export const hazardEngine = new HazardEngine();
