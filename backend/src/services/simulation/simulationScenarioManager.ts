import { PersistedMissionState, MissionPersistenceService } from "../persistence/missionPersistenceService.js";
import { WhatIfSimulationEngine, WhatIfSimulationRequest, WhatIfSimulationResult } from "./whatIfSimulationEngine.js";
import { MonteCarloEngine, MonteCarloConfig, MonteCarloResult } from "./monteCarloEngine.js";
import { auditChainService } from "../security/auditChainService.js";
import { ProvenanceService } from "../planetary/provenanceService.js";

export class SimulationScenarioManager {
  private static simulationHistory: Array<{
    simulationId: string;
    type: "WHAT_IF" | "MONTE_CARLO";
    timestamp: string;
    result: WhatIfSimulationResult | MonteCarloResult;
    provenance: import("../../types/index.js").DataProvenance;
  }> = [];

  /**
   * Clones current runtime mission state into an isolated sandbox for exploratory What-If runs.
   */
  public static cloneMissionState(missionId: string): PersistedMissionState {
    const currentState = MissionPersistenceService.saveState();
    return JSON.parse(JSON.stringify(currentState));
  }

  /**
   * Dispatches what-if simulation from cloned state without modifying live stores,
   * associating results with cryptographic audit provenance.
   */
  public static evaluateWhatIf(request: WhatIfSimulationRequest): WhatIfSimulationResult {
    const result = WhatIfSimulationEngine.runWhatIfSimulation(request);

    const provenance = ProvenanceService.createDerivedProvenance(
      `What-If Simulation Engine: ${request.decisionOverride || "CUSTOM"}`,
      ["Canonical Unified Mission State", "Terramechanics Resource Model"],
      "Isolated What-If Forward State Simulation"
    );

    this.simulationHistory.push({
      simulationId: result.simulationId,
      type: "WHAT_IF",
      timestamp: new Date().toISOString(),
      result,
      provenance,
    });

    auditChainService.appendEvent({
      userId: "SIMULATION_ENGINE",
      role: "ANALYST",
      action: "OPTIMIZE_ROUTE",
      missionPlanId: request.baselineMissionId,
      details: {
        simulationId: result.simulationId,
        scenario: request.decisionOverride,
        successProbability: result.missionSuccessProbability,
        routeFeasible: result.routeFeasible,
      },
    });

    return result;
  }

  /**
   * Dispatches Monte Carlo simulation operating on actual mission parameters.
   */
  public static evaluateMonteCarlo(config?: Partial<MonteCarloConfig>): MonteCarloResult {
    const result = MonteCarloEngine.runAnalysis(config);

    const provenance = ProvenanceService.createDerivedProvenance(
      `Monte Carlo Uncertainty Engine (${result.runCount} runs)`,
      ["Canonical Mission Route", "Stochastic Environmental Analogs"],
      "Seeded LCG Monte Carlo Distribution Modeling"
    );

    this.simulationHistory.push({
      simulationId: result.analysisId,
      type: "MONTE_CARLO",
      timestamp: new Date().toISOString(),
      result,
      provenance,
    });

    return result;
  }

  public static getSimulationHistory(): Array<{
    simulationId: string;
    type: "WHAT_IF" | "MONTE_CARLO";
    timestamp: string;
    result: WhatIfSimulationResult | MonteCarloResult;
    provenance: import("../../types/index.js").DataProvenance;
  }> {
    return [...this.simulationHistory];
  }
}
