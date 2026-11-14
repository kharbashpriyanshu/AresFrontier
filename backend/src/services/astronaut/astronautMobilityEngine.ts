export interface SpacesuitBiomechanics {
  suitModel: "NASA Exploration Extravehicular Mobility Unit (xEMU)";
  totalEarthMassKg: number; // Suit (135 kg) + Crew (80 kg) + Equipment/Tools (15 kg) = 230 kg
  marsWeightNewtons: number; // 230 kg * 3.721 m/s² = 855.8 N (equivalent to 87 kg on Earth)
  locomotionMode: "STANDARD_WALK" | "MARTIAN_LOPING" | "INCLINE_HOPPING";
  effectiveTraversalSpeedKmH: number;
  metabolicExertionWatts: number; // 200W resting to 650W steep climb
  fatigueAccumulationIndex: number; // 0.0 (fresh) to 1.0 (exhaustion threshold)
}

export interface LifeSupportConsumablesState {
  oxygen: {
    initialCapacityLiters: number; // 1200 L at 200 bar
    consumedLiters: number;
    remainingLiters: number;
    consumptionRateLitersPerMin: number; // 0.95 L/min nominal
    remainingMinutes: number;
  };
  coolingWater: {
    initialReservoirLiters: number; // 4.5 L
    remainingLiters: number;
    sublimationRateLitersPerHour: number; // ~0.55 L/hr
    coolingMarginMinutes: number;
  };
  batteryPower: {
    batteryCapacityKWh: number; // 1.2 kWh
    powerDrawWatts: number; // Avionics (80W) + Fan (45W) + Telemetry (25W) = 150W
    batteryRemainingPct: number;
    powerRemainingMinutes: number;
  };
  carbonDioxideScrubber: {
    canisterType: "Lithium Hydroxide (LiOH) Absorbent";
    capacityHours: number; // 8.0 hours
    saturationPct: number;
  };
  sampleStorage: {
    maximumMassKg: number; // 15.0 kg
    currentSampleMassKg: number;
    remainingCapacityKg: number;
  };
}

export interface EVAWorkloadSchedule {
  traversalTimeMinutes: number;
  scienceActivityTimeMinutes: number; // Drilling (25m), Abrasion (18m), Raman/PIXL (15m)
  restPeriodsMinutes: number; // 10 min rest per 60 min heavy activity
  totalElapsedMinutes: number;
  pointOfNoReturnMinute: number;
  mandatory30MinReturnBufferPreserved: boolean;
  safeReturnFeasible: boolean;
  marginToSafetyViolationMinutes: number;
  recommendations: string[];
}

/**
 * Astronaut Mobility & Bio-Energetics Engine (Items 17, 18 & 19)
 * Models spacesuit encumbrance, 0.38g Martian locomotion gaits,
 * life-support consumables, and NASA flight rule safe-return margins.
 */
export class AstronautMobilityEngine {
  /**
   * Evaluates biomechanics, movement speed, and metabolic power draw
   */
  public evaluateBiomechanics(
    slopeDegrees: number,
    astronautSkill: "standard" | "expert" = "standard",
    elapsedMinutes = 0
  ): SpacesuitBiomechanics {
    const totalMass = 230.0;
    const marsWeight = Number((totalMass * 3.721).toFixed(1)); // 855.8 N

    // Adapted Tobler gait for 0.38g Martian gravity
    // Under 0.38g, astronauts transition to Martian loping (stride length ~1.8-2.4m) on flat terrain,
    // which is more metabolically efficient than Earth walking.
    let baseSpeed = 3.6; // km/h flat loping speed
    let mode: "STANDARD_WALK" | "MARTIAN_LOPING" | "INCLINE_HOPPING" = "MARTIAN_LOPING";

    const slopeRad = (slopeDegrees * Math.PI) / 180.0;
    const slopeFactor = Math.exp(-3.2 * Math.abs(Math.tan(slopeRad) + 0.04));
    let speed = baseSpeed * slopeFactor;

    if (slopeDegrees > 15.0) {
      mode = "INCLINE_HOPPING";
      speed *= 0.75;
    } else if (speed < 2.2) {
      mode = "STANDARD_WALK";
    }

    if (astronautSkill === "expert") speed *= 1.12;

    // Fatigue accumulation over time: increases linearly with metabolic expenditure
    const fatigue = Math.min(1.0, Number(((elapsedMinutes / 360.0) * (1.0 + Math.abs(slopeDegrees) / 20.0)).toFixed(3)));
    speed *= (1.0 - fatigue * 0.25); // Exhaustion reduces traversal speed by up to 25%

    // Metabolic power draw (Watts): 220W base + slope exertion
    const metabolicWatts = Math.round(220 + Math.abs(slopeDegrees) * 16.5 + (mode === "INCLINE_HOPPING" ? 140 : 0));

    return {
      suitModel: "NASA Exploration Extravehicular Mobility Unit (xEMU)",
      totalEarthMassKg: totalMass,
      marsWeightNewtons: marsWeight,
      locomotionMode: mode,
      effectiveTraversalSpeedKmH: Number(Math.max(0.6, speed).toFixed(2)),
      metabolicExertionWatts: metabolicWatts,
      fatigueAccumulationIndex: fatigue,
    };
  }

