import { describe, it, expect } from "vitest";
import { ObservationHazardFusion } from "../../backend/src/services/hazard/observationHazardFusion.js";
import { SensorObservation } from "../../backend/src/types/index.js";

describe("Phase 5: Sensor → Hazard Fusion Engine", () => {
  const safeCoord = { latitude: 18.4447, longitude: 77.4508 }; // Jezero flat floor
  const steepCoord = { latitude: 18.452, longitude: 77.418 }; // Kodiak delta scarp

  it("should classify prior terrain predictions as TERRAIN_PREDICTED when no sensor observations are available", async () => {
    const report = await ObservationHazardFusion.evaluateHazard(safeCoord, [], 20.0);

    expect(report.classification).toBe("TERRAIN_PREDICTED");
    expect(report.corroboratingSensors.length).toBe(0);
    expect(report.actionableWarning).toContain("TERRAIN MODEL");
    expect(report.provenance.dataMode).toBe("BENCHMARK");
  });

  it("should classify single sensor observation as SENSOR_DERIVED", async () => {
    const observations: SensorObservation[] = [
      {
        observationId: "obs-hazcam-single",
        agentId: "agent-rover-01",
        sensorType: "HAZCAM",
        timestamp: new Date().toISOString(),
        location: steepCoord,
        measurement: { parameter: "SLOPE_GRADIENT", value: 21.4, unit: "deg" },
        uncertainty: { absolute: 1.1 },
        provenance: { sourceType: "ROVER", sourceName: "StereoHazCam", dataMode: "SIMULATED" },
        quality: "GOOD",
        processingMethod: "SIMULATED",
      },
    ];

    const report = await ObservationHazardFusion.evaluateHazard(steepCoord, observations, 20.0);

    expect(report.classification).toBe("SENSOR_DERIVED");
    expect(report.corroboratingSensors.length).toBe(1);
    expect(report.requiresReplan).toBe(true);
    expect(report.actionableWarning).toContain("SENSOR OBSERVATION");
  });

  it("should classify dual independent sensor detection as CORROBORATED_CONFIRMED", async () => {
    const observations: SensorObservation[] = [
      {
        observationId: "obs-hazcam-dual",
        agentId: "agent-rover-01",
        sensorType: "HAZCAM",
        timestamp: new Date().toISOString(),
        location: steepCoord,
        measurement: { parameter: "SLOPE_GRADIENT", value: 22.4, unit: "deg" },
        uncertainty: { absolute: 0.9 },
        provenance: { sourceType: "ROVER", sourceName: "HazCam", dataMode: "SIMULATED" },
        quality: "GOOD",
        processingMethod: "SIMULATED",
      },
      {
        observationId: "obs-laser-dual",
        agentId: "agent-rover-01",
        sensorType: "LASER_ALTIMETER",
        timestamp: new Date().toISOString(),
        location: steepCoord,
        measurement: { parameter: "ELEVATION", value: -2515, unit: "m" },
        uncertainty: { absolute: 0.12 },
        provenance: { sourceType: "ROVER", sourceName: "LaserAltimeter", dataMode: "SIMULATED" },
        quality: "GOOD",
        processingMethod: "SIMULATED",
      },
    ];

    const report = await ObservationHazardFusion.evaluateHazard(steepCoord, observations, 20.0);

    expect(report.classification).toBe("CORROBORATED_CONFIRMED");
    expect(report.corroboratingSensors.length).toBeGreaterThanOrEqual(2);
    expect(report.requiresReplan).toBe(true);
    expect(report.actionableWarning).toContain("CONFIRMED HAZARD");
    expect(report.obstacleProbability).toBeGreaterThan(0.8);
  });
});
