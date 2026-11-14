import { describe, it, expect } from "vitest";
import { OrbitalVisibilityEngine } from "../../backend/src/services/comms/orbitalVisibilityEngine.js";
import { CommunicationEngine } from "../../backend/src/services/comms/communicationEngine.js";
import { AgentRegistry } from "../../backend/src/services/agents/agentRegistry.js";

describe("Phase 5: Orbital Visibility & Pass Simulation", () => {
  const jezeroCoord = { latitude: 18.4447, longitude: 77.4508 };

  it("should calculate PASS_ACTIVE state with high bandwidth during pass window", () => {
    // MET 00:48 is inside the pass window (42m to 62m)
    const vis = OrbitalVisibilityEngine.calculateVisibility(jezeroCoord, 48);

    expect(vis.state).toBe("PASS_ACTIVE");
    expect(vis.currentElevationDeg).toBeGreaterThan(15.0);
    expect(vis.bandwidthKbps).toBeGreaterThanOrEqual(1024);
    expect(vis.visibilityQuality).toBe("EXCELLENT");
    expect(vis.slantRangeKm).toBeLessThan(600);
  });

  it("should calculate NO_CONTACT state with zero bandwidth outside pass window", () => {
    // MET 00:20 is outside the pass window
    const vis = OrbitalVisibilityEngine.calculateVisibility(jezeroCoord, 20);

    expect(vis.state).toBe("NO_CONTACT");
    expect(vis.currentElevationDeg).toBe(0);
    expect(vis.bandwidthKbps).toBe(0);
    expect(vis.visibilityQuality).toBe("NO_CONTACT");
    expect(vis.nextPassInSeconds).toBeGreaterThan(0);
  });

  it("should detect PASS_APPROACHING within 5 minutes of pass acquisition", () => {
    // MET 00:39 is 3 minutes before passStart (42)
    const vis = OrbitalVisibilityEngine.calculateVisibility(jezeroCoord, 39);

    expect(vis.state).toBe("PASS_APPROACHING");
    expect(vis.nextPassInSeconds).toBeLessThanOrEqual(300);
  });

  it("should dynamically link or sever orbiter links in CommunicationEngine based on simulation time", () => {
    const agents = AgentRegistry.getAllAgents();

    // 1. When pass is active (simTime = 48)
    const activeTopology = CommunicationEngine.evaluateNetwork(agents, 48);
    const orbiterLinkActive = activeTopology.links.find((l) => l.targetCallsign === "ORBITER-01");

    expect(orbiterLinkActive).toBeDefined();
    expect(orbiterLinkActive?.status).toBe("CONNECTED");
    expect(activeTopology.missionControlReachable).toBe(true);

    // 2. When pass is inactive (simTime = 20)
    const inactiveTopology = CommunicationEngine.evaluateNetwork(agents, 20);
    const orbiterLinkInactive = inactiveTopology.links.find((l) => l.targetCallsign === "ORBITER-01");

    expect(orbiterLinkInactive).toBeDefined();
    expect(orbiterLinkInactive?.status).toBe("LOST");
    expect(inactiveTopology.missionControlReachable).toBe(false);
  });
});
