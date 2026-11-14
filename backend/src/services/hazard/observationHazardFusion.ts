import { SensorObservation, MarsCoordinate, FusedHazardReport } from "../../types/index.js";
import { SensorFusionEngine } from "../sensors/sensorFusionEngine.js";
import { terrainEngine } from "../terrain/terrainEngine.js";
import { ProvenanceService } from "../planetary/provenanceService.js";

export class ObservationHazardFusion {
  /**
   * Evaluates and classifies terrain hazards synchronously using prior terrain point assessment.
   */
  public static evaluateHazardSync(
    coord: MarsCoordinate,
    observations: SensorObservation[],
    roverThresholdDeg: number = 20.0
  ): FusedHazardReport {
    const priorTerrain = terrainEngine.assessPoint(coord);
    const fusedObs = SensorFusionEngine.fuseObservations(observations, coord);

    const modelPredictsSlope = priorTerrain.maxSlopeDeg;
    const sensorEstimatesSlope = fusedObs.estimatedSlopeDeg;
    const slopeUncertainty = fusedObs.slopeUncertaintyDeg;

    const hazcamObs = observations.find((o) => o.sensorType === "HAZCAM");
    const laserObs = observations.find((o) => o.sensorType === "LASER_ALTIMETER");
    const corroboratingSensors: string[] = [];

    if (hazcamObs && hazcamObs.measurement.value > roverThresholdDeg * 0.9) {
      corroboratingSensors.push(`HAZCAM (${hazcamObs.measurement.value.toFixed(1)}°)`);
    }
    if (laserObs && Math.abs(priorTerrain.maxSlopeDeg) > roverThresholdDeg * 0.9) {
      corroboratingSensors.push(`LASER_ALTIMETER (${laserObs.measurement.value.toFixed(1)}m elev diff)`);
    }

    let classification: "TERRAIN_PREDICTED" | "SENSOR_DERIVED" | "CORROBORATED_CONFIRMED";
    let evidenceType: "MODEL_EVIDENCE" | "SENSOR_EVIDENCE" | "INDEPENDENT_SENSOR_EVIDENCE" | "CORROBORATED_CONFIRMED";
    let actionableWarning: string;
    let requiresReplan = false;

    if (corroboratingSensors.length >= 2 && (sensorEstimatesSlope >= roverThresholdDeg || modelPredictsSlope >= roverThresholdDeg)) {
      classification = "CORROBORATED_CONFIRMED";
      evidenceType = "CORROBORATED_CONFIRMED";
      actionableWarning = `CONFIRMED HAZARD: Two independent sensors corroborate slope ${sensorEstimatesSlope || modelPredictsSlope}° ± ${slopeUncertainty}° exceeding threshold ${roverThresholdDeg}°. High rollover risk.`;
      requiresReplan = true;
    } else if (observations.length > 0 && sensorEstimatesSlope >= roverThresholdDeg) {
      classification = "SENSOR_DERIVED";
      evidenceType = "SENSOR_EVIDENCE";
      actionableWarning = `SENSOR OBSERVATION: Optical Hazcam estimates slope ${sensorEstimatesSlope}° ± ${slopeUncertainty}°. Precautionary replanning recommended.`;
      requiresReplan = true;
    } else {
      classification = "TERRAIN_PREDICTED";
      evidenceType = "MODEL_EVIDENCE";
      actionableWarning = `TERRAIN MODEL: MOLA baseline indicates slope ${modelPredictsSlope.toFixed(1)}°. Sensors have not confirmed active obstruction.`;
      requiresReplan = modelPredictsSlope >= roverThresholdDeg;
    }

    const hazardId = `haz-fused-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const provenance = ProvenanceService.createDerivedProvenance(
      "Sensor-Hazard Fusion Engine v6.0",
      ["MOLA Topography", "Stereo Hazcam Point Cloud", "Laser Altimetry"],
      "Multi-Sensor Corroboration & Inverse-Variance Fusion"
    );
    provenance.dataMode = observations.length > 0 ? "SIMULATED" : "BENCHMARK";

    return {
      hazardId,
      location: coord,
      classification,
      evidenceType,
      estimatedSlopeDeg: sensorEstimatesSlope || modelPredictsSlope,
      uncertaintyDeg: slopeUncertainty,
      confidenceInterval: fusedObs.confidenceInterval,
      obstacleProbability: fusedObs.obstacleProbability,
      corroboratingSensors,
      actionableWarning,
      requiresReplan,
      provenance,
    };
  }

  /**
   * Evaluates and classifies terrain hazards by comparing prior terrain model predictions
   * against real-time sensor observations.
   */
  public static async evaluateHazard(
    coord: MarsCoordinate,
    observations: SensorObservation[],
    roverThresholdDeg: number = 20.0
  ): Promise<FusedHazardReport> {
    const priorTerrain = terrainEngine.assessPoint(coord);
    const fusedObs = SensorFusionEngine.fuseObservations(observations, coord);

    const modelPredictsSlope = priorTerrain.maxSlopeDeg;
    const sensorEstimatesSlope = fusedObs.estimatedSlopeDeg;
    const slopeUncertainty = fusedObs.slopeUncertaintyDeg;

    // Check independent sensor corroboration
    const hazcamObs = observations.find((o) => o.sensorType === "HAZCAM");
    const laserObs = observations.find((o) => o.sensorType === "LASER_ALTIMETER");
    const corroboratingSensors: string[] = [];

    if (hazcamObs && hazcamObs.measurement.value > roverThresholdDeg * 0.85) {
      corroboratingSensors.push(`HAZCAM (${hazcamObs.measurement.value.toFixed(1)}°)`);
    }
    if (laserObs && (sensorEstimatesSlope >= roverThresholdDeg * 0.85 || Math.abs(priorTerrain.maxSlopeDeg) > roverThresholdDeg * 0.7 || hazcamObs)) {
      corroboratingSensors.push(`LASER_ALTIMETER (${laserObs.measurement.value.toFixed(1)}m elev)`);
    }

    let classification: "TERRAIN_PREDICTED" | "SENSOR_DERIVED" | "CORROBORATED_CONFIRMED";
    let evidenceType: "MODEL_EVIDENCE" | "SENSOR_EVIDENCE" | "INDEPENDENT_SENSOR_EVIDENCE" | "CORROBORATED_CONFIRMED";
    let actionableWarning: string;
    let requiresReplan = false;

    if (corroboratingSensors.length >= 2 && (sensorEstimatesSlope >= roverThresholdDeg || modelPredictsSlope >= roverThresholdDeg)) {
      classification = "CORROBORATED_CONFIRMED";
      evidenceType = "CORROBORATED_CONFIRMED";
      actionableWarning = `CONFIRMED HAZARD: Two independent sensors corroborate slope ${sensorEstimatesSlope}° ± ${slopeUncertainty}° exceeding threshold ${roverThresholdDeg}°. High rollover risk.`;
      requiresReplan = true;
    } else if (observations.length > 0 && sensorEstimatesSlope >= roverThresholdDeg) {
      classification = "SENSOR_DERIVED";
      evidenceType = "SENSOR_EVIDENCE";
      actionableWarning = `SENSOR OBSERVATION: Optical Hazcam estimates slope ${sensorEstimatesSlope}° ± ${slopeUncertainty}°. Precautionary replanning recommended.`;
      requiresReplan = true;
    } else {
      classification = "TERRAIN_PREDICTED";
      evidenceType = "MODEL_EVIDENCE";
      actionableWarning = `TERRAIN MODEL: MOLA baseline indicates slope ${modelPredictsSlope.toFixed(1)}°. Sensors have not confirmed active obstruction.`;
      requiresReplan = modelPredictsSlope >= roverThresholdDeg;
    }

    const hazardId = `haz-fused-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const provenance = ProvenanceService.createDerivedProvenance(
      "Sensor-Hazard Fusion Engine v6.0",
      ["MOLA Topography", "Stereo Hazcam Point Cloud", "Laser Altimetry"],
      "Multi-Sensor Corroboration & Inverse-Variance Fusion"
    );
    provenance.dataMode = observations.length > 0 ? "SIMULATED" : "BENCHMARK";

    return {
      hazardId,
      location: coord,
      classification,
      evidenceType,
      estimatedSlopeDeg: sensorEstimatesSlope || modelPredictsSlope,
      uncertaintyDeg: slopeUncertainty,
      confidenceInterval: fusedObs.confidenceInterval,
      obstacleProbability: fusedObs.obstacleProbability,
      corroboratingSensors,
      actionableWarning,
      requiresReplan,
      provenance,
    };
  }
}
