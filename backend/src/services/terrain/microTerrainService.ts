import { MarsCoordinate } from "../../types/index.js";
import { planetaryDataService } from "../planetary/planetaryDataService.js";

export interface MicroTerrainObstacleProfile {
  coordinate: MarsCoordinate;
  golombekRockDistribution: {
    cumulativeRockCoverFraction: number; // 0.0 to 1.0 (Golombek et al. 2003)
    bouldersOverHalfMeterPer100m2: number;
    bouldersOverOneMeterPer100m2: number;
    traversabilityIndex: number; // 0 (impassable boulder field) to 100 (smooth bedrock pavement)
  };
  scarpAndSlopeHazards: {
    slopeDegrees: number;
    scarpHazardLevel: "SAFE" | "CAUTION" | "HIGH_SLIP" | "CRITICAL_AVALANCHE";
    reposeAngleMarginDegrees: number; // Repose angle on Mars is ~34 degrees
    switchbackRecommended: boolean;
  };
  looseRegolithEntrapment: {
    thermalInertiaSI: number;
    dustCoverIndex: number;
    entrapmentRiskLevel: "NEGLIGIBLE" | "MODERATE" | "HIGH_DUNE_DRIFT" | "PURGATORY_ANALOG";
    estimatedWheelOrBootSinkageCm: number;
  };
  geologicalContactProximityMeters: number;
  summary: string;
}

/**
 * Micro-Terrain & Localized Obstacle Analysis Engine (Item 16)
 * Implements Golombek rock size-frequency distributions, repose angle scarp stability,
 * and loose regolith sinkage modeling.
 */
export class MicroTerrainService {
  /**
   * Evaluates localized obstacles, rock size-frequency distributions, and slip hazards
   */
  public async evaluateMicroTerrain(
    coord: MarsCoordinate,
    slopeDegrees = 6.5
  ): Promise<MicroTerrainObstacleProfile> {
    const thermal = planetaryDataService.getThermalContext(coord);
    const ti = thermal.profile?.thermalInertiaSI ?? thermal.themisCoverage.thermalInertiaJ;
    const dust = thermal.profile?.dustCoverIndex ?? 0.35;
    const geo = planetaryDataService.getGeology(coord);

    // 1. Golombek Rock Size-Frequency Distribution (Golombek & Rapp 1997, Golombek et al. 2003, 2008)
    // Cumulative fractional area k covered by rocks: N(D) = k * exp(-q * D)
    // Typically k ranges from 0.03 (fine plains) to 0.35 (ejecta blankets)
    let k = 0.08;
    if (ti > 400 || geo.unit.code === "Hdt" || geo.unit.code === "Hdf") {
      k = 0.22; // High rock abundance on delta tops and scarp talus
    } else if (ti < 200) {
      k = 0.03; // Eolian dunes have low surface rock coverage
    }

    const q = 1.79; // Standard Golombek decay parameter
    // Rock density per 100 m²:
    const rocksOverHalfMeter = Number((k * 100 * Math.exp(-q * 0.5) * 4.2).toFixed(2));
    const rocksOverOneMeter = Number((k * 100 * Math.exp(-q * 1.0) * 1.8).toFixed(2));

    let traversability = 100 - k * 180 - (slopeDegrees > 15 ? (slopeDegrees - 15) * 4.0 : 0);
    traversability = Math.max(10, Math.min(98, Math.round(traversability)));

    // 2. Scarp & Repose Angle Hazard:
    // Angle of repose for dry Martian basaltic regolith is ~34.0 degrees
    const reposeAngle = 34.0;
    const reposeMargin = Number((reposeAngle - slopeDegrees).toFixed(1));

    let scarpLevel: "SAFE" | "CAUTION" | "HIGH_SLIP" | "CRITICAL_AVALANCHE" = "SAFE";
    if (slopeDegrees >= 30.0) scarpLevel = "CRITICAL_AVALANCHE";
    else if (slopeDegrees >= 18.0) scarpLevel = "HIGH_SLIP";
    else if (slopeDegrees >= 12.0) scarpLevel = "CAUTION";

    const switchback = slopeDegrees >= 14.0;

    // 3. Loose Regolith Sinkage & Entrapment (Opportunity Purgatory Dune Analog)
    let sinkageCm = 2.0; // Baseline firm bedrock/duricrust
    let entrapment: "NEGLIGIBLE" | "MODERATE" | "HIGH_DUNE_DRIFT" | "PURGATORY_ANALOG" = "NEGLIGIBLE";

    if (ti < 190 && dust > 0.55) {
      entrapment = "PURGATORY_ANALOG";
      sinkageCm = 16.5; // Deep unconsolidated eolian dust/sand entrapment
    } else if (ti < 240 && dust > 0.40) {
      entrapment = "HIGH_DUNE_DRIFT";
      sinkageCm = 8.5;
    } else if (dust > 0.30) {
      entrapment = "MODERATE";
      sinkageCm = 4.2;
    }

    return {
      coordinate: { ...coord },
      golombekRockDistribution: {
        cumulativeRockCoverFraction: Number(k.toFixed(3)),
        bouldersOverHalfMeterPer100m2: rocksOverHalfMeter,
        bouldersOverOneMeterPer100m2: rocksOverOneMeter,
        traversabilityIndex: traversability,
      },
      scarpAndSlopeHazards: {
        slopeDegrees,
        scarpHazardLevel: scarpLevel,
        reposeAngleMarginDegrees: reposeMargin,
        switchbackRecommended: switchback,
      },
      looseRegolithEntrapment: {
        thermalInertiaSI: ti,
        dustCoverIndex: dust,
        entrapmentRiskLevel: entrapment,
        estimatedWheelOrBootSinkageCm: sinkageCm,
      },
      geologicalContactProximityMeters: geo.distanceToContactMeters ?? 500,
      summary: `Micro-terrain traversability score: ${traversability}/100. Rock cover: ${(k * 100).toFixed(1)}%. Scarp stability: ${scarpLevel} (${slopeDegrees}° slope, ${reposeMargin}° margin to repose angle). Sinkage estimate: ${sinkageCm} cm (${entrapment}).`,
    };
  }
}

export const microTerrainService = new MicroTerrainService();
