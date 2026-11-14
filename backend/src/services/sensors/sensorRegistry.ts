import { SensorDeviceSpec } from "./sensorTypes.js";
import { ProvenanceService } from "../planetary/provenanceService.js";

export class SensorRegistry {
  private static sensors: Map<string, SensorDeviceSpec> = new Map();
  private static initialized: boolean = false;

  public static initialize(): void {
    if (this.initialized) return;

    const specs: SensorDeviceSpec[] = [
      // ROVER-01 SCOUT Sensors
      {
        sensorId: "sns-r1-laser-alt",
        agentId: "agent-rover-01",
        sensorType: "LASER_ALTIMETER",
        modelName: "Mars-NavLaser-Profiler-3D",
        nominalRangeM: 60,
        samplingRateHz: 10,
        nominalUncertaintyAbsolute: 0.12, // ±0.12m
        nominalUncertaintyRelative: 0.02, // 2%
        provenance: ProvenanceService.createRoverProvenance("Ares Scout", "LASER_ALTIMETER", 1),
      },
      {
        sensorId: "sns-r1-hazcam",
        agentId: "agent-rover-01",
        sensorType: "HAZCAM",
        modelName: "Stereo-HazCam-SubCentimeter",
        nominalRangeM: 15,
        samplingRateHz: 4,
        nominalUncertaintyAbsolute: 0.8, // ±0.8° slope
        nominalUncertaintyRelative: 0.05,
        provenance: ProvenanceService.createRoverProvenance("Ares Scout", "HAZCAM", 1),
      },
      {
        sensorId: "sns-r1-navcam",
        agentId: "agent-rover-01",
        sensorType: "NAVCAM",
        modelName: "Panoramic-NavCam-Mast",
        nominalRangeM: 150,
        samplingRateHz: 1,
        nominalUncertaintyAbsolute: 1.5,
        nominalUncertaintyRelative: 0.08,
        provenance: ProvenanceService.createRoverProvenance("Ares Scout", "NAVCAM", 1),
      },

      // ROVER-02 SCIENCE Sensors
      {
        sensorId: "sns-r2-raman",
        agentId: "agent-rover-02",
        sensorType: "RAMAN_SPECTROMETER",
        modelName: "Deep-UV-Raman-Spectrometer-v3",
        nominalRangeM: 1.0,
        samplingRateHz: 0.2,
        nominalUncertaintyAbsolute: 0.05,
        nominalUncertaintyRelative: 0.04,
        provenance: ProvenanceService.createRoverProvenance("Ares Science", "RAMAN_SPECTROMETER", 1),
      },
      {
        sensorId: "sns-r2-hazcam",
        agentId: "agent-rover-02",
        sensorType: "HAZCAM",
        modelName: "Heavy-HazCam-Stereo",
        nominalRangeM: 12,
        samplingRateHz: 2,
        nominalUncertaintyAbsolute: 0.9,
        nominalUncertaintyRelative: 0.06,
        provenance: ProvenanceService.createRoverProvenance("Ares Science", "HAZCAM", 1),
      },
      {
        sensorId: "sns-r2-thermal",
        agentId: "agent-rover-02",
        sensorType: "THERMAL_IR",
        modelName: "Ground-Thermal-Radiometer",
        nominalRangeM: 25,
        samplingRateHz: 2,
        nominalUncertaintyAbsolute: 1.8, // ±1.8°C
        nominalUncertaintyRelative: 0.03,
        provenance: ProvenanceService.createRoverProvenance("Ares Science", "THERMAL_IR", 1),
      },

      // ROVER-03 RELAY Sensors
      {
        sensorId: "sns-r3-comm",
        agentId: "agent-rover-03",
        sensorType: "COMMUNICATION_SENSOR",
        modelName: "Electra-UHF-RF-Monitor",
        nominalRangeM: 15000,
        samplingRateHz: 5,
        nominalUncertaintyAbsolute: 0.5,
        nominalUncertaintyRelative: 0.02,
        provenance: ProvenanceService.createRoverProvenance("Ares Relay", "COMMUNICATION_SENSOR", 1),
      },

      // ASTRONAUT-01 Sensors
      {
        sensorId: "sns-ast-navcam",
        agentId: "agent-astronaut-01",
        sensorType: "NAVCAM",
        modelName: "xEMU-Helmet-StereoVision",
        nominalRangeM: 80,
        samplingRateHz: 30,
        nominalUncertaintyAbsolute: 0.5,
        nominalUncertaintyRelative: 0.03,
        provenance: ProvenanceService.createDerivedProvenance("xEMU Helmet Vision", ["Apollo Photogrammetry"], "Stereo Vision Model"),
      },
    ];

    specs.forEach((s) => this.sensors.set(s.sensorId, s));
    this.initialized = true;
  }

  public static getSensorsForAgent(agentId: string): SensorDeviceSpec[] {
    this.initialize();
    return Array.from(this.sensors.values()).filter((s) => s.agentId === agentId);
  }

  public static getSensorById(sensorId: string): SensorDeviceSpec | undefined {
    this.initialize();
    return this.sensors.get(sensorId);
  }
}
