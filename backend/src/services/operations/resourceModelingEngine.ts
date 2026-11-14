import { MarsRoute, MarsCoordinate } from "../../types/index.js";
import { calculateMarsDistanceKm } from "../../utils/marsCoordinates.js";

export interface ResourceEvaluationOptions {
  agentType?: "ASTRONAUT" | "ROVER";
  agentId?: string;
  initialBatteryPercent?: number;
  initialOxygenMinutes?: number;
  maxDurationMinutes?: number;
  sampleTubesAvailable?: number;
  dataCapacityGb?: number;
  batteryCapacityWh?: number;
  minBatteryReservePercent?: number;
}

export interface RouteResourceMetrics {
  initialBatteryPercent: number;
  projectedRemainingPercent: number;
  energyExpenditureWh: number;
  energyBudgetWh: number;
  batteryMarginPercent: number;
  locomotionEnergyWh: number;
  instrumentEnergyWh: number;
  commsEnergyWh: number;
  sampleTubesNeeded: number;
  sampleTubesAvailable: number;
  sampleCapacityFeasible: boolean;
  estimatedDataMb: number;
  dataStorageFeasible: boolean;
  oxygenRemainingMin?: number;
  oxygenFeasible: boolean;
  emergencyReturnFeasible: boolean;
  emergencyReturnEnergyWh: number;
  emergencyReturnDurationMin: number;
  hardConstraintViolations: string[];
  feasible: boolean;
  resourceScore: number; // 0 - 100
  summaryExplanation: string;
}

export class ResourceModelingEngine {
  public static readonly DEFAULT_BATTERY_CAPACITY_WH = 1200; // 1.2 kWh expedition pack
  public static readonly DEFAULT_MIN_RESERVE_PERCENT = 20.0; // Invariant S1
  public static readonly DEFAULT_INITIAL_BATTERY_PERCENT = 85.0;
  public static readonly DEFAULT_INITIAL_OXYGEN_MINUTES = 240.0; // 4 hours
  public static readonly DEFAULT_SAMPLE_TUBES_AVAILABLE = 5;
  public static readonly DEFAULT_DATA_CAPACITY_GB = 64.0;

