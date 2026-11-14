import { MarsCoordinate } from "../../types/index.js";
import { planetaryDataService } from "./planetaryDataService.js";
import { atmosphereService, MarsAtmosphericObservation } from "./atmosphereService.js";
import { radiationService, MarsRadiationEnvironment } from "./radiationService.js";
import { spatiotemporalAlignmentService, SpatiotemporalAlignmentResult } from "./spatiotemporalAlignmentService.js";
import { dataUncertaintyService, MeasurementUncertaintyReport } from "./dataUncertaintyService.js";
import { microTerrainService } from "../terrain/microTerrainService.js";
import { AuthenticOpticalProduct, AuthenticThermalProduct, AuthenticStratigraphicUnit, AuthenticSpectralMineralTarget } from "./authenticMarsData.js";

export interface UnifiedScientificDataPoint {
  coordinate: MarsCoordinate;
  topography: {
    elevationM: number;
    slopeDeg?: number;
    uncertaintyM: number;
    dataMode: string;
    source?: string;
    sourceDataset: string;
  };
  optical: {
    productsCount: number;
    highResProducts: AuthenticOpticalProduct[];
    groundRoverPhotos: AuthenticOpticalProduct[];
  };
  thermal: {
    dayTempK?: number;
    nightTempK?: number;
    dayBrightnessTempK: number;
    nightBrightnessTempK: number;
    thermalInertiaSI: number;
    rockAbundancePct: number;
    dustCoverIndex: number;
    profile: AuthenticThermalProduct | null;
  };
  spectralMineralogy: {
    detected: boolean;
    dominantMineralClass: string;
    target?: AuthenticSpectralMineralTarget;
    biosignaturePotential: "EXTREME" | "HIGH" | "MODERATE" | "LOW";
    summary: string;
  };
  mineralogy?: {
    preservationRanking: string;
    detectedMineral: string;
    absorptionBands: string[];
    dominantMineralClass: string;
  };
  geology: {
    unit: string;
    formation: string;
    description: string;
    hardness: number;
    period: string;
    formationCode: string;
    formationName: string;
    geologicalEpoch: string;
    lithology: string;
    rockHardnessMohs: number;
    fractureDensityM2: number;
    traverseObstacleScore: number;
    unitData?: AuthenticStratigraphicUnit;
  };
  geophysicalSubsurface: {
    iceDetected: boolean;
    dielectricPermittivity: number;
    depthToIceMeters: number;
    icePurityPct: number;
    swimIceConsistencyIndex: number;
    isruWaterExtractionPotential: "EXCELLENT" | "MODERATE" | "POOR" | "NEGLIGIBLE";
    summary: string;
  };
  subsurfaceIce?: {
    dielectricPermittivity: number;
    swimConsistencyIndex: number;
    iceDetected: boolean;
    depthToIceMeters: number;
    icePurityPct: number;
  };
  microTerrain?: {
    rockDensityFraction: number;
    boulderDensityPer100m2: number;
    bouldersOverOneMeterPer100m2: number;
    traversabilityIndex: number;
    scarpReposeSafetyMarginDeg: number;
    scarpHazardLevel: string;
    regolithSinkagePotentialCm: number;
    entrapmentRiskLevel: string;
  };
  atmospheric: MarsAtmosphericObservation;
  radiation: MarsRadiationEnvironment;
  alignment: SpatiotemporalAlignmentResult;
  uncertainty: MeasurementUncertaintyReport;
  retrievedAt: string;
}

/**
 * Unified Multi-Mission Scientific Data Layer (Item 10)
 * Integrates 8 distinct scientific modalities into a single geographically consistent point query.
 */
