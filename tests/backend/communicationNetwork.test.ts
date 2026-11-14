import { describe, it, expect, beforeEach } from "vitest";
import { LineOfSightEngine } from "../../backend/src/services/comms/lineOfSightEngine.js";
import { CommunicationEngine } from "../../backend/src/services/comms/communicationEngine.js";
import { RelayPlanner } from "../../backend/src/services/comms/relayPlanner.js";
import { CommunicationCoverageEngine } from "../../backend/src/services/comms/communicationCoverage.js";
import { AgentRegistry } from "../../backend/src/services/agents/agentRegistry.js";

describe("Phase 4: Communication Network & Line-of-Sight Analysis", () => {
  beforeEach(() => {
    AgentRegistry.resetAgents();
  });

  it("should calculate line of sight with Mars curvature correction for close coordinates", () => {
    const p1 = { latitude: 18.4447, longitude: 77.4508 };
    const p2 = { latitude: 18.4455, longitude: 77.4515 }; // ~100m away

    const los = LineOfSightEngine.calculateLineOfSight(p1, p2, 2.0, 2.0);

    expect(los.lineOfSight).toBe(true);
    expect(los.status).toBe("LINE_OF_SIGHT_CLEAR");
    expect(los.distanceKm).toBeLessThan(0.5);
  });

  it("should evaluate network topology and determine connected vs degraded links", () => {
    const agents = AgentRegistry.getAllAgents();
    const topology = CommunicationEngine.evaluateNetwork(agents);

    expect(topology.links.length).toBeGreaterThan(0);
    expect(topology.missionControlReachable).toBe(true);

    const connectedLinks = topology.links.filter((l) => l.status === "CONNECTED");
    expect(connectedLinks.length).toBeGreaterThan(0);
  });

  it("should plan multi-hop relay route via ROVER-03 RELAY when direct link is unavailable", () => {
    const agents = AgentRegistry.getAllAgents();
    const scout = agents.find((a) => a.id === "agent-rover-01")!;

    const relayRoute = RelayPlanner.planRelayRoute(scout.id, agents);

    expect(relayRoute.isViable).toBe(true);
    expect(relayRoute.hops.length).toBeGreaterThanOrEqual(3);
    expect(relayRoute.overallReliability).toBeGreaterThan(0.5);
  });

  it("should calculate deterministic orbital communication pass windows for MRO-Relay", () => {
    const jezero = { latitude: 18.4447, longitude: 77.4508 };
    const report = CommunicationCoverageEngine.getCommunicationWindows(jezero);

    expect(report.relayAgent).toContain("ORBITER-01");
    expect(report.nextCommunicationWindow.durationMinutes).toBe(16);
    expect(report.nextCommunicationWindow.bandwidthKbps).toBe(2048);
    expect(report.confidence).toBeGreaterThan(0.9);
  });
});
