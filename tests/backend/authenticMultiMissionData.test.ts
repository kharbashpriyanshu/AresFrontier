import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../backend/src/app.js";
import { molaProvider } from "../../backend/src/services/planetary/molaProvider.js";
import { hiriseProvider } from "../../backend/src/services/planetary/hiriseProvider.js";
import { themisProvider } from "../../backend/src/services/planetary/themisProvider.js";
import { crismProvider } from "../../backend/src/services/planetary/crismProvider.js";
import { geologyProvider } from "../../backend/src/services/planetary/geologyProvider.js";
import { subsurfaceIceProvider } from "../../backend/src/services/planetary/subsurfaceIceProvider.js";
import { nasaDatasetIngestionService } from "../../backend/src/services/nasa/nasaDatasetIngestionService.js";
import { planetaryDataService } from "../../backend/src/services/planetary/planetaryDataService.js";

describe("Milestone 1 — Authentic NASA Multi-Mission Planetary Datasets (Items 1 - 7)", () => {
  // --------------------------------------------------------------------------
  // Item 1: Multi-Mission Dataset Ingestion
  // --------------------------------------------------------------------------
  it("Item 1: Ingests authentic multi-mission NASA datasets with SHA-256 checksums", () => {
    const datasets = nasaDatasetIngestionService.getIngestedDatasets();
    expect(datasets.length).toBeGreaterThanOrEqual(6);

    const missions = datasets.map((d) => d.mission);
    expect(missions.some((m) => m.includes("Mars Global Surveyor"))).toBe(true);
    expect(missions.some((m) => m.includes("2001 Mars Odyssey"))).toBe(true);
    expect(missions.some((m) => m.includes("Mars Reconnaissance Orbiter"))).toBe(true);
    expect(missions.some((m) => m.includes("USGS"))).toBe(true);

    for (const d of datasets) {
      expect(d.checksumSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(d.boundingBox.minLat).toBeLessThanOrEqual(d.boundingBox.maxLat);
      expect(d.boundingBox.minLon).toBeLessThanOrEqual(d.boundingBox.maxLon);
    }
  });

  // --------------------------------------------------------------------------
  // Item 2: High-Resolution MOLA Gridded Elevation & Bilinear Interpolation
  // --------------------------------------------------------------------------
  it("Item 2: Evaluates high-resolution MOLA/HiRISE DTM with 2D bilinear interpolation", async () => {
    // Octavia Butler Landing site in Jezero
    const jezeroCenter = { latitude: 18.4447, longitude: 77.4508 };
    const elevRes = await planetaryDataService.getElevation(jezeroCenter);

    expect(elevRes.dataMode).toBe("BENCHMARK");
    expect(elevRes.uncertaintyM).toBeLessThanOrEqual(1.0);
    // In Jezero crater floor, elevation is ~ -2500 to -2580m
    expect(elevRes.elevationM).toBeLessThan(-2400);
    expect(elevRes.elevationM).toBeGreaterThan(-2600);

    // Delta scarp higher elevation point to the west
    const scarpPoint = { latitude: 18.4447, longitude: 77.38 };
    const scarpElev = await planetaryDataService.getElevation(scarpPoint);
    // Delta rises relative to the floor
    expect(scarpElev.elevationM).toBeGreaterThan(elevRes.elevationM);

    // Retrieve full 25x25 DTM grid
    const dtmGrid = molaProvider.getHighResDTM("dtm-jezero-delta-001");
    expect(dtmGrid.gridRows).toBe(25);
    expect(dtmGrid.gridCols).toBe(25);
    expect(dtmGrid.elevations.length).toBe(25);
  });

  // --------------------------------------------------------------------------
  // Item 3: High-Resolution Optical Imagery & Surface Rover Photos
  // --------------------------------------------------------------------------
  it("Item 3: Retrieves authentic HiRISE optical products and surface rover photography", () => {
    const jezero = { latitude: 18.4447, longitude: 77.4508 };
    const optical = hiriseProvider.getProductsNear(jezero, 25.0);
    expect(optical.length).toBeGreaterThanOrEqual(2);

    const types = optical.map((p) => p.type);
    expect(types).toContain("HiRISE_DTM");

    // Point of view surface rover photography
    const surfacePhotos = hiriseProvider.getSurfacePhotosNear(jezero, 15.0);
    expect(surfacePhotos.length).toBeGreaterThanOrEqual(1);
    const photo = surfacePhotos[0];
    expect(photo.thumbnailUrl).toContain("photojournal.jpl.nasa.gov");
    expect(photo.mission).toContain("Mars 2020");
    expect(photo.sol).toBeDefined();
  });

  // --------------------------------------------------------------------------
  // Item 4: Actual Thermal Datasets (THEMIS observations)
  // --------------------------------------------------------------------------
  it("Item 4: Provides authentic THEMIS thermal inertia, day/night IR temps, and rock abundance", () => {
    const jezero = { latitude: 18.4447, longitude: 77.4508 };
    const thermal = themisProvider.getCoverage(jezero);

    expect(thermal.rating).toBe("HIGH");
    expect(thermal.thermalInertiaJ).toBeGreaterThan(200);
    expect(thermal.thermalInertiaJ).toBeLessThan(500);
    expect(thermal.rockAbundancePct).toBeDefined();
    expect(thermal.rockAbundancePct).toBeGreaterThan(0);
    expect(thermal.subsurfaceIceDepthCm).toBeGreaterThan(50); // Unstable in equatorial Jezero

    const profile = themisProvider.getThermalProfileNear(jezero);
    expect(profile).not.toBeNull();
    expect(profile?.themisDayIRBrightnessTempK).toBeGreaterThan(profile?.themisNightIRBrightnessTempK!);
  });

  // --------------------------------------------------------------------------
  // Item 5: Actual Spectral & Mineralogical Datasets (CRISM observations)
  // --------------------------------------------------------------------------
  it("Item 5: Identifies authentic CRISM mineralogy, smectite clays, and biosignature preservation", () => {
    const deltaOutcrop = { latitude: 18.438, longitude: 77.418 };
    const result = crismProvider.evaluateMineralogy(deltaOutcrop);

    expect(result.detected).toBe(true);
    expect(result.dominantMineralClass).toBe("Phyllosilicate");
    expect(result.biosignaturePotential).toBe("EXTREME");
    expect(result.summary).toContain("Smectite");
    expect(result.provenance.sourceName).toContain("CRISM");

    const seitah = { latitude: 18.449, longitude: 77.441 };
    const seitahMin = crismProvider.evaluateMineralogy(seitah);
    expect(seitahMin.detected).toBe(true);
    expect(seitahMin.dominantMineralClass).toBe("Olivine");
  });

  // --------------------------------------------------------------------------
  // Item 6: Geological Stratigraphy & USGS Formations
  // --------------------------------------------------------------------------
  it("Item 6: Classifies USGS Jezero/Gale stratigraphic formations, rock hardness, and contacts", () => {
    // Jezero crater floor
    const floorCoord = { latitude: 18.4447, longitude: 77.4508 };
    const floorGeo = geologyProvider.getFormationAtCoordinate(floorCoord);
    expect(floorGeo.unit.code).toBe("Nm"); // Máaz Formation
    expect(floorGeo.unit.rockHardnessMohs).toBe(6.0);
    expect(floorGeo.provenance.datasetId).toContain("USGS-SIM-3464");

    // Delta scarp
    const deltaCoord = { latitude: 18.4447, longitude: 77.41 };
    const deltaGeo = geologyProvider.getFormationAtCoordinate(deltaCoord);
    expect(deltaGeo.unit.code).toBe("Hdf"); // Shenandoah Formation
    expect(deltaGeo.unit.traverseObstacleScore).toBeGreaterThan(80);
    expect(deltaGeo.distanceToContactMeters).toBeDefined();
  });

  // --------------------------------------------------------------------------
  // Item 7: Geophysical & Subsurface-Resource Information (SHARAD Radar & SWIM)
  // --------------------------------------------------------------------------
  it("Item 7: Detects SHARAD dielectric permittivity and SWIM subsurface ice sheets", () => {
    // Utopia Planitia periglacial ice sheet
    const utopia = { latitude: 43.8, longitude: 112.5 };
    const utopiaSub = subsurfaceIceProvider.evaluateSubsurface(utopia);

    expect(utopiaSub.iceDetected).toBe(true);
    // Pure water ice has dielectric permittivity ~3.15 to 3.3
    expect(utopiaSub.dielectricPermittivity).toBeLessThan(3.5);
    expect(utopiaSub.depthToIceMeters).toBeLessThan(3.0);
    expect(utopiaSub.swimIceConsistencyIndex).toBeGreaterThan(0.8);
    expect(utopiaSub.isruWaterExtractionPotential).toBe("EXCELLENT");

    // Jezero Crater (dry basalt)
    const jezero = { latitude: 18.45, longitude: 77.42 };
    const jezeroSub = subsurfaceIceProvider.evaluateSubsurface(jezero);
    expect(jezeroSub.iceDetected).toBe(false);
    expect(jezeroSub.dielectricPermittivity).toBeGreaterThan(6.0); // Basalt
    expect(jezeroSub.isruWaterExtractionPotential).toBe("NEGLIGIBLE");
  });

  // --------------------------------------------------------------------------
  // REST API Endpoints Verification
  // --------------------------------------------------------------------------
  it("REST API: Serves authentic multi-mission endpoints cleanly with 200 OK", async () => {
    const dtmRes = await request(app).get("/api/data/authentic/dtm?region=jezero");
    expect(dtmRes.status).toBe(200);
    expect(dtmRes.body.success).toBe(true);
    expect(dtmRes.body.data.gridRows).toBe(25);

    const optRes = await request(app).get("/api/data/authentic/optical?lat=18.44&lon=77.45");
    expect(optRes.status).toBe(200);
    expect(optRes.body.data.length).toBeGreaterThan(0);

    const photoRes = await request(app).get("/api/data/authentic/surface-photos?lat=18.44&lon=77.45");
    expect(photoRes.status).toBe(200);
    expect(photoRes.body.data.length).toBeGreaterThan(0);

    const thermRes = await request(app).get("/api/data/authentic/thermal?lat=18.44&lon=77.45");
    expect(thermRes.status).toBe(200);
    expect(thermRes.body.data.profile.thermalInertiaSI).toBeGreaterThan(0);

    const minRes = await request(app).get("/api/data/authentic/mineralogy?lat=18.438&lon=77.418");
    expect(minRes.status).toBe(200);
    expect(minRes.body.data.dominantMineralClass).toBe("Phyllosilicate");

    const geoRes = await request(app).get("/api/data/authentic/geology?lat=18.44&lon=77.45");
    expect(geoRes.status).toBe(200);
    expect(geoRes.body.data.unit.code).toBe("Nm");

    const iceRes = await request(app).get("/api/data/authentic/subsurface-ice?lat=43.8&lon=112.5");
    expect(iceRes.status).toBe(200);
    expect(iceRes.body.data.iceDetected).toBe(true);
  });
});
