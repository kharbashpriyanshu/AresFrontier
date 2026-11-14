import { MarsCoordinate } from "../../types/index.js";
import { planetaryDataService } from "./planetaryDataService.js";
import { atmosphereService, MarsAtmosphericObservation } from "./atmosphereService.js";
import { radiationService, MarsRadiationEnvironment } from "./radiationService.js";
import { spatiotemporalAlignmentService, SpatiotemporalAlignmentResult } from "./spatiotemporalAlignmentService.js";
import { dataUncertaintyService, MeasurementUncertaintyReport } from "./dataUncertaintyService.js";
import { AuthenticOpticalProduct, AuthenticThermalProduct, AuthenticStratigraphicUnit, AuthenticSpectralMineralTarget } from "./authenticMarsData.js";

export interface UnifiedScientificDataPoint {
  coordinate: MarsCoordinate;
  topography: {
    elevationM: number;
    uncertaintyM: number;
    dataMode: string;
    sourceDataset: string;
  };
  optical: {
    productsCount: number;
    highResProducts: AuthenticOpticalProduct[];
    groundRoverPhotos: AuthenticOpticalProduct[];
  };
  thermal: {
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
  geology: {
    formationCode: string;
    formationName: string;
    geologicalEpoch: string;
    lithology: string;
    rockHardnessMohs: number;
    fractureDensityM2: number;
    traverseObstacleScore: number;
    unit: AuthenticStratigraphicUnit;
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
    // 1. Topography
    const elev = await planetaryDataService.getElevation(coord);

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

    // 7. Atmospheric Weather
    const atmo = atmosphereService.getAtmosphericConditions(coord, sol, localTimeHours);

    // 8. Space Weather & Radiation
    const rad = radiationService.getRadiationEnvironment(coord, elev.elevationM);

    // 9. Spatiotemporal Alignment
    const align = spatiotemporalAlignmentService.alignMultiMissionObservations(coord, sol);

    // 10. Data Uncertainty & Validation
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
        uncertaintyM: elev.uncertaintyM,
        dataMode: elev.dataMode,
        sourceDataset: String(elev.provenance.datasetId || "MGS MOLA"),
      },
      optical: {
        productsCount: opticalProds.length,
        highResProducts: opticalProds,
        groundRoverPhotos: surfacePhotos,
      },
      thermal: {
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
      geology: {
        formationCode: geo.unit.code,
        formationName: geo.unit.name,
        geologicalEpoch: geo.unit.geologicalEpoch,
        lithology: geo.unit.lithology,
        rockHardnessMohs: geo.unit.rockHardnessMohs,
        fractureDensityM2: geo.unit.fractureDensityM2,
        traverseObstacleScore: geo.unit.traverseObstacleScore,
        unit: geo.unit,
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
      atmospheric: atmo,
      radiation: rad,
      alignment: align,
      uncertainty: uncert,
      retrievedAt: new Date().toISOString(),
    };
  }
}

export const unifiedScienceLayerService = new UnifiedScienceLayerService();
