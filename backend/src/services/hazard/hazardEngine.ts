import {
  Hazard,
  HazardAssessment,
  HazardSeverity,
  HazardCategory,
  MarsCoordinate,
  MarsRoute,
} from "../../types/index.js";
import { calculateMarsDistanceKm } from "../../utils/marsCoordinates.js";
import { terrainEngine } from "../terrain/terrainEngine.js";
import { ProvenanceService } from "../planetary/provenanceService.js";
import { LineOfSightEngine } from "../comms/lineOfSightEngine.js";
import { OrbitalVisibilityEngine } from "../comms/orbitalVisibilityEngine.js";

export interface RouteHazardContext {
  maxDurationMinutes?: number;
  initialBatteryPercent?: number;
  initialOxygenMinutes?: number;
  agentType?: "ASTRONAUT" | "ROVER";
  baseCoordinate?: MarsCoordinate;
  simulationTimeMinutes?: number;
  sampleTubesAvailable?: number;
  requireContinuousCommunication?: boolean;
}

/**
 * Catalog of known Martian geological and topographic hazards with empirical evidence.
 */
export const DOCUMENTED_MARS_HAZARDS: Hazard[] = [
  {
    id: "hzd-jezero-delta-scarp",
    name: "Jezero Delta Front Scarp",
    type: "SCARP",
    category: "TERRAIN",
    severity: "HIGH",
    location: { latitude: 18.448, longitude: 77.402 },
    radiusM: 450,
    reason: "Steep 60m vertical drop along the western delta front with loose boulder talus.",
    recommendation: "Maintain minimum 100m standoff from cliff edge; descend via mapped gentle ramps only.",
    confidence: 0.95,
    probability: 0.85,
    impactDescription: "Risk of catastrophic vehicle roll-over or astronaut fall down 60m cliff scarp.",
    detectionSource: "MRO HiRISE Stereo DTM & MGS MOLA 128ppd Altimetry",
    provenanceClassification: "MEASURED",
    recommendedMitigation: "Enforce 100m geofenced buffer standoff distance around scarp lip.",
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
    category: "GEOLOGICAL",
    severity: "MODERATE",
    location: { latitude: 18.485, longitude: 77.442 },
    radiusM: 500,
    reason: "Impact rim slope exceeding 16 degrees with perched megabreccia blocks.",
    recommendation: "Avoid traversing directly over perched boulders; follow low-gradient rim gaps.",
    confidence: 0.9,
    probability: 0.65,
    impactDescription: "Elevated motor current draw and increased traction slip on steep impact megabreccia.",
    detectionSource: "MRO CTX & HiRISE Orthomosaic",
    provenanceClassification: "MEASURED",
    recommendedMitigation: "Reduce speed to 0.5 km/h and engage differential wheel locking.",
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
    category: "TERRAIN",
    severity: "MODERATE",
    location: { latitude: 18.428, longitude: 77.482 },
    radiusM: 350,
    reason: "Narrow 80m incised canyon corridor bounded by boulder-mantled bedrock terraces.",
    recommendation: "Establish line-of-sight radio relay at entrance before committing to canyon interior.",
    confidence: 0.92,
    probability: 0.60,
    impactDescription: "RF shadow and loss of direct line-of-sight to base station.",
    detectionSource: "MRO CTX Digital Elevation Model",
    provenanceClassification: "DERIVED",
    recommendedMitigation: "Drop solar-powered radio relay beacon at canyon entrance.",
    sourceType: "NASA",
    evidence: [
      {
        id: "ev-neretva-geometry",
        description: "Incised river cut with 80m channel width and 35m flanking walls",
        dataset: "MRO CTX Digital Elevation Model",
        observedMetric: "Channel Width: 82m",
        provenance: ProvenanceService.createHiriseProvenance("ESP_045860_1985"),
      },
    ],
    uncertainty: {
      absolute: 20,
      unit: "m",
      methodology: "Orthorectified CTX stereo pair extraction",
    },
    provenance: ProvenanceService.createHiriseProvenance("ESP_045860_1985"),
  },
  {
    id: "hzd-seitah-dunes",
    name: "Séítah Eolian Megaripple Field",
    type: "UNSTABLE_REGOLITH",
    category: "GEOLOGICAL",
    severity: "HIGH",
    location: { latitude: 18.435, longitude: 77.44 },
    radiusM: 600,
    reason: "Active transverse eolian megaripples with low-bearing-strength basaltic sand (wheel-sink risk).",
    recommendation: "Bypass transverse sand ridges; traverse only on exposed olivine-carbonate bedrock pavements.",
    confidence: 0.94,
    probability: 0.80,
    impactDescription: "Deep wheel sinkage, excessive motor torque overload, and chassis entrapment.",
    detectionSource: "Mars 2020 Perseverance Rover Navcam / Mastcam-Z",
    provenanceClassification: "MEASURED",
    recommendedMitigation: "Avoid driving over dune crests; route exclusively across bedrock ribbons.",
    sourceType: "NASA",
    evidence: [
      {
        id: "ev-seitah-sinkage",
        description: "Rover wheel slippage exceeding 40% observed during Sol 175 Séítah ingress",
        dataset: "Mars 2020 Engineering Telemetry Archive",
        observedMetric: "Wheel Slip: 42%",
        provenance: ProvenanceService.createRoverProvenance("Perseverance", "Mobility Subsystem", 175),
      },
    ],
    provenance: ProvenanceService.createRoverProvenance("Perseverance", "Mastcam-Z", 175),
  },
  {
    id: "hzd-gale-gillespie-boulders",
    name: "Gillespie Lake Boulder Field",
    type: "ROCK_ABUNDANCE",
    category: "GEOLOGICAL",
    severity: "HIGH",
    location: { latitude: -4.65, longitude: 137.42 },
    radiusM: 400,
    reason: "Dense boulder concentration (>35% CFA rock abundance) exceeding 0.5m wheel-clearance threshold.",
    recommendation: "Throttle maximum speed to 0.4 km/h; utilize Hazcam auto-nav obstacle avoidance.",
    confidence: 0.91,
    probability: 0.75,
    impactDescription: "Chassis underbody high-centering or wheel rim puncture.",
    detectionSource: "MSL Curiosity Rover Mastcam / Navcam",
    provenanceClassification: "MEASURED",
    recommendedMitigation: "Engage autonomous visual odometry and point-by-point rock navigation.",
    sourceType: "NASA",
    evidence: [
      {
        id: "ev-gale-rocks",
        description: "Cumulative Fractional Area (CFA) rock distribution exceeds nominal Mars model",
        dataset: "MSL Mastcam Image Mosaic Sol 3100",
        observedMetric: "Rock Coverage: 38%",
        provenance: ProvenanceService.createRoverProvenance("MSL (Curiosity)", "Mastcam", 3100),
      },
    ],
    provenance: ProvenanceService.createRoverProvenance("MSL (Curiosity)", "Mastcam", 3100),
  },
  {
    id: "hzd-olympus-caldera-fault",
    name: "Olympus Mons Ring Fault System",
    type: "SCARP",
    category: "TERRAIN",
    severity: "CRITICAL",
    location: { latitude: 18.65, longitude: -133.8 },
    radiusM: 1200,
    reason: "Nested collapse cliff with 2 km vertical cliff face.",
    recommendation: "Strict EVA no-traverse zone. Observation from designated vantage point only.",
    confidence: 0.98,
    probability: 0.99,
    impactDescription: "Catastrophic 2000m sheer vertical drop; 100% loss of mission asset upon breach.",
    detectionSource: "MGS MOLA Gridded Elevation Model",
    provenanceClassification: "MEASURED",
    recommendedMitigation: "Hard exclusion boundary: enforce 500m mandatory standoff radius.",
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
    category: "TERRAIN",
    severity: "CRITICAL",
    location: { latitude: -9.8, longitude: -76.5 },
    radiusM: 1500,
    reason: "Catastrophic 3.5 km elevation drop with frequent rockfalls and active landslides.",
    recommendation: "Unfeasible for surface pedestrian EVA. Aerial or tethered traversal only.",
    confidence: 0.96,
    probability: 0.95,
    impactDescription: "Immediate catastrophic descent into canyon chasma; active scree rockfalls.",
    detectionSource: "MGS MOLA / THEMIS Daytime Thermal Infrared",
    provenanceClassification: "MEASURED",
    recommendedMitigation: "Reject ground traverse; consider orbital or tethered drone reconnaissance only.",
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
 * Mars Hazard Engine (WS3 + WS4 Multi-Domain Upgrade)
 * Evaluates Terrain, Geological, Communication, Resource, and Mission Constraint hazards.
 */
export class HazardEngine {
  public getAllHazards(): Hazard[] {
    return [...DOCUMENTED_MARS_HAZARDS];
  }

  /**
   * Assesses hazards along a planned route across all 4 operational domains.
   */
  public assessRouteHazards(route: MarsRoute, context?: RouteHazardContext): HazardAssessment {
    const detectedHazards: Hazard[] = [];
    const affectedSegments: string[] = [];
    const reasons: string[] = [];
    const mitigationSuggestions: string[] = [];

    // =========================================================================
    // DOMAIN 1: Terrain & Geological Hazards
    // =========================================================================

    for (let i = 0; i < route.segments.length; i++) {
      const segment = route.segments[i];
      const segStart = segment.start;
      const segEnd = segment.end;
      const segLabel = `Segment ${i + 1} (${segment.id})`;

      // 1.1 Proximity to documented catalog hazards
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

      // 1.2 Dynamic slope hazard detection
      if (segment.averageSlopeDegrees >= 18) {
        const slopeHazard: Hazard = {
          id: `dyn-slope-crit-${segment.id}`,
          name: `Extreme Incline (${segment.averageSlopeDegrees.toFixed(1)}°)`,
          type: "EXTREME_SLOPE",
          category: "TERRAIN",
          severity: "CRITICAL",
          location: segment.start,
          affectedRouteSegment: segLabel,
          reason: `Measured segment average slope of ${segment.averageSlopeDegrees.toFixed(1)}° approaches safe EVA walking limits (20° astronaut mobility ceiling).`,
          recommendation: "Re-route around ridgeline or engage switchback traverse pattern with mechanical tether support.",
          confidence: 0.91,
          probability: Math.min(1.0, Number((segment.averageSlopeDegrees / 25.0).toFixed(2))),
          impactDescription: "Severe slip risk, rover rollover hazard, and exponential metabolic life-support expenditure.",
          detectionSource: "MGS MOLA Altimetry Gradient Analysis",
          provenanceClassification: "DERIVED",
          recommendedMitigation: "Bypass steep scarp by descending along low-gradient lateral spurs.",
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
          category: "TERRAIN",
          severity: "HIGH",
          location: segment.start,
          affectedRouteSegment: segLabel,
          reason: `Segment slope reaches ${segment.averageSlopeDegrees.toFixed(1)}°, causing elevated metabolic workload and slowed traversal pace.`,
          recommendation: "Increase oxygen reserve allocation and incorporate 5-minute cooling pauses every 250m.",
          confidence: 0.88,
          probability: 0.75,
          impactDescription: "Elevated power consumption (+45%) and metabolic rate acceleration.",
          detectionSource: "MGS MOLA Altimetry",
          provenanceClassification: "DERIVED",
          recommendedMitigation: "Plan tactical pause intervals and limit continuous uphill traversal.",
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

      // 1.3 High-Risk Descent Hazard
      if (segment.elevationLossM > 100 && segment.averageSlopeDegrees >= 14) {
        const descentHazard: Hazard = {
          id: `dyn-descent-${segment.id}`,
          name: `High-Risk Descent (-${segment.elevationLossM.toFixed(0)}m @ ${segment.averageSlopeDegrees.toFixed(1)}°)`,
          type: "HIGH_RISK_DESCENT",
          category: "TERRAIN",
          severity: "HIGH",
          location: segment.start,
          affectedRouteSegment: segLabel,
          reason: `Rapid downward descent of ${segment.elevationLossM.toFixed(0)}m vertical at ${segment.averageSlopeDegrees.toFixed(1)}° incline creates regolith slippage risk.`,
          recommendation: "Engage heel-strike stance, verify boot traction, and avoid traversing directly behind lead crewmember.",
          confidence: 0.89,
          probability: 0.72,
          impactDescription: "Uncontrolled downhill sliding, loose talus displacement, and braking system thermal overload.",
          detectionSource: "Derived MOLA Altimetry",
          provenanceClassification: "DERIVED",
          recommendedMitigation: "Engage dynamic regenerative braking and reduce speed to 1.5 km/h.",
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

      // 1.4 Large Elevation Change
      const elevDelta = segment.elevationGainM + segment.elevationLossM;
      if (elevDelta > 150 && segment.distanceKm < 1.0) {
        const dropHazard: Hazard = {
          id: `dyn-drop-${segment.id}`,
          name: `Rapid Topographic Transition (${elevDelta.toFixed(0)}m over ${(segment.distanceKm * 1000).toFixed(0)}m)`,
          type: "LARGE_ELEVATION_CHANGE",
          category: "TERRAIN",
          severity: elevDelta > 250 ? "CRITICAL" : "HIGH",
          location: segment.end,
          affectedRouteSegment: segLabel,
          reason: `Rapid topographic transition of ${elevDelta.toFixed(0)}m vertical in under 1 km.`,
          recommendation: "Ascent/descent safety checks and suit pressure verification required before proceeding.",
          confidence: 0.9,
          probability: 0.8,
          impactDescription: "Abrupt barometric micro-pressure variance and high energy expenditure.",
          detectionSource: "Derived MOLA Altimetry",
          provenanceClassification: "DERIVED",
          recommendedMitigation: "Verify suit seals and life-support pressure regulators prior to transition.",
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

      // 1.5 Unstable Regolith / Scree
      if (segment.averageSlopeDegrees > 15 && segment.elevationLossM > 50) {
        const regolithHazard: Hazard = {
          id: `dyn-regolith-${segment.id}`,
          name: `Unstable Regolith & Scree Apron (${segLabel})`,
          type: "UNSTABLE_REGOLITH",
          category: "GEOLOGICAL",
          severity: "MODERATE",
          location: segment.start,
          affectedRouteSegment: segLabel,
          reason: `Slope exceeds angle of repose for loose fines (${segment.averageSlopeDegrees.toFixed(1)}°), inducing rolling rock and footing instability.`,
          recommendation: "Probe terrain with geological staff before stepping; maintain 25m crew spacing.",
          confidence: 0.85,
          probability: 0.65,
          impactDescription: "Local scree slippage and micro-landslide displacement.",
          detectionSource: "Topographic Gradient & Soil Mechanics Analogs",
          provenanceClassification: "DERIVED",
          recommendedMitigation: "Follow outcrop bedrock exposures rather than loose gravel talus.",
          sourceType: "DERIVED",
        };
        detectedHazards.push(regolithHazard);
        affectedSegments.push(segLabel);
        reasons.push(regolithHazard.reason);
      }
    }

    // =========================================================================
    // DOMAIN 2: Communication Hazards
    // =========================================================================

    const baseCoord = context?.baseCoordinate || (route.points.length > 0 ? route.points[0].coordinate : { latitude: 18.38, longitude: 77.58 });
    const simTime = context?.simulationTimeMinutes || 48;
    let blackoutDurationMin = 0;
    let maxBlackoutMin = 0;
    let currentBlackoutSegment = 0;

    for (let i = 0; i < route.points.length; i++) {
      const pt = route.points[i];
      const losResult = LineOfSightEngine.calculateLineOfSight(baseCoord, pt.coordinate, 5.0, 2.0);
      const orbWindow = OrbitalVisibilityEngine.calculateVisibility(pt.coordinate, simTime + (i * 15));
      const orbiterActive = orbWindow.state === "PASS_ACTIVE";

      if (!losResult.lineOfSight && !orbiterActive) {
        currentBlackoutSegment += 15; // Assume 15 min per point stride
        blackoutDurationMin += 15;
        if (currentBlackoutSegment > maxBlackoutMin) {
          maxBlackoutMin = currentBlackoutSegment;
        }

        if (currentBlackoutSegment >= 30 || context?.requireContinuousCommunication) {
          const commHazard: Hazard = {
            id: `comm-blackout-${pt.id}`,
            name: `Extended RF Shadow / Communication Blackout (${pt.label})`,
            type: "COMMUNICATION_BLACKOUT",
            category: "COMMUNICATION",
            severity: context?.requireContinuousCommunication || currentBlackoutSegment >= 45 ? "CRITICAL" : "HIGH",
            location: pt.coordinate,
            reason: `Route point '${pt.label}' has no direct line-of-sight to Base Relay and no active MRO orbital pass window. Blackout duration: ${currentBlackoutSegment} min.`,
            recommendation: "Stage mobile relay rover 'agent-rover-03' on intermediate ridge or reschedule traverse to coincide with orbital pass.",
            confidence: 0.94,
            probability: 0.95,
            impactDescription: "Loss of real-time telemetry, emergency SOS transmission, and command link.",
            detectionSource: "Physical Line-of-Sight & Orbital Visibility Engine",
            provenanceClassification: "DERIVED",
            recommendedMitigation: "Deploy autonomous comms relay repeater or buffer science data locally.",
            sourceType: "DERIVED",
          };
          detectedHazards.push(commHazard);
          reasons.push(commHazard.reason);
          mitigationSuggestions.push(commHazard.recommendation!);
        }
      } else {
        currentBlackoutSegment = 0;
      }
    }

    // =========================================================================
    // DOMAIN 3: Resource Hazards
    // =========================================================================

    // Energy consumption physics model:
    // Base Wh/km: 100 Wh/km (rover) or 120 Wh/km (astronaut UTV/life-support)
    const baseRateWhKm = context?.agentType === "ASTRONAUT" ? 120 : 100;
    let totalEnergyWh = 0;

    for (const seg of route.segments) {
      const slopeFactor = 1.0 + Math.pow(seg.averageSlopeDegrees / 15.0, 2);
      const elevClimbWh = seg.elevationGainM * 0.15; // climbing energy
      const segEnergy = seg.distanceKm * baseRateWhKm * slopeFactor + elevClimbWh;
      totalEnergyWh += segEnergy;
    }

    // Add science points instrument power (20 Wh per point)
    const sciencePointsCount = route.points.filter((p) => p.type === "science").length;
    totalEnergyWh += sciencePointsCount * 20;

    const batteryPackCapacityWh = 1200; // Standard 1.2 kWh Martian expedition battery
    const initialSoc = context?.initialBatteryPercent ?? 85.0;
    const initialWh = (initialSoc / 100.0) * batteryPackCapacityWh;
    const remainingWh = initialWh - totalEnergyWh;
    const projectedSocPercent = Number(((remainingWh / batteryPackCapacityWh) * 100.0).toFixed(1));
    const minReservePercent = 20.0; // Safety Invariant S1

    if (projectedSocPercent < minReservePercent) {
      const batteryHazard: Hazard = {
        id: `res-battery-deficit-${route.id}`,
        name: `Critical Battery Reserve Breach (Projected: ${projectedSocPercent}%)`,
        type: "LOW_BATTERY_RESERVE",
        category: "RESOURCE",
        severity: "CRITICAL",
        location: route.points[route.points.length - 1]?.coordinate || baseCoord,
        reason: `Estimated traverse energy expenditure (${Math.round(totalEnergyWh)} Wh) depletes battery to ${projectedSocPercent}%, breaching the 20% minimum safety return floor (Invariant S1).`,
        recommendation: "Shorten route, omit secondary science stops, or recharge asset prior to mission departure.",
        confidence: 0.95,
        probability: 0.98,
        impactDescription: "Depletion of primary mobility battery, potential vehicle freezing, and asset stranding.",
        detectionSource: "Physical Terramechanics Energy Expenditure Model",
        provenanceClassification: "PREDICTED",
        recommendedMitigation: "Enforce battery cutoff threshold at 25% to reserve emergency return power.",
        sourceType: "DERIVED",
      };
      detectedHazards.push(batteryHazard);
      reasons.push(batteryHazard.reason);
      mitigationSuggestions.push(batteryHazard.recommendation!);
    } else if (projectedSocPercent < 30.0) {
      const lowBattHazard: Hazard = {
        id: `res-battery-warn-${route.id}`,
        name: `Low Projected Battery Reserve (${projectedSocPercent}%)`,
        type: "LOW_BATTERY_RESERVE",
        category: "RESOURCE",
        severity: "HIGH",
        location: route.points[route.points.length - 1]?.coordinate || baseCoord,
        reason: `Projected battery level at destination (${projectedSocPercent}%) leaves narrow margin above the 20% emergency reserve.`,
        recommendation: "Monitor motor draw closely; restrict high-speed driving mode.",
        confidence: 0.9,
        probability: 0.7,
        impactDescription: "Reduced operational margin for unforeseen detours or obstacles.",
        detectionSource: "Physical Energy Expenditure Model",
        provenanceClassification: "PREDICTED",
        recommendedMitigation: "Optimize speed and avoid deep sand corridors.",
        sourceType: "DERIVED",
      };
      detectedHazards.push(lowBattHazard);
      reasons.push(lowBattHazard.reason);
    }

    // Sample storage capacity
    if (context?.sampleTubesAvailable !== undefined && sciencePointsCount > context.sampleTubesAvailable) {
      const storageHazard: Hazard = {
        id: `res-sample-deficit-${route.id}`,
        name: `Sample Storage Capacity Exceeded (${sciencePointsCount} targets vs ${context.sampleTubesAvailable} tubes)`,
        type: "SAMPLE_STORAGE_EXCEEDED",
        category: "RESOURCE",
        severity: "HIGH",
        location: baseCoord,
        reason: `Planned route visits ${sciencePointsCount} science targets, but only ${context.sampleTubesAvailable} sample collection tubes are currently available in rover carousel.`,
        recommendation: "Prioritize prime astrobiological samples and designate secondary targets for non-contact spectrometry only.",
        confidence: 1.0,
        probability: 1.0,
        impactDescription: "Inability to cache physical rock cores for Mars Sample Return.",
        detectionSource: "Rover Sample Caching Subsystem Status",
        provenanceClassification: "MEASURED",
        recommendedMitigation: "Unload full sample tubes at base or reconfigure drill carousel.",
        sourceType: "NASA",
      };
      detectedHazards.push(storageHazard);
      reasons.push(storageHazard.reason);
    }

    // Oxygen & Life-support constraints (for astronaut EVA)
    const maxDurationLimit = context?.maxDurationMinutes ?? 180;
    const initialO2Min = context?.initialOxygenMinutes ?? 240;
    const requiredO2Min = route.estimatedDurationMinutes + 30; // 30 min mandatory safety margin

    if (requiredO2Min > initialO2Min) {
      const o2Hazard: Hazard = {
        id: `res-o2-breach-${route.id}`,
        name: `Life-Support Oxygen Depletion Risk (${route.estimatedDurationMinutes} min duration + 30 min margin > ${initialO2Min} min available)`,
        type: "INSUFFICIENT_OXYGEN",
        category: "RESOURCE",
        severity: "CRITICAL",
        location: route.points[0]?.coordinate || baseCoord,
        reason: `Total EVA time (${route.estimatedDurationMinutes} min) plus NASA 30-min return reserve (${requiredO2Min} min) exceeds suit consumable supply (${initialO2Min} min).`,
        recommendation: "Truncate traverse itinerary or assign uncrewed robotic asset for distant waypoints.",
        confidence: 0.98,
        probability: 0.99,
        impactDescription: "Hypoxia and life-support asphyxiation hazard for EVA crewmember.",
        detectionSource: "Astronaut Suit Biotelemetry & Consumable Engine",
        provenanceClassification: "PREDICTED",
        recommendedMitigation: "Enforce strict 180-min abort rule regardless of science objectives.",
        sourceType: "DERIVED",
      };
      detectedHazards.push(o2Hazard);
      reasons.push(o2Hazard.reason);
      mitigationSuggestions.push(o2Hazard.recommendation!);
    }

    // =========================================================================
    // DOMAIN 4: Mission Constraint Hazards
    // =========================================================================

    if (route.estimatedDurationMinutes > maxDurationLimit) {
      const deadlineHazard: Hazard = {
        id: `mc-deadline-breach-${route.id}`,
        name: `Mission Timeline Constraint Exceeded (${route.estimatedDurationMinutes} min > ${maxDurationLimit} min)`,
        type: "MISSION_DEADLINE_BREACH",
        category: "MISSION_CONSTRAINT",
        severity: "CRITICAL",
        location: baseCoord,
        reason: `Estimated traverse duration (${route.estimatedDurationMinutes} min) exceeds maximum permitted EVA ceiling of ${maxDurationLimit} minutes.`,
        recommendation: "Prune intermediate waypoints or utilize motorized UTV rover escort.",
        confidence: 0.96,
        probability: 0.98,
        impactDescription: "Violates NASA EVA operational rules; mission failure.",
        detectionSource: "Mission Operational Timeline Engine",
        provenanceClassification: "PREDICTED",
        recommendedMitigation: "Reroute along direct primary transit vectors only.",
        sourceType: "DERIVED",
      };
      detectedHazards.push(deadlineHazard);
      reasons.push(deadlineHazard.reason);
    }

    if (route.maxSlopeDegrees > 20 && context?.agentType === "ASTRONAUT") {
      const agentMismatchHazard: Hazard = {
        id: `mc-agent-mismatch-${route.id}`,
        name: `Astronaut Physical Walking Limit Exceeded (${route.maxSlopeDegrees.toFixed(1)}° > 20°)`,
        type: "AGENT_CAPABILITY_MISMATCH",
        category: "MISSION_CONSTRAINT",
        severity: "CRITICAL",
        location: route.points[0]?.coordinate || baseCoord,
        reason: `Maximum route incline of ${route.maxSlopeDegrees.toFixed(1)}° exceeds the 20.0° maximum mobility ceiling for spacesuit-encumbered astronaut walking.`,
        recommendation: "Deploy robotic scout rover 'agent-rover-01' or utilize mechanical ascender rig.",
        confidence: 0.95,
        probability: 0.92,
        impactDescription: "Loss of crew balance, suit puncture against sharp rocks, or cardiovascular exhaustion.",
        detectionSource: "Astronaut Biomechanics Mobility Model",
        provenanceClassification: "DERIVED",
        recommendedMitigation: "Restrict human EVA crew to slopes strictly below 18°.",
        sourceType: "DERIVED",
      };
      detectedHazards.push(agentMismatchHazard);
      reasons.push(agentMismatchHazard.reason);
    }

    // =========================================================================
    // Aggregate Scoring & Risk Level Determination
    // =========================================================================

    let highestSeverityScore = 0;
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
        "Multi-Domain Hazard Assessment v4.0",
        ["NASA Documented Geological Catalog", "MOLA Dynamic Slope Gradients", "Line-of-Sight Engine", "Energy Model"],
        "Spatial proximity buffer intersection, RF line-of-sight propagation, and physical energy expenditure"
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
        category: "TERRAIN",
        severity: terrain.maxSlopeDeg > 22 ? "CRITICAL" : "HIGH",
        location: coord,
        reason: `Local 4-point slope gradient is ${terrain.maxSlopeDeg}°.`,
        confidence: 0.88,
        probability: 0.8,
        impactDescription: "Local traction loss and steep slope slip risk.",
        detectionSource: "Derived MOLA Altimetry",
        provenanceClassification: "DERIVED",
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
