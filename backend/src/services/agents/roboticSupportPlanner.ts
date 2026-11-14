import { MarsCoordinate } from "../../types/index.js";
import { calculateMarsDistanceKm } from "../../utils/marsCoordinates.js";

export interface RoboticSupportPlan {
  assignedRoverId: string;
  roverRole: "EQUIPMENT_MULE" | "FORWARD_SCOUT" | "MOBILE_COMMS_RELAY" | "EMERGENCY_EVACUATION_TOW";
  currentPosition: MarsCoordinate;
  targetSupportPosition: MarsCoordinate;
  payloadCapacityAvailableKg: number;
  astronautAssistanceMode: {
    toolTransportActive: boolean;
    sampleStorageActive: boolean;
    forwardScoutDistanceAheadMeters: number;
    emergencyTowAvailable: boolean;
  };
  batteryStatusPct: number;
  estimatedRendezvousMinutes: number;
  directives: string[];
}

/**
 * Robotic Support Planning Engine (Item 22)
 * Coordinates rover-assisted equipment transport, automated sample shuttle,
 * forward path scouting, and astronaut evacuation support.
 */
export class RoboticSupportPlanner {
  /**
   * Plans robotic support allocations for an active astronaut EVA team
   */
  public generateSupportPlan(
    astronautCoord: MarsCoordinate,
    currentRoverCoords: {
      scoutRover: MarsCoordinate;
      muleRover: MarsCoordinate;
      relayRover: MarsCoordinate;
    },
    missionStatus: "NOMINAL" | "HIGH_SAMPLE_LOAD" | "ASTRONAUT_EXHAUSTION" | "EMERGENCY_RETURN" = "NOMINAL"
  ): RoboticSupportPlan[] {
    const plans: RoboticSupportPlan[] = [];

    // 1. ROVER-02: Heavy Science / Equipment Mule
    const muleDistKm = calculateMarsDistanceKm(currentRoverCoords.muleRover, astronautCoord);
    const muleRendezvousMins = Math.round((muleDistKm / 4.0) * 60); // 4.0 km/h traverse

    let muleDirectives: string[] = [
      "Follow lead astronaut at 15m standoff distance.",
      "Accept core drill sample tubes into hermetic carousel (48-tube capacity).",
      "Relieve astronaut tool encumbrance (carrying rock core drill & ground spectrometer).",
    ];

    if (missionStatus === "ASTRONAUT_EXHAUSTION" || missionStatus === "EMERGENCY_RETURN") {
      muleDirectives = [
        "EMERGENCY PROTOCOL ACTIVATED: Deploy astronaut seat/tether hitch.",
        "Engage high-torque direct drive back to Hab at 8.5 km/h.",
        "Stream continuous biometric life-support telemetry to Mission Command.",
      ];
    }

    plans.push({
      assignedRoverId: "agent-rover-02-science-mule",
      roverRole: missionStatus === "EMERGENCY_RETURN" ? "EMERGENCY_EVACUATION_TOW" : "EQUIPMENT_MULE",
      currentPosition: currentRoverCoords.muleRover,
      targetSupportPosition: astronautCoord,
      payloadCapacityAvailableKg: 42.5,
      astronautAssistanceMode: {
        toolTransportActive: true,
        sampleStorageActive: true,
        forwardScoutDistanceAheadMeters: 0,
        emergencyTowAvailable: true,
      },
      batteryStatusPct: 82,
      estimatedRendezvousMinutes: muleRendezvousMins,
      directives: muleDirectives,
    });

    // 2. ROVER-01: Forward Scout & Slope Hazards
    const scoutDistKm = calculateMarsDistanceKm(currentRoverCoords.scoutRover, astronautCoord);
    plans.push({
      assignedRoverId: "agent-rover-01-scout",
      roverRole: "FORWARD_SCOUT",
      currentPosition: currentRoverCoords.scoutRover,
      targetSupportPosition: {
        latitude: astronautCoord.latitude + 0.002, // 200m ahead
        longitude: astronautCoord.longitude + 0.002,
      },
      payloadCapacityAvailableKg: 8.0,
      astronautAssistanceMode: {
        toolTransportActive: false,
        sampleStorageActive: false,
        forwardScoutDistanceAheadMeters: 250,
        emergencyTowAvailable: false,
      },
      batteryStatusPct: 88,
      estimatedRendezvousMinutes: Math.round((scoutDistKm / 6.0) * 60),
      directives: [
        "Traverse 250m ahead along planned great-circle vector.",
        "Scan forward terrain with Navcam stereo pairs for boulder fields (>0.5m) and talus slip scarps (>16°).",
        "Transmit real-time micro-terrain hazard alerts to astronaut heads-up display.",
      ],
    });

    return plans;
  }
}

export const roboticSupportPlanner = new RoboticSupportPlanner();
