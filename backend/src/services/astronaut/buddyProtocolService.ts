import { MarsCoordinate } from "../../types/index.js";
import { calculateMarsDistanceKm } from "../../utils/marsCoordinates.js";

export interface AstronautPairState {
  crew1: {
    id: "ASTRONAUT-01";
    callsign: "Ares-Lead";
    role: "Lead Field Geologist & Navigator";
    coordinate: MarsCoordinate;
    heartRateBpm: number;
    metabolicRateWatts: number;
    suitPressureKpa: number; // 29.6 kPa (4.3 psi pure O2)
    currentTask: string;
    primaryEquipment: string[];
  };
  crew2: {
    id: "ASTRONAUT-02";
    callsign: "Ares-Science";
    role: "Astrobiology & Sample Integrity Specialist";
    coordinate: MarsCoordinate;
    heartRateBpm: number;
    metabolicRateWatts: number;
    suitPressureKpa: number;
    currentTask: string;
    primaryEquipment: string[];
  };
  separationDistanceMeters: number;
  separationSafetyState: "OPTIMAL_VISIBILITY" | "ACCEPTABLE_SEPARATION" | "SEPARATION_WARNING" | "CRITICAL_TETHER_VIOLATION";
  buddyBreathingUmbilicalReady: boolean;
  workloadDistributionScore: number; // 0 - 100 (50/50 is perfectly balanced)
  mutualAssistanceDirective: string;
}

/**
 * Astronaut-Pair (Buddy Protocol) Operations Engine (Item 23)
 * Enforces dual-crew safety tethers, continuous line-of-sight proximity,
 * shared equipment allocation, and emergency life-support umbilical cross-feeding.
 */
export class BuddyProtocolService {
  public static readonly MAX_NOMINAL_SEPARATION_METERS = 150.0;
  public static readonly WARNING_SEPARATION_METERS = 220.0;

  /**
   * Evaluates astronaut-pair status, distance separation, and mutual safety
   */
  public evaluateBuddyState(
    crew1Coord: MarsCoordinate,
    crew2Coord: MarsCoordinate,
    crew1HeartRate = 112,
    crew2HeartRate = 104,
    crew1Task = "Rotary-Percussive Rock Core Drilling",
    crew2Task = "Deep UV Raman Spectroscopy & Hermetic Tube Sealing"
  ): AstronautPairState {
    const distKm = calculateMarsDistanceKm(crew1Coord, crew2Coord);
    const distMeters = Math.round(distKm * 1000.0);

    let safetyState: "OPTIMAL_VISIBILITY" | "ACCEPTABLE_SEPARATION" | "SEPARATION_WARNING" | "CRITICAL_TETHER_VIOLATION" = "OPTIMAL_VISIBILITY";
    let directive = "Nominal buddy operations. Maintain continuous visual contact.";

    if (distMeters > BuddyProtocolService.WARNING_SEPARATION_METERS) {
      safetyState = "CRITICAL_TETHER_VIOLATION";
      directive = `CRITICAL BUDDY RULE VIOLATION: Crew separation is ${distMeters}m (exceeds 220m limit). Halt science and close distance immediately.`;
    } else if (distMeters > BuddyProtocolService.MAX_NOMINAL_SEPARATION_METERS) {
      safetyState = "SEPARATION_WARNING";
      directive = `WARNING: Crew separation is ${distMeters}m. Crew 2 must move forward to maintain line-of-sight.`;
    } else if (distMeters > 50) {
      safetyState = "ACCEPTABLE_SEPARATION";
    }

    // Workload distribution calculation based on heart rate and task intensity
    const totalExertion = crew1HeartRate + crew2HeartRate;
    const balanceRatio = Math.min(crew1HeartRate, crew2HeartRate) / Math.max(crew1HeartRate, crew2HeartRate);
    const workloadScore = Math.round(balanceRatio * 100);

    return {
      crew1: {
        id: "ASTRONAUT-01",
        callsign: "Ares-Lead",
        role: "Lead Field Geologist & Navigator",
        coordinate: crew1Coord,
        heartRateBpm: crew1HeartRate,
        metabolicRateWatts: 340,
        suitPressureKpa: 29.6,
        currentTask: crew1Task,
        primaryEquipment: ["Rotary Core Drill", "Geological Chisel", "Laser Rangefinder"],
      },
      crew2: {
        id: "ASTRONAUT-02",
        callsign: "Ares-Science",
        role: "Astrobiology & Sample Integrity Specialist",
        coordinate: crew2Coord,
        heartRateBpm: crew2HeartRate,
        metabolicRateWatts: 285,
        suitPressureKpa: 29.6,
        currentTask: crew2Task,
        primaryEquipment: ["Deep UV Raman Spectrometer", "Hermetic Sample Seal Tool", "Multispectral Camera"],
      },
      separationDistanceMeters: distMeters,
      separationSafetyState: safetyState,
      buddyBreathingUmbilicalReady: true,
      workloadDistributionScore: workloadScore,
      mutualAssistanceDirective: directive,
    };
  }

  /**
   * Simulates emergency life-support cross-feed (buddy breathing)
   */
  public triggerEmergencyBuddyBreathing(): {
    umbilicalConnected: boolean;
    oxygenFlowRateLitersPerMin: number;
    contingencyDurationMinutes: number;
    safetyProtocolStatus: string;
  } {
    return {
      umbilicalConnected: true,
      oxygenFlowRateLitersPerMin: 1.45,
      contingencyDurationMinutes: 35,
      safetyProtocolStatus: "EMERGENCY UMBILICAL SECURED: Secondary O2 shared loop engaged. Return to habitat or pressurized rover immediately.",
    };
  }
}

export const buddyProtocolService = new BuddyProtocolService();
