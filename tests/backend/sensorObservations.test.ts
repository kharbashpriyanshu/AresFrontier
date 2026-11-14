import { describe, it, expect } from "vitest";
import { SensorNoiseModel } from "../../backend/src/services/sensors/sensorNoiseModel.js";
import { SensorFusionEngine } from "../../backend/src/services/sensors/sensorFusionEngine.js";
import { SensorObservationEngine } from "../../backend/src/services/sensors/sensorObservationEngine.js";
import { ObservationStore } from "../../backend/src/services/sensors/observationStore.js";
import { SensorObservation } from "../../backend/src/types/index.js";

describe("Phase 5: Sensor Observations & Noise Framework", () => {
  it("should generate deterministic laser altimeter readings with bounded uncertainty", () => {
    const trueElev = -2530.0;
    const sim1 = SensorNoiseModel.simulateLaserAltimeter({
      trueElevationM: trueElev,
      rangeM: 20.0,
      quality: "GOOD",
      seedKey: "scout-sol100-pt1",
    });

    const sim2 = SensorNoiseModel.simulateLaserAltimeter({
      trueElevationM: trueElev,
      rangeM: 20.0,
      quality: "GOOD",
      seedKey: "scout-sol100-pt1",
    });

    // Deterministic reproduction given identical seed
    expect(sim1.measuredElevationM).toBe(sim2.measuredElevationM);
    expect(sim1.uncertaintyM).toBe(sim2.uncertaintyM);
    expect(Math.abs(sim1.measuredElevationM - trueElev)).toBeLessThan(1.0);
    expect(sim1.uncertaintyM).toBeGreaterThan(0.05);
  });

  it("should increase uncertainty when sensor quality is degraded and handle invalid quality", () => {
    const good = SensorNoiseModel.simulateLaserAltimeter({
      trueElevationM: -2500,
      rangeM: 30,
      quality: "GOOD",
      seedKey: "kodiak-pt",
    });

    const degraded = SensorNoiseModel.simulateLaserAltimeter({
      trueElevationM: -2500,
      rangeM: 30,
      quality: "DEGRADED",
      seedKey: "kodiak-pt",
    });

    const invalid = SensorNoiseModel.simulateLaserAltimeter({
      trueElevationM: -2500,
      rangeM: 30,
      quality: "INVALID",
      seedKey: "kodiak-pt",
    });

    expect(degraded.uncertaintyM).toBeGreaterThan(good.uncertaintyM);
    expect(Number.isNaN(invalid.measuredElevationM)).toBe(true);
  });

  it("should fuse multiple sensor observations using inverse-variance weighting", () => {
    const coord = { latitude: 18.452, longitude: 77.418 };
    const observations: SensorObservation[] = [
      {
        observationId: "obs-hazcam-1",
        agentId: "agent-rover-01",
        sensorType: "HAZCAM",
        timestamp: new Date().toISOString(),
        location: coord,
        measurement: { parameter: "SLOPE_GRADIENT", value: 21.5, unit: "deg" },
        uncertainty: { absolute: 1.2 },
        provenance: { sourceType: "ROVER", sourceName: "HazCam", dataMode: "SIMULATED" },
        quality: "GOOD",
        processingMethod: "SIMULATED",
      },
      {
        observationId: "obs-hazcam-2",
        agentId: "agent-rover-01",
        sensorType: "HAZCAM",
        timestamp: new Date().toISOString(),
        location: coord,
        measurement: { parameter: "SLOPE_GRADIENT", value: 22.1, unit: "deg" },
        uncertainty: { absolute: 0.8 },
        provenance: { sourceType: "ROVER", sourceName: "StereoCam", dataMode: "SIMULATED" },
        quality: "GOOD",
        processingMethod: "SIMULATED",
      },
      {
        observationId: "obs-alt-1",
        agentId: "agent-rover-01",
        sensorType: "LASER_ALTIMETER",
        timestamp: new Date().toISOString(),
        location: coord,
        measurement: { parameter: "ELEVATION", value: -2520, unit: "m" },
        uncertainty: { absolute: 0.15 },
        provenance: { sourceType: "ROVER", sourceName: "LaserAltimeter", dataMode: "SIMULATED" },
        quality: "GOOD",
        processingMethod: "SIMULATED",
      },
    ];

    const fused = SensorFusionEngine.fuseObservations(observations, coord);

    expect(fused.sensorCount).toBe(3);
    expect(fused.estimatedSlopeDeg).toBeGreaterThan(21.0);
    expect(fused.estimatedSlopeDeg).toBeLessThan(22.5);
    expect(fused.slopeUncertaintyDeg).toBeLessThan(0.8); // Fused variance is smaller than individual variance
    expect(fused.obstacleProbability).toBeGreaterThan(0.8);
    expect(fused.quality).toBe("GOOD");
  });

  it("should sample agent onboard sensors and store in ObservationStore", async () => {
    ObservationStore.clear();
    const coord = { latitude: 18.4447, longitude: 77.4508 };
    const obs = await SensorObservationEngine.sampleAgentSensors("agent-rover-01", coord);

    expect(obs.length).toBeGreaterThanOrEqual(2);
    expect(obs.some((o) => o.sensorType === "LASER_ALTIMETER")).toBe(true);
    expect(obs.some((o) => o.sensorType === "HAZCAM")).toBe(true);
    expect(obs.every((o) => o.provenance.dataMode === "SIMULATED")).toBe(true);

    const stored = ObservationStore.getObservationsForAgent("agent-rover-01");
    expect(stored.length).toBe(obs.length);
  });
});
