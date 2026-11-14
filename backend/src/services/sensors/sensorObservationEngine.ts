import { SensorObservation, MarsCoordinate, DataProvenance } from "../../types/index.js";
import { SensorRegistry } from "./sensorRegistry.js";
import { SensorNoiseModel } from "./sensorNoiseModel.js";
import { ObservationStore } from "./observationStore.js";
import { terrainEngine } from "../terrain/terrainEngine.js";
import { ProvenanceService } from "../planetary/provenanceService.js";

export class SensorObservationEngine {
  /**
   * Samples all calibrated onboard sensors for an agent at its current physical location.
   */
  public static async sampleAgentSensors(
    agentId: string,
    coord: MarsCoordinate,
    quality: "GOOD" | "DEGRADED" | "INVALID" = "GOOD"
  ): Promise<SensorObservation[]> {
    const specs = SensorRegistry.getSensorsForAgent(agentId);
    const observations: SensorObservation[] = [];
    const timestamp = new Date().toISOString();
    const seedKey = `${agentId}-${coord.latitude.toFixed(4)}-${coord.longitude.toFixed(4)}`;

    // Query true ground topography from MOLA/benchmark
    const trueTerrain = terrainEngine.assessPoint(coord);

    for (const spec of specs) {
      const obsId = `obs-${spec.sensorType.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      if (spec.sensorType === "LASER_ALTIMETER") {
        const sim = SensorNoiseModel.simulateLaserAltimeter({
          trueElevationM: trueTerrain.elevationM,
          rangeM: 25.0,
          quality,
          seedKey,
        });

        const provenance: DataProvenance = ProvenanceService.createDerivedProvenance(
          "Onboard Laser Altimeter Simulation",
          ["MOLA MEGDR 128 px/deg Ground Truth", "Laser Noise Model v5.0"],
          "Gaussian Perturbation Simulation"
        );
        provenance.dataMode = "SIMULATED";

        observations.push({
          observationId: obsId,
          agentId,
          sensorType: "LASER_ALTIMETER",
          timestamp,
          location: coord,
          measurement: {
            parameter: "ELEVATION",
            value: sim.measuredElevationM,
            unit: "m",
          },
          uncertainty: {
            absolute: sim.uncertaintyM,
            confidenceInterval: [
              Number((sim.measuredElevationM - sim.uncertaintyM).toFixed(2)),
              Number((sim.measuredElevationM + sim.uncertaintyM).toFixed(2)),
            ],
          },
          provenance,
          quality,
          processingMethod: "SIMULATED",
        });
      } else if (spec.sensorType === "HAZCAM") {
        const rockDensity = (trueTerrain.roughnessIndex ?? 0.3) > 0.5 ? 0.7 : 0.25;
        const sim = SensorNoiseModel.simulateHazCam({
          trueSlopeDeg: trueTerrain.maxSlopeDeg,
          rockDensity,
          illuminationFactor: 0.9,
          quality,
          seedKey,
        });

        const provenance: DataProvenance = ProvenanceService.createDerivedProvenance(
          "Forward Stereo HazCam Simulation",
          ["Photogrammetric Stereo Vision", "Surface Roughness Model"],
          "Stereo Disparity & Point Cloud Fusion"
        );
        provenance.dataMode = "SIMULATED";

        observations.push({
          observationId: obsId,
          agentId,
          sensorType: "HAZCAM",
          timestamp,
          location: coord,
          measurement: {
            parameter: "SLOPE_GRADIENT",
            value: sim.measuredSlopeDeg,
            unit: "deg",
          },
          uncertainty: {
            absolute: sim.slopeUncertaintyDeg,
            confidenceInterval: [
              Number(Math.max(0, sim.measuredSlopeDeg - sim.slopeUncertaintyDeg).toFixed(2)),
              Number((sim.measuredSlopeDeg + sim.slopeUncertaintyDeg).toFixed(2)),
            ],
          },
          provenance,
          quality,
          processingMethod: "SIMULATED",
        });
      } else if (spec.sensorType === "THERMAL_IR") {
        const sim = SensorNoiseModel.simulateThermalIR({
          terrainClass: trueTerrain.traversalDifficulty || "moderate",
          solarExposure: 0.85,
          timeOfDayHours: 14.5,
          seedKey,
        });

        const provenance: DataProvenance = ProvenanceService.createDerivedProvenance(
          "Ground Thermal Radiometer Model",
          ["THEMIS 100m/px Thermal Baseline"],
          "Radiative Transfer Simulation"
        );
        provenance.dataMode = "SIMULATED";

        observations.push({
          observationId: obsId,
          agentId,
          sensorType: "THERMAL_IR",
          timestamp,
          location: coord,
          measurement: {
            parameter: "SURFACE_TEMPERATURE",
            value: sim.surfaceTempK,
            unit: "K",
          },
          uncertainty: {
            absolute: sim.uncertaintyK,
          },
          provenance,
          quality,
          processingMethod: "SIMULATED",
        });
      } else if (spec.sensorType === "RAMAN_SPECTROMETER") {
        const sim = SensorNoiseModel.simulateRaman({
          mineralClass: "Delta Olivine Cumulate / Carbonate",
          dwellTimeSeconds: 45,
          seedKey,
        });

        const provenance: DataProvenance = ProvenanceService.createDerivedProvenance(
          "Deep-UV Raman Spectrometer Simulation",
          ["CRISM Spectral Signatures", "Mars 2020 SHERLOC Target Data"],
          "Fluorescence Subtraction & Raman Peak Fit"
        );
        provenance.dataMode = "SIMULATED";

        observations.push({
          observationId: obsId,
          agentId,
          sensorType: "RAMAN_SPECTROMETER",
          timestamp,
          location: coord,
          measurement: {
            parameter: "MINERAL_CONFIDENCE",
            value: sim.spectralConfidence,
            unit: "index",
          },
          uncertainty: {
            relative: 0.05,
          },
          provenance,
          quality,
          processingMethod: "SIMULATED",
        });
      }
    }

    // Record in global observation store
    ObservationStore.addObservations(observations);

    return observations;
  }
}
