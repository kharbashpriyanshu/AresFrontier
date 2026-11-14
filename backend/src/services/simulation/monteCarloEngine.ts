import { DeterministicIdGenerator } from "../../utils/deterministicId.js";
import { MissionStateCoordinator } from "../state/missionStateCoordinator.js";
import { missionRepository } from "../../repositories/missionRepository.js";
import { MarsRoute } from "../../types/index.js";

export interface MonteCarloConfig {
  missionId: string;
  runCount: number; // default 100
  seed: number;
  batteryVariancePercent?: number;       // e.g. 8%
  traversalSpeedVariancePercent?: number;// e.g. 12%
  slopeVarianceDeg?: number;             // e.g. 1.5°
  commOutageRate?: number;               // e.g. 0.084
  instrumentReliabilityRate?: number;    // e.g. 0.95
  maxDurationLimitMinutes?: number;      // e.g. 180
  injectedBatteryDropPercent?: number;   // e.g. 25% for battery failure stress test
  initialBatteryOverridePercent?: number;
  requireCommsForNominalCompletion?: boolean;
}

export interface MonteCarloDistribution {
  p10: number;
  p50: number;
  p90: number;
  mean: number;
  standardDeviation: number;
  confidenceInterval95: [number, number];
}

export interface MonteCarloResult {
  analysisId: string;
  missionId: string;
  runCount: number;
  seed: number;
  successProbabilityPercent: number;
  missionCompletionCount: number;
  safeRecoveryCount: number;
  failureCount: number;
  missionCompletionRatePercent: number;
  safeRecoveryRatePercent: number;
  overallSurvivalRatePercent: number;
  completionRateCI95Percent: [number, number];
  survivalRateCI95Percent: [number, number];
  successDefinition: {
    missionCompletion: string;
    safeRecovery: string;
    failure: string;
  };
  assumptions: string[];
  batteryReserveDistribution: MonteCarloDistribution;
  durationDistributionMinutes: MonteCarloDistribution;
  scienceReturnDistribution: MonteCarloDistribution;
  communicationOutageProbabilityPercent: number;
  hazardEncounterProbabilityPercent: number;
  classification: "SIMULATED / MONTE CARLO";
  modeledVersusMeasuredNote: string;
  baselineParameters: {
    distanceKm: number;
    nominalDurationMin: number;
    initialBatteryPercent: number;
    injectedBatteryDropPercent: number;
    commOutageRate: number;
    nominalScienceScore: number;
  };
  runOutputs: {
    runIndex: number;
    success: boolean;
    outcome: "MISSION_COMPLETED" | "SAFE_RECOVERY" | "FAILED";
    hadCommLoss: boolean;
    finalBatteryPercent: number;
    durationMin: number;
    hazardsCount: number;
    scienceScore: number;
  }[];
  verdict: string;
}

function wilsonCI95(successes: number, n: number): [number, number] {
  if (n <= 0) return [0, 0];
  const z = 1.96;
  const p = successes / n;
  const denom = 1 + (z * z) / n;
  const center = p + (z * z) / (2 * n);
  const half = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n);
  return [
    Number((Math.max(0, (center - half) / denom) * 100).toFixed(1)),
    Number((Math.min(1, (center + half) / denom) * 100).toFixed(1)),
  ];
}