  /**
   * Evaluates comprehensive resource consumption, battery state of charge,
   * life-support envelopes, and emergency return margins for a Mars route.
   */
  public static evaluateRouteResources(
    route: MarsRoute,
    options: ResourceEvaluationOptions = {}
  ): RouteResourceMetrics {
    const agentType = options.agentType || "ROVER";
    const batteryCapacityWh = options.batteryCapacityWh || this.DEFAULT_BATTERY_CAPACITY_WH;
    const minReservePercent = options.minBatteryReservePercent || this.DEFAULT_MIN_RESERVE_PERCENT;
    const initialBatteryPercent = options.initialBatteryPercent ?? this.DEFAULT_INITIAL_BATTERY_PERCENT;
    const initialOxygenMinutes = options.initialOxygenMinutes ?? this.DEFAULT_INITIAL_OXYGEN_MINUTES;
    const sampleTubesAvailable = options.sampleTubesAvailable ?? this.DEFAULT_SAMPLE_TUBES_AVAILABLE;
    const maxDurationMin = options.maxDurationMinutes ?? 180;

    const baseRateWhKm = agentType === "ASTRONAUT" ? 120.0 : 100.0;
    let locomotionEnergyWh = 0;

    // 1. Segment-by-segment locomotion energy expenditure
    if (route.segments && route.segments.length > 0) {
      for (const seg of route.segments) {
        const slope = seg.averageSlopeDegrees || 0;
        const slopeMultiplier = 1.0 + Math.pow(slope / 15.0, 2);
        const climbEnergy = (seg.elevationGainM || 0) * 0.15;
        // Mild regenerative braking on gentle descents
        const regenEnergy = slope < 10.0 ? (seg.elevationLossM || 0) * 0.03 : 0;
        const segWh = Math.max(1.0, seg.distanceKm * baseRateWhKm * slopeMultiplier + climbEnergy - regenEnergy);
        locomotionEnergyWh += segWh;
      }
    } else {
      const avgSlope = route.maxSlopeDegrees ? route.maxSlopeDegrees * 0.5 : 4.0;
      const slopeMultiplier = 1.0 + Math.pow(avgSlope / 15.0, 2);
      const climbEnergy = (route.elevationGainM || 0) * 0.15;
      locomotionEnergyWh = route.totalDistanceKm * baseRateWhKm * slopeMultiplier + climbEnergy;
    }

    // 2. Instrument & payload operating energy (20 Wh per science stop)
    const scienceStops = route.points ? route.points.filter((p) => p.type === "science").length : 0;
    const instrumentEnergyWh = scienceStops * 20.0;

    // 3. Communication transmission energy (5 Wh per point/window)
    const commsEnergyWh = Math.max(5.0, (route.points?.length || 2) * 2.5);

    // Total Energy Consumed
    const totalEnergyWh = Number((locomotionEnergyWh + instrumentEnergyWh + commsEnergyWh).toFixed(1));

    // 4. Battery State of Charge Projections
    const initialEnergyWh = (initialBatteryPercent / 100.0) * batteryCapacityWh;
    const remainingEnergyWh = initialEnergyWh - totalEnergyWh;
    const projectedRemainingPercent = Number(
      Math.max(0, (remainingEnergyWh / batteryCapacityWh) * 100.0).toFixed(1)
    );
    const batteryMarginPercent = Number((projectedRemainingPercent - minReservePercent).toFixed(1));

    // 5. Emergency Return Feasibility Calculation
    // Find the furthest point from start coordinate
    const startCoord = route.points && route.points.length > 0
      ? route.points[0].coordinate
      : { latitude: 18.38, longitude: 77.58 };

    let maxDistFromStartKm = 0;
    if (route.points) {
      for (const pt of route.points) {
        const d = calculateMarsDistanceKm(startCoord, pt.coordinate);
        if (d > maxDistFromStartKm) maxDistFromStartKm = d;
      }
    }
    if (maxDistFromStartKm === 0) maxDistFromStartKm = route.totalDistanceKm * 0.5;

    // Direct return energy needed from furthest waypoint
    const emergencyReturnEnergyWh = Math.round(maxDistFromStartKm * baseRateWhKm * 1.15);
    const emergencyReturnDurationMin = Math.round((maxDistFromStartKm / 3.0) * 60.0); // assume 3.0 km/h emergency speed
    const energyAtFurthestPointWh = initialEnergyWh - (totalEnergyWh * 0.6);
    const emergencyReturnFeasible = (energyAtFurthestPointWh - emergencyReturnEnergyWh) >= (batteryCapacityWh * (minReservePercent / 100.0));

    // 6. Sample Tubes & Data Storage
    const sampleTubesNeeded = scienceStops;
    const sampleCapacityFeasible = sampleTubesNeeded <= sampleTubesAvailable;
    const estimatedDataMb = 50 + scienceStops * 120; // 50MB telemetry + 120MB per science target
    const dataStorageFeasible = estimatedDataMb <= (options.dataCapacityGb || this.DEFAULT_DATA_CAPACITY_GB) * 1024;

    // 7. Astronaut Oxygen & Life Support
    const totalDurationMin = route.estimatedDurationMinutes || 60;
    const oxygenConsumedMin = Math.round(totalDurationMin * 1.05); // slight elevation factor
    const oxygenRemainingMin = Math.max(0, initialOxygenMinutes - oxygenConsumedMin);
    const oxygenFeasible = (oxygenRemainingMin >= 30.0) && (totalDurationMin <= maxDurationMin);

    // 8. Hard Constraint Checks
    const hardConstraintViolations: string[] = [];
    let feasible = true;

    if (projectedRemainingPercent < minReservePercent) {
      feasible = false;
      hardConstraintViolations.push(
        `Battery reserve violation: Projected battery (${projectedRemainingPercent}%) falls below the ${minReservePercent}% mandatory return reserve (Invariant S1).`
      );
    }

    if (remainingEnergyWh < 0) {
      feasible = false;
      hardConstraintViolations.push(
        `Energy deficit: Traverse requires ${totalEnergyWh} Wh but available battery holds only ${Math.round(initialEnergyWh)} Wh.`
      );
    }

    if (!emergencyReturnFeasible) {
      feasible = false;
      hardConstraintViolations.push(
        `Emergency return infeasible: Energy remaining at furthest point is insufficient to return to ingress hub with safe reserve.`
      );
    }

    if (!sampleCapacityFeasible) {
      feasible = false;
      hardConstraintViolations.push(
        `Sample tube deficit: Route requires ${sampleTubesNeeded} sample tube(s), but only ${sampleTubesAvailable} tube(s) are available.`
      );
    }

    if (agentType === "ASTRONAUT" && !oxygenFeasible) {
      feasible = false;
      hardConstraintViolations.push(
        `Life-support oxygen deficit: Remaining oxygen (${oxygenRemainingMin} min) breaches the mandatory 30-min EVA emergency reserve.`
      );
    }

    if (totalDurationMin > maxDurationMin) {
      feasible = false;
      hardConstraintViolations.push(
        `Duration limit exceeded: Estimated traverse duration (${totalDurationMin} min) breaches operational ceiling (${maxDurationMin} min).`
      );
    }

    if (route.maxSlopeDegrees > 20 && agentType === "ASTRONAUT") {
      feasible = false;
      hardConstraintViolations.push(
        `Mobility capability mismatch: Incline (${route.maxSlopeDegrees.toFixed(1)}°) breaches the 20° spacesuited astronaut locomotion ceiling.`
      );
    }

    // 9. Resource Score (0-100)
    // High score when battery reserve is generous (>45%) and energy efficiency is high
    let resourceScore = 85;
    if (batteryMarginPercent < 0) {
      resourceScore = Math.max(5, 50 + batteryMarginPercent * 2.5);
    } else {
      resourceScore = Math.min(100, 70 + batteryMarginPercent * 0.7);
    }
    if (!sampleCapacityFeasible) resourceScore -= 20;
    if (agentType === "ASTRONAUT" && oxygenRemainingMin < 60) resourceScore -= 25;
    resourceScore = Math.max(5, Math.min(100, Math.round(resourceScore)));

    const summaryExplanation = `Energy consumption: ${totalEnergyWh} Wh (Locomotion: ${Math.round(locomotionEnergyWh)} Wh, Instruments: ${instrumentEnergyWh} Wh). ` +
      `Projected battery: ${projectedRemainingPercent}% (Margin: ${batteryMarginPercent > 0 ? "+" : ""}${batteryMarginPercent}% vs ${minReservePercent}% reserve). ` +
      (hardConstraintViolations.length > 0 ? `HARD CONSTRAINTS VIOLATED: ${hardConstraintViolations.join("; ")}` : "All resource feasibility constraints satisfied.");

    return {
      initialBatteryPercent,
      projectedRemainingPercent,
      energyExpenditureWh: totalEnergyWh,
      energyBudgetWh: initialEnergyWh,
      batteryMarginPercent,
      locomotionEnergyWh: Math.round(locomotionEnergyWh),
      instrumentEnergyWh,
      commsEnergyWh,
      sampleTubesNeeded,
      sampleTubesAvailable,
      sampleCapacityFeasible,
      estimatedDataMb,
      dataStorageFeasible,
      oxygenRemainingMin: agentType === "ASTRONAUT" ? oxygenRemainingMin : undefined,
      oxygenFeasible,
      emergencyReturnFeasible,
      emergencyReturnEnergyWh,
      emergencyReturnDurationMin,
      hardConstraintViolations,
      feasible,
      resourceScore,
      summaryExplanation,
    };
  }
}