export class UnifiedScienceLayerService {
  /**
   * Generates a fully fused 8-modality planetary profile at any coordinate
   */
  public async queryPoint(
    coord: MarsCoordinate,
    sol = 100,
    localTimeHours = 13.5
  ): Promise<UnifiedScientificDataPoint> {
    // 1. Topography & Local Slope Estimation
    const elev = await planetaryDataService.getElevation(coord);
    const delta = 0.005; // ~300m sampling step
    const elevNorth = await planetaryDataService.getElevation({ latitude: coord.latitude + delta, longitude: coord.longitude });
    const elevSouth = await planetaryDataService.getElevation({ latitude: coord.latitude - delta, longitude: coord.longitude });
    const elevEast = await planetaryDataService.getElevation({ latitude: coord.latitude, longitude: coord.longitude + delta });
    const elevWest = await planetaryDataService.getElevation({ latitude: coord.latitude, longitude: coord.longitude - delta });
    const dLatM = (elevNorth.elevationM - elevSouth.elevationM) / 600;
    const dLonM = (elevEast.elevationM - elevWest.elevationM) / 600;
    const gradient = Math.sqrt(dLatM * dLatM + dLonM * dLonM);
    const slopeDeg = Math.min(32.0, Math.max(1.2, Number((Math.atan(gradient) * (180 / Math.PI)).toFixed(1))));

    // 2. Optical Imagery & Ground Photos
    const opticalProds = planetaryDataService.getOpticalImagery(coord, 25.0);
    const surfacePhotos = planetaryDataService.getSurfacePhotos(coord, 15.0);

    // 3. Thermal Context
    const thermal = planetaryDataService.getThermalContext(coord);
    const dayTemp = thermal.profile?.themisDayIRBrightnessTempK ?? thermal.themisCoverage.brightnessTempK;
    const nightTemp = thermal.profile?.themisNightIRBrightnessTempK ?? Math.round(thermal.themisCoverage.brightnessTempK - 85);
    const ti = thermal.profile?.thermalInertiaSI ?? thermal.themisCoverage.thermalInertiaJ;
    const rockPct = thermal.profile ? Math.round(thermal.profile.rockAbundanceFraction * 100) : (thermal.themisCoverage.rockAbundancePct ?? 15);

    // 4. Spectral Mineralogy
    const min = planetaryDataService.getMineralogy(coord);

    // 5. Geology & Stratigraphy
    const geo = planetaryDataService.getGeology(coord);

    // 6. Geophysical Subsurface Ice
    const sub = planetaryDataService.getSubsurfaceIce(coord);

    // 7. Micro-Terrain Obstacle Analysis (Golombek Model)
    const micro = await microTerrainService.evaluateMicroTerrain(coord, slopeDeg);

    // 8. Atmospheric Weather
    const atmo = atmosphereService.getAtmosphericConditions(coord, sol, localTimeHours);

    // 9. Space Weather & Radiation
    const rad = radiationService.getRadiationEnvironment(coord, elev.elevationM);

    // 10. Spatiotemporal Alignment
    const align = spatiotemporalAlignmentService.alignMultiMissionObservations(coord, sol);

    // 11. Data Uncertainty & Validation
    const uncert = dataUncertaintyService.generateUncertaintyReport(
      coord,
      elev.elevationM,
      ti,
      atmo.surfacePressurePa,
      rad.totalDoseRateMicroSvPerHour
    );

    return {
      coordinate: { ...coord },
      topography: {
        elevationM: elev.elevationM,
        slopeDeg: slopeDeg,
        uncertaintyM: elev.uncertaintyM,
        dataMode: elev.dataMode,
        source: String(elev.provenance.datasetId || "MGS MOLA MEGDR"),
        sourceDataset: String(elev.provenance.datasetId || "MGS MOLA MEGDR"),
      },
      optical: {
        productsCount: opticalProds.length,
        highResProducts: opticalProds,
        groundRoverPhotos: surfacePhotos,
      },
      thermal: {
        dayTempK: dayTemp,
        nightTempK: nightTemp,
        dayBrightnessTempK: dayTemp,
        nightBrightnessTempK: nightTemp,
        thermalInertiaSI: ti,
        rockAbundancePct: rockPct,
        dustCoverIndex: thermal.profile?.dustCoverIndex ?? 0.35,
        profile: thermal.profile,
      },
      spectralMineralogy: {
        detected: min.detected,
        dominantMineralClass: min.dominantMineralClass,
        target: min.target,
        biosignaturePotential: min.biosignaturePotential,
        summary: min.summary,
      },
      mineralogy: {
        preservationRanking: min.biosignaturePotential,
        detectedMineral: min.target?.primaryMinerals[0]?.name || min.dominantMineralClass,
        absorptionBands: min.target?.primaryMinerals[0]?.absorptionBandsMicrons?.map((b) => `${b} μm`) || ["0.53 μm", "1.9 μm", "2.3 μm"],
        dominantMineralClass: min.dominantMineralClass,
      },
      geology: {
        unit: geo.unit.code,
        formation: geo.unit.name,
        description: geo.unit.description,
        hardness: geo.unit.rockHardnessMohs,
        period: geo.unit.geologicalEpoch,
        formationCode: geo.unit.code,
        formationName: geo.unit.name,
        geologicalEpoch: geo.unit.geologicalEpoch,
        lithology: geo.unit.lithology,
        rockHardnessMohs: geo.unit.rockHardnessMohs,
        fractureDensityM2: geo.unit.fractureDensityM2,
        traverseObstacleScore: geo.unit.traverseObstacleScore,
        unitData: geo.unit,
      },
      geophysicalSubsurface: {
        iceDetected: sub.iceDetected,
        dielectricPermittivity: sub.dielectricPermittivity,
        depthToIceMeters: sub.depthToIceMeters,
        icePurityPct: sub.icePurityPct,
        swimIceConsistencyIndex: sub.swimIceConsistencyIndex,
        isruWaterExtractionPotential: sub.isruWaterExtractionPotential,
        summary: sub.summary,
      },
      subsurfaceIce: {
        dielectricPermittivity: sub.dielectricPermittivity,
        swimConsistencyIndex: sub.swimIceConsistencyIndex,
        iceDetected: sub.iceDetected,
        depthToIceMeters: sub.depthToIceMeters,
        icePurityPct: sub.icePurityPct,
      },
      microTerrain: {
        rockDensityFraction: micro.golombekRockDistribution.cumulativeRockCoverFraction,
        boulderDensityPer100m2: micro.golombekRockDistribution.bouldersOverHalfMeterPer100m2,
        bouldersOverOneMeterPer100m2: micro.golombekRockDistribution.bouldersOverOneMeterPer100m2,
        traversabilityIndex: micro.golombekRockDistribution.traversabilityIndex,
        scarpReposeSafetyMarginDeg: micro.scarpAndSlopeHazards.reposeAngleMarginDegrees,
        scarpHazardLevel: micro.scarpAndSlopeHazards.scarpHazardLevel,
        regolithSinkagePotentialCm: micro.looseRegolithEntrapment.estimatedWheelOrBootSinkageCm,
        entrapmentRiskLevel: micro.looseRegolithEntrapment.entrapmentRiskLevel,
      },
      atmospheric: atmo,
      radiation: rad,
      alignment: align,
      uncertainty: uncert,
      retrievedAt: new Date().toISOString(),
    };
  }
}

export const unifiedScienceLayerService = new UnifiedScienceLayerService();
