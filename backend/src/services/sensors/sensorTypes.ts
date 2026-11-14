import { SensorType, SensorObservation, MarsCoordinate, DataProvenance } from "../../types/index.js";

export { SensorType, SensorObservation };

export interface SensorDeviceSpec {
  sensorId: string;
  agentId: string;
  sensorType: SensorType;
  modelName: string;
  nominalRangeM: number;
  samplingRateHz: number;
  nominalUncertaintyAbsolute: number;
  nominalUncertaintyRelative: number;
  provenance: DataProvenance;
}

export interface FusedTerrainObservation {
  timestamp: string;
  coordinate: MarsCoordinate;
  estimatedElevationM: number;
  estimatedSlopeDeg: number;
  slopeUncertaintyDeg: number;
  confidenceInterval: [number, number];
  rockDensityIndex: number;
  obstacleProbability: number;
  sensorCount: number;
  quality: "GOOD" | "DEGRADED" | "INVALID";
}
