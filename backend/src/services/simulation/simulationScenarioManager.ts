import { PersistedMissionState, MissionPersistenceService } from "../persistence/missionPersistenceService.js";
import { WhatIfSimulationEngine, WhatIfSimulationRequest, WhatIfSimulationResult } from "./whatIfSimulationEngine.js";

export class SimulationScenarioManager {
  /**
   * Clones current runtime mission state into an isolated sandbox for exploratory What-If runs.
   */
  public static cloneMissionState(missionId: string): PersistedMissionState {
    const currentState = MissionPersistenceService.saveState();
    return JSON.parse(JSON.stringify(currentState));
  }

  /**
   * Dispatches what-if simulation from cloned state without modifying live stores.
   */
  public static evaluateWhatIf(request: WhatIfSimulationRequest): WhatIfSimulationResult {
    return WhatIfSimulationEngine.runWhatIfSimulation(request);
  }
}