  /**
   * Tracks spacesuit consumables: O2, cooling H2O, battery kWh, LiOH CO2 scrubber
   */
  public calculateConsumables(
    durationMinutes: number,
    averageSlopeDegrees: number,
    collectedSampleKg = 4.2
  ): LifeSupportConsumablesState {
    // 1. Oxygen: 1200 Liters nominal
    const initialO2 = 1200;
    // O2 consumption rate scales with metabolic power draw:
    const o2Rate = Number((0.95 + (Math.abs(averageSlopeDegrees) / 20.0) * 0.45).toFixed(2)); // L/min
    const o2Consumed = Math.round(o2Rate * durationMinutes);
    const o2Remaining = Math.max(0, initialO2 - o2Consumed);
    const o2Minutes = Math.round(o2Remaining / o2Rate);

    // 2. Cooling Water: 4.5 Liters sublimator
    const initialWater = 4.5;
    const waterRateHr = 0.55 + (Math.abs(averageSlopeDegrees) / 20.0) * 0.18; // L/hr
    const waterConsumed = Number(((waterRateHr * durationMinutes) / 60.0).toFixed(2));
    const waterRemaining = Math.max(0, Number((initialWater - waterConsumed).toFixed(2)));
    const waterMinutes = Math.round((waterRemaining / waterRateHr) * 60);

    // 3. Battery: 1.2 kWh = 1200 Watt-hours
    const batteryCapacityWh = 1200;
    const powerDrawW = 150 + (averageSlopeDegrees > 12 ? 35 : 0); // Watts
    const energyConsumedWh = (powerDrawW * durationMinutes) / 60.0;
    const batteryPct = Math.max(0, Math.round(((batteryCapacityWh - energyConsumedWh) / batteryCapacityWh) * 100));
    const powerMinutes = Math.round(((batteryCapacityWh - energyConsumedWh) / powerDrawW) * 60);

    // 4. CO2 scrubber (8 hours = 480 mins)
    const scrubberHours = 8.0;
    const saturationPct = Math.min(100, Math.round((durationMinutes / (scrubberHours * 60)) * 100));

    return {
      oxygen: {
        initialCapacityLiters: initialO2,
        consumedLiters: o2Consumed,
        remainingLiters: o2Remaining,
        consumptionRateLitersPerMin: o2Rate,
        remainingMinutes: o2Minutes,
      },
      coolingWater: {
        initialReservoirLiters: initialWater,
        remainingLiters: waterRemaining,
        sublimationRateLitersPerHour: Number(waterRateHr.toFixed(2)),
        coolingMarginMinutes: waterMinutes,
      },
      batteryPower: {
        batteryCapacityKWh: 1.2,
        powerDrawWatts: powerDrawW,
        batteryRemainingPct: batteryPct,
        powerRemainingMinutes: powerMinutes,
      },
      carbonDioxideScrubber: {
        canisterType: "Lithium Hydroxide (LiOH) Absorbent",
        capacityHours: scrubberHours,
        saturationPct,
      },
      sampleStorage: {
        maximumMassKg: 15.0,
        currentSampleMassKg: collectedSampleKg,
        remainingCapacityKg: Number((15.0 - collectedSampleKg).toFixed(1)),
      },
    };
  }

  /**
   * Evaluates complete EVA workload schedule and enforces mandatory 30-min NASA return margin
   */
  public evaluateEVAWorkload(
    outboundTraversalMinutes: number,
    returnTraversalMinutes: number,
    scienceTargetsCount = 3,
    maxAllocatedMinutes = 360 // 6.0 hours standard max EVA
  ): EVAWorkloadSchedule {
    // Standard scientific activity time breakdown:
    // Core drilling: 25m, Surface abrasion: 18m, Multispectral photography: 7m per site
    const scienceTime = scienceTargetsCount * 25; // Average 25 mins per scientific stop
    const traversalTotal = outboundTraversalMinutes + returnTraversalMinutes;

    // Rest stops: 10 mins rest every 60 mins traversal/drilling
    const restPeriods = Math.floor((traversalTotal + scienceTime) / 60) * 10;
    const totalDuration = traversalTotal + scienceTime + restPeriods;

    // Return margin calculation:
    const returnTimeNeededWithBuffer = returnTraversalMinutes + 30; // 30-minute mandatory NASA flight rule margin
    const pointOfNoReturn = maxAllocatedMinutes - returnTimeNeededWithBuffer;

    const marginMinutes = maxAllocatedMinutes - (totalDuration + 30);
    const bufferPreserved = marginMinutes >= 0;
    const feasible = bufferPreserved && totalDuration <= maxAllocatedMinutes;

    const recommendations: string[] = [];
    if (!bufferPreserved) {
      recommendations.push(`CRITICAL: Mandatory 30-min return margin violated by ${Math.abs(marginMinutes)} mins. Reduce science stops or shorten route.`);
    } else {
      recommendations.push(`EVA schedule feasible: ${marginMinutes} minutes buffer remaining beyond mandatory 30-min return margin.`);
    }

    if (totalDuration > 300) {
      recommendations.push("High-duration EVA (>5 hours): Enforce cooling water sublimator and suit hydration checks.");
    }

    return {
      traversalTimeMinutes: traversalTotal,
      scienceActivityTimeMinutes: scienceTime,
      restPeriodsMinutes: restPeriods,
      totalElapsedMinutes: totalDuration,
      pointOfNoReturnMinute: Math.max(0, pointOfNoReturn),
      mandatory30MinReturnBufferPreserved: bufferPreserved,
      safeReturnFeasible: feasible,
      marginToSafetyViolationMinutes: marginMinutes,
      recommendations,
    };
  }
}

export const astronautMobilityEngine = new AstronautMobilityEngine();
