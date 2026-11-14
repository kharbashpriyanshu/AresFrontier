import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../backend/src/app.js";
import { atmosphereService } from "../../backend/src/services/planetary/atmosphereService.js";
import { radiationService } from "../../backend/src/services/planetary/radiationService.js";
import { spatiotemporalAlignmentService } from "../../backend/src/services/planetary/spatiotemporalAlignmentService.js";
import { dataUncertaintyService } from "../../backend/src/services/planetary/dataUncertaintyService.js";
import { unifiedScienceLayerService } from "../../backend/src/services/planetary/unifiedScienceLayerService.js";

describe("Milestone 2 — Atmosphere, Radiation, Alignment & Unified Scientific Data Layer (Items 8 - 13)", () => {
  const jezeroCoord = { latitude: 18.4447, longitude: 77.4508 };

  // --------------------------------------------------------------------------
  // Item 8: Atmospheric & Environmental Datasets (MEDA / REMS / MCD)
  // --------------------------------------------------------------------------
  it("Item 8: Evaluates diurnal atmospheric pressure, temperatures, and dust optical depth", () => {
    // Dawn conditions (05:30 LMST)
    const dawn = atmosphereService.getAtmosphericConditions(jezeroCoord, 100, 5.5);
    // Afternoon peak conditions (13:30 LMST)
    const afternoon = atmosphereService.getAtmosphericConditions(jezeroCoord, 100, 13.5);

    expect(dawn.surfacePressurePa).toBeGreaterThan(600);
    expect(dawn.surfacePressurePa).toBeLessThan(950);
    expect(afternoon.airTemperatureK).toBeGreaterThan(dawn.airTemperatureK);
    expect(afternoon.groundTemperatureK).toBeGreaterThan(dawn.groundTemperatureK);
    expect(afternoon.dustOpticalDepthTau).toBeGreaterThan(0.2);
    expect(afternoon.dustDevilRisk).toBeDefined();
    expect(afternoon.sourceMission).toContain("MEDA");
  });

  // --------------------------------------------------------------------------
  // Item 9: Radiation & Space Weather (MSL RAD)
  // --------------------------------------------------------------------------
  it("Item 9: Models GCR background, SEP solar flares, and NASA PEL dose budgets", () => {
    const quietRad = radiationService.getRadiationEnvironment(jezeroCoord, -2500, "quiet");
    expect(quietRad.gcrDoseRateMicroSvPerHour).toBeGreaterThan(20);
    expect(quietRad.gcrDoseRateMicroSvPerHour).toBeLessThan(40);
    expect(quietRad.sepDoseRateMicroSvPerHour).toBe(0);
    expect(quietRad.astronautSafetyDirective).toBe("NOMINAL_EVA_PERMITTED");

    // Solar particle event / CME storm
    const stormRad = radiationService.getRadiationEnvironment(jezeroCoord, -2500, "storm");
    expect(stormRad.sepDoseRateMicroSvPerHour).toBeGreaterThan(500);
    expect(stormRad.spaceWeatherStatus).toBe("SOLAR_PARTICLE_EVENT");
    expect(stormRad.astronautSafetyDirective).toBe("ABORT_EVA_SEEK_ROVER_SHIELD");

    // Exposure calculation for a 4-hour EVA
    const exposure = radiationService.calculateEvaExposure(240, quietRad);
    expect(exposure.absorbedDoseMSv).toBeLessThan(0.3); // Safe normal dose
    expect(exposure.acceptable).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Item 11: Spatiotemporal Geodetic Alignment
  // --------------------------------------------------------------------------
  it("Item 11: Converts planetocentric/planetographic coordinates and aligns multi-mission epochs", () => {
    const centricLat = 18.4447;
    const graphicLat = spatiotemporalAlignmentService.planetocentricToPlanetographic(centricLat);
    expect(graphicLat).toBeGreaterThan(centricLat); // Planetographic latitude is slightly higher at mid-latitudes due to polar flattening

    const reversedCentric = spatiotemporalAlignmentService.planetographicToPlanetocentric(graphicLat);
    expect(Math.abs(reversedCentric - centricLat)).toBeLessThan(0.001);

    const alignment = spatiotemporalAlignmentService.alignMultiMissionObservations(jezeroCoord, 100);
    expect(alignment.missionEpochs.length).toBeGreaterThanOrEqual(4);
    expect(alignment.temporalDifferenceYears).toBeGreaterThan(20); // 2001 MGS to 2024+ M2020
    expect(alignment.spatialAlignmentConfidence).toBeGreaterThan(0.95);
  });

  // --------------------------------------------------------------------------
  // Items 12 & 13: Data Provenance & Uncertainty Reporting
  // --------------------------------------------------------------------------
  it("Items 12 & 13: Computes 95% confidence intervals, spatial resolutions, and quality flags", () => {
    const report = dataUncertaintyService.generateUncertaintyReport(
      jezeroCoord,
      -2530,
      345,
      765,
      28.5
    );

    expect(report.overallValidationScore).toBeGreaterThanOrEqual(90);
    expect(report.parameters.length).toBe(4);

    const elevParam = report.parameters.find((p) => p.parameter.includes("Elevation"))!;
    expect(elevParam.confidenceInterval95Pct).not.toBeNull();
    expect(elevParam.confidenceInterval95Pct!.lower).toBeLessThan(-2530);
    expect(elevParam.confidenceInterval95Pct!.upper).toBeGreaterThan(-2530);
    expect(elevParam.spatialResolutionMeters).toBeLessThan(1.0); // High-res HiRISE in Jezero
    expect(elevParam.dataQualityLevel).toBe("MISSION_BENCHMARK_CALIBRATED");
  });

  // --------------------------------------------------------------------------
  // Item 10: Unified Multi-Mission Scientific Data Layer (8 Modalities)
  // --------------------------------------------------------------------------
  it("Item 10: Fuses all 8 modalities into a single geographically consistent point query", async () => {
    const point = await unifiedScienceLayerService.queryPoint(jezeroCoord, 100, 13.5);

    // 1. Topography
    expect(point.topography.elevationM).toBeDefined();
    expect(point.topography.dataMode).toBe("BENCHMARK");

    // 2. Optical
    expect(point.optical.productsCount).toBeGreaterThan(0);
    expect(point.optical.groundRoverPhotos.length).toBeGreaterThan(0);

    // 3. Thermal
    expect(point.thermal.dayBrightnessTempK).toBeGreaterThan(point.thermal.nightBrightnessTempK);
    expect(point.thermal.thermalInertiaSI).toBeGreaterThan(100);

    // 4. Spectral Mineralogy
    expect(point.spectralMineralogy.dominantMineralClass).toBeDefined();

    // 5. Geology
    expect(point.geology.formationCode).toBe("Nm");
    expect(point.geology.rockHardnessMohs).toBe(6.0);

    // 6. Geophysical Subsurface Ice
    expect(point.geophysicalSubsurface.dielectricPermittivity).toBeGreaterThan(0);

    // 7. Atmospheric
    expect(point.atmospheric.surfacePressurePa).toBeGreaterThan(600);
    expect(point.atmospheric.dustOpticalDepthTau).toBeGreaterThan(0);

    // 8. Radiation
    expect(point.radiation.totalDoseRateMicroSvPerHour).toBeGreaterThan(0);

    // Alignment and Uncertainty attached
    expect(point.alignment.spatialAlignmentConfidence).toBeGreaterThan(0.9);
    expect(point.uncertainty.overallValidationScore).toBeGreaterThan(80);
  });

  // --------------------------------------------------------------------------
  // REST API Endpoints Verification
  // --------------------------------------------------------------------------
  it("REST API: Serves atmosphere, radiation, alignment, uncertainty, and unified science layer", async () => {
    const atmoRes = await request(app).get("/api/data/authentic/atmosphere?lat=18.44&lon=77.45");
    expect(atmoRes.status).toBe(200);
    expect(atmoRes.body.data.surfacePressurePa).toBeGreaterThan(600);

    const radRes = await request(app).get("/api/data/authentic/radiation?lat=18.44&lon=77.45&elevation=-2500");
    expect(radRes.status).toBe(200);
    expect(radRes.body.data.gcrDoseRateMicroSvPerHour).toBeGreaterThan(20);

    const alignRes = await request(app).get("/api/data/authentic/spatiotemporal-alignment?lat=18.44&lon=77.45");
    expect(alignRes.status).toBe(200);
    expect(alignRes.body.data.areoidRadiusKm).toBeGreaterThan(3300);

    const uncertRes = await request(app).get("/api/data/authentic/uncertainty-report?lat=18.44&lon=77.45");
    expect(uncertRes.status).toBe(200);
    expect(uncertRes.body.data.overallValidationScore).toBeGreaterThan(80);

    const layerRes = await request(app).get("/api/data/authentic/unified-science-layer?lat=18.44&lon=77.45");
    expect(layerRes.status).toBe(200);
    expect(layerRes.body.metadata.modalitiesCount).toBe(8);
    expect(layerRes.body.data.geology.formationCode).toBe("Nm");
  });
});
