import { describe, it, expect, beforeEach } from "vitest";
import { AgentRegistry } from "../../backend/src/services/agents/agentRegistry.js";
import { AgentTaskPlanner } from "../../backend/src/services/agents/agentTaskPlanner.js";
import { AgentDecisionEngine } from "../../backend/src/services/agents/agentDecisionEngine.js";
import { RoverAgent } from "../../backend/src/services/agents/agentTypes.js";

describe("Phase 4: Autonomous Planetary Agents & Rover Decision Engine", () => {
  beforeEach(() => {
    AgentRegistry.resetAgents();
  });

  it("should initialize default multi-agent roster with calibrated capabilities", () => {
    const agents = AgentRegistry.getAllAgents();
    expect(agents.length).toBeGreaterThanOrEqual(5);

    const astronaut = agents.find((a) => a.type === "ASTRONAUT");
    const scout = agents.find((a) => a.callsign.includes("SCOUT")) as RoverAgent;
    const science = agents.find((a) => a.callsign.includes("SCIENCE")) as RoverAgent;
    const relay = agents.find((a) => a.callsign.includes("RELAY")) as RoverAgent;
    const orbiter = agents.find((a) => a.type === "ORBITER");

    expect(astronaut).toBeDefined();
    expect(scout).toBeDefined();
    expect(scout.mobilityRating).toBeGreaterThan(0.8);
    expect(scout.hazardTolerance).toBe(20.0);

    expect(science).toBeDefined();
    expect(science.scientificPayloads).toContain("Deep UV Raman Spectrometer");

    expect(relay).toBeDefined();
    expect(relay.communicationRangeKm).toBeGreaterThanOrEqual(10.0);

    expect(orbiter).toBeDefined();
  });

  it("should enforce safe return feasibility and reject tasks with insufficient battery margin", () => {
    const scout = AgentRegistry.getAgentById("agent-rover-01") as RoverAgent;
    expect(scout).toBeDefined();

    // Deep coordinate ~45 km away (exceeds max battery range and reserve)
    const distantTarget = { latitude: 19.25, longitude: 78.10 };
    const baseRecovery = { latitude: 18.4447, longitude: 77.4508 };

    const feasibility = AgentTaskPlanner.evaluateTaskFeasibility(scout, distantTarget, baseRecovery);

    expect(feasibility.feasible).toBe(false);
    expect(feasibility.safeReturnFeasible).toBe(false);
    expect(feasibility.reasons.some((r) => r.includes("battery"))).toBe(true);
  });

  it("should accept feasible tasks within operational envelope and compute energy requirements", () => {
    const scout = AgentRegistry.getAgentById("agent-rover-01") as RoverAgent;
    const nearbyTarget = { latitude: 18.452, longitude: 77.425 }; // ~1.5 km away
    const baseRecovery = { latitude: 18.4447, longitude: 77.4508 };

    const feasibility = AgentTaskPlanner.evaluateTaskFeasibility(scout, nearbyTarget, baseRecovery);

    expect(feasibility.feasible).toBe(true);
    expect(feasibility.safeReturnFeasible).toBe(true);
    expect(feasibility.energyRequiredWh).toBeGreaterThan(0);
    expect(feasibility.batteryRequiredPercent).toBeLessThan(40);
  });

  it("should trigger autonomous safety pause when rover exceeds hazard slope tolerance", () => {
    const scout = AgentRegistry.getAgentById("agent-rover-01") as RoverAgent;
    expect(scout).toBeDefined();

    // Position scout directly at the steep Jezero delta scarp brink
    scout.position = { latitude: 18.448, longitude: 77.402 };
    scout.hazardTolerance = 15.0; // Lower tolerance to guarantee trigger

    const cycle = AgentDecisionEngine.runCycle(scout, { latitude: 18.4447, longitude: 77.4508 });

    expect(cycle.decisionAction).toBe("PAUSE");
    expect(cycle.currentStatus).toBe("PAUSED");
    expect(cycle.detectedHazards.length).toBeGreaterThan(0);
    expect(cycle.rationale).toContain("safety stop");
  });

  it("should declare emergency stop if rover battery level drops below critical threshold", () => {
    const scienceRover = AgentRegistry.getAgentById("agent-rover-02") as RoverAgent;
    expect(scienceRover).toBeDefined();

    scienceRover.telemetry.batteryPercent = 7.5; // Critical < 10%
    const cycle = AgentDecisionEngine.runCycle(scienceRover, { latitude: 18.4447, longitude: 77.4508 });

    expect(cycle.decisionAction).toBe("EMERGENCY_STOP");
    expect(cycle.currentStatus).toBe("EMERGENCY");
    expect(cycle.batteryStatus).toBe("CRITICAL");
  });
});