export class MonteCarloEngine {
  /**
   * Runs a strictly reproducible seeded Monte Carlo uncertainty analysis across actual mission routes
   * and parameters, distinguishing nominal mission completion, safe recovery, and failure.
   */
  public static runAnalysis(config?: Partial<MonteCarloConfig>): MonteCarloResult {
    const missionId = config?.missionId || "MARSWALK-001";
    const runCount = config?.runCount ?? 100;

    if (runCount < 1 || runCount > 5000) {
      throw new Error(`Invalid runCount: ${runCount}. Run count must be between 1 and 5000.`);
    }

    const seed = config?.seed ?? 20261107;
    const slopeVar = config?.slopeVarianceDeg ?? 1.5;
    const commOutageRate = Math.max(0, Math.min(1, config?.commOutageRate ?? 0.084));
    const speedVar = (config?.traversalSpeedVariancePercent ?? 12) / 100;
    const energyVar = (config?.batteryVariancePercent ?? 8) / 100;
    const instrumentReliability = config?.instrumentReliabilityRate ?? 0.95;
    const injectedBatteryDropPercent = Math.max(0, config?.injectedBatteryDropPercent ?? 0);
    const requireCommsForNominalCompletion =
      config?.requireCommsForNominalCompletion ?? commOutageRate > 0.12;

    // 1. Load mission-specific route & parameters when available
    const storedMission = missionRepository.getMissionByIdSync(missionId);
    const storedRoute = storedMission
      ? missionRepository.getRouteByIdSync(storedMission.routeId)
      : null;
    const canonicalState = MissionStateCoordinator.getCanonicalState(missionId);
    const canonicalRoute =
      canonicalState?.routes?.routes && canonicalState.routes.activeRouteId
        ? canonicalState.routes.routes[canonicalState.routes.activeRouteId]
        : null;

    const activeRoute: MarsRoute = (storedRoute ||
      canonicalRoute || {
        id: "baseline-route",
        name: "Nominal Traverse Route",
        points: [
          { id: "p1", coordinate: { latitude: 18.4447, longitude: 77.4508 }, type: "start" },
          { id: "p2", coordinate: { latitude: 18.455, longitude: 77.41 }, type: "destination" },
        ],
        segments: [],
        totalDistanceKm: 8.4,
        estimatedDurationMinutes: 42,
        maxSlopeDegrees: 12.0,
        elevationGainM: 45,
        elevationLossM: 10,
        elevationProfile: [],
        overallDifficulty: "moderate",
        createdAt: new Date().toISOString(),
      }) as MarsRoute;

    const baseDistanceKm = activeRoute.totalDistanceKm || 8.4;
    const baseDurationMin = activeRoute.estimatedDurationMinutes || 42.0;
    const initialBattery =
      typeof config?.initialBatteryOverridePercent === "number"
        ? config.initialBatteryOverridePercent
        : canonicalState?.resources?.fleetBatterySoc
        ? Object.values(canonicalState.resources.fleetBatterySoc)[0] ?? 85.0
        : 85.0;
    const baseScience = 91;
    const maxDurationLimit =
      config?.maxDurationLimitMinutes ?? storedMission?.parameters?.maxDurationMinutes ?? 180;

    const baseWhExpended = baseDistanceKm * 105.0; // ~105 Wh/km nominal
    const batteryCapacityWh = 2400; // 2.4 kWh scout pack

    const analysisId = DeterministicIdGenerator.generateId({
      prefix: "mc-analysis",
      missionId,
      entityType: "MONTE_CARLO",
      sequenceNumber: runCount,
    });

    const runOutputs: MonteCarloResult["runOutputs"] = [];
    const batterySamples: number[] = [];
    const durationSamples: number[] = [];
    const scienceSamples: number[] = [];

    let missionCompletionCount = 0;
    let safeRecoveryCount = 0;
    let failureCount = 0;
    let commOutageCount = 0;
    let hazardCount = 0;

    let currentSeed = Math.abs(Math.floor(seed));
    const lcg = () => {
      currentSeed = (currentSeed * 1664525 + 1013904223) % 4294967296;
      return currentSeed / 4294967296;
    };

    for (let i = 0; i < runCount; i++) {
      const r1 = lcg();
      const r2 = lcg();
      const r3 = lcg();
      const r4 = lcg();
      const r5 = lcg();

      const z0 = Math.sqrt(-2.0 * Math.log(Math.max(0.0001, r1))) * Math.cos(2.0 * Math.PI * r2);
      const z1 = Math.sqrt(-2.0 * Math.log(Math.max(0.0001, r3))) * Math.cos(2.0 * Math.PI * r4);

      const speedMultiplier = Math.max(0.5, 1.0 + z0 * speedVar);
      const duration = Number((baseDurationMin / speedMultiplier).toFixed(1));

      const energyMultiplier = Math.max(0.6, 1.0 + z1 * energyVar);
      const expendedWh = baseWhExpended * energyMultiplier;
      const nominalBatteryDropPercent = (expendedWh / batteryCapacityWh) * 100.0;
      const totalBatteryDrop = nominalBatteryDropPercent + injectedBatteryDropPercent;
      const finalBattery = Number(Math.max(0, initialBattery - totalBatteryDrop).toFixed(1));

      const instrumentOperational = r5 <= instrumentReliability;
      const slopeNoise = z1 * slopeVar;
      const effectiveMaxSlope = activeRoute.maxSlopeDegrees + slopeNoise;
      const encounteredHazards = effectiveMaxSlope > 20.0 ? 2 : effectiveMaxSlope > 15.0 ? 1 : 0;
      const hadCommLoss = r4 < commOutageRate;

      if (hadCommLoss) commOutageCount += 1;
      if (encounteredHazards > 0) hazardCount += 1;

      const missionCompleted =
        finalBattery >= 20.0 &&
        duration <= maxDurationLimit &&
        effectiveMaxSlope <= 22.0 &&
        (!requireCommsForNominalCompletion || !hadCommLoss);

      const safeRecovery =
        !missionCompleted &&
        finalBattery >= 20.0 &&
        effectiveMaxSlope <= 25.0;

      let outcome: "MISSION_COMPLETED" | "SAFE_RECOVERY" | "FAILED" = "FAILED";
      if (missionCompleted) {
        outcome = "MISSION_COMPLETED";
        missionCompletionCount += 1;
      } else if (safeRecovery) {
        outcome = "SAFE_RECOVERY";
        safeRecoveryCount += 1;
      } else {
        failureCount += 1;
      }

      const scienceScore =
        outcome === "MISSION_COMPLETED"
          ? instrumentOperational
            ? Math.max(10, Math.min(100, Math.round(baseScience + z0 * 3.0)))
            : Math.max(10, Math.round(baseScience * 0.65))
          : outcome === "SAFE_RECOVERY"
          ? Math.max(10, Math.round(baseScience * 0.4))
          : 0;

      batterySamples.push(finalBattery);
      durationSamples.push(duration);
      scienceSamples.push(scienceScore);

      runOutputs.push({
        runIndex: i + 1,
        success: missionCompleted,
        outcome,
        hadCommLoss,
        finalBatteryPercent: finalBattery,
        durationMin: duration,
        hazardsCount: encounteredHazards,
        scienceScore,
      });
    }

    const calcDist = (samples: number[]): MonteCarloDistribution => {
      const sorted = [...samples].sort((a, b) => a - b);
      const p10 = sorted[Math.floor(sorted.length * 0.1)];
      const p50 = sorted[Math.floor(sorted.length * 0.5)];
      const p90 = sorted[Math.floor(sorted.length * 0.9)];
      const mean = Number((samples.reduce((a, b) => a + b, 0) / samples.length).toFixed(1));
      const variance = samples.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / samples.length;
      const stdDev = Number(Math.sqrt(variance).toFixed(1));
      const marginOfError = Number((1.96 * (stdDev / Math.sqrt(samples.length))).toFixed(1));
      const confidenceInterval95: [number, number] = [
        Number((mean - marginOfError).toFixed(1)),
        Number((mean + marginOfError).toFixed(1)),
      ];
      return { p10, p50, p90, mean, standardDeviation: stdDev, confidenceInterval95 };
    };

    const batteryReserveDistribution = calcDist(batterySamples);
    const durationDistributionMinutes = calcDist(durationSamples);
    const scienceReturnDistribution = calcDist(scienceSamples);

    const missionCompletionRatePercent = Number(
      ((missionCompletionCount / runCount) * 100).toFixed(1)
    );
    const safeRecoveryRatePercent = Number(((safeRecoveryCount / runCount) * 100).toFixed(1));
    const overallSurvivalRatePercent = Number(
      (((missionCompletionCount + safeRecoveryCount) / runCount) * 100).toFixed(1)
    );
    const commOutageProb = Number(((commOutageCount / runCount) * 100).toFixed(1));
    const hazardEncounterProb = Number(((hazardCount / runCount) * 100).toFixed(1));

    return {
      analysisId,
      missionId,
      runCount,
      seed,
      successProbabilityPercent: missionCompletionRatePercent,
      missionCompletionCount,
      safeRecoveryCount,
      failureCount,
      missionCompletionRatePercent,
      safeRecoveryRatePercent,
      overallSurvivalRatePercent,
      completionRateCI95Percent: wilsonCI95(missionCompletionCount, runCount),
      survivalRateCI95Percent: wilsonCI95(missionCompletionCount + safeRecoveryCount, runCount),
      successDefinition: {
        missionCompletion: `Final battery >= 20%, duration <= ${maxDurationLimit} min, max slope <= 22 deg${
          requireCommsForNominalCompletion ? ", and no communication blackout" : ""
        }.`,
        safeRecovery:
          "Nominal completion aborted (e.g., comms blackout or degraded performance), but battery >= 20% and slope <= 25 deg permit emergency return.",
        failure: "Final battery < 20% (S1 violation), duration exceeded limit, or slope > 25 deg.",
      },
      assumptions: [
        `Baseline route: ${activeRoute.name} (${baseDistanceKm.toFixed(2)} km, max slope ${(activeRoute.maxSlopeDegrees || 0).toFixed(1)} deg).`,
        `Battery pack capacity: 2400 Wh; nominal draw: 105 Wh/km; initial SoC: ${initialBattery.toFixed(1)}%; injected drop: ${injectedBatteryDropPercent.toFixed(1)}%.`,
        `Comms outage probability per trial: ${(commOutageRate * 100).toFixed(1)}% (requires comms for nominal completion: ${requireCommsForNominalCompletion}).`,
        "Not NASA-certified or flight-cleared; all distributions are synthetic/modeled Monte Carlo analogs.",
      ],
      batteryReserveDistribution,
      durationDistributionMinutes,
      scienceReturnDistribution,
      communicationOutageProbabilityPercent: commOutageProb,
      hazardEncounterProbabilityPercent: hazardEncounterProb,
      classification: "SIMULATED / MONTE CARLO",
      modeledVersusMeasuredNote:
        "MODELED UNCERTAINTY ONLY: Parameter variances are synthesized from empirical analog distributions. Does not constitute certified JPL/NASA flight clearance.",
      baselineParameters: {
        distanceKm: baseDistanceKm,
        nominalDurationMin: baseDurationMin,
        initialBatteryPercent: initialBattery,
        injectedBatteryDropPercent,
        commOutageRate,
        nominalScienceScore: baseScience,
      },
      runOutputs: runOutputs.slice(0, 20),
      verdict: `Nominal mission completion: ${missionCompletionRatePercent}% (${missionCompletionCount}/${runCount}), safe recovery: ${safeRecoveryRatePercent}% (${safeRecoveryCount}/${runCount}), failure: ${failureCount}/${runCount}. Overall survival (completion + safe recovery): ${overallSurvivalRatePercent}%. P10 battery reserve: ${batteryReserveDistribution.p10}%.`,
    };
  }
}
