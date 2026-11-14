import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../backend/src/app.js";
import { multiOrbiterVisibilityEngine } from "../../backend/src/services/comms/multiOrbiterVisibilityEngine.js";
import { roboticSupportPlanner } from "../../backend/src/services/agents/roboticSupportPlanner.js";
import { buddyProtocolService } from "../../backend/src/services/astronaut/buddyProtocolService.js";

describe("Milestone 4 — Multi-Orbiter Comms, Robotic Teaming & Astronaut-Pair Operations (Items 20 - 23)", () => {
  const jezeroCoord = { latitude: 18.4447, longitude: 77.4508 };

  // --------------------------------------------------------------------------
  // Item 20: Communication Coverage & Multi-Orbiter Passes (MRO, TGO, MAVEN)
  // --------------------------------------------------------------------------
  it("Item 20: Evaluates multi-orbiter relay constellation, bandwidth, and topological masking", () => {
    // MRO pass is active around MET 45-55 mins
    const mroActive = multiOrbiterVisibilityEngine.evaluateConstellation(jezeroCoord, 50, 15.0);
    expect(mroActive.activeRelayCount).toBeGreaterThanOrEqual(1);
    expect(mroActive.combinedBandwidthKbps).toBeGreaterThan(0);
    expect(mroActive.orbiters.length).toBe(3); // MRO, TGO, MAVEN
    expect(mroActive.contingencyStoreAndForwardBufferReady).toBe(true);

    // Topological horizon mask: if crater scarp is steep (e.g. 55 degree mask), low passes blocked
    const scarpMasked = multiOrbiterVisibilityEngine.evaluateConstellation(jezeroCoord, 50, 55.0);
    expect(scarpMasked.activeRelayCount).toBe(0);
    expect(scarpMasked.constellationStatus).toBe("CONSTELLATION_BLACKOUT");
    expect(scarpMasked.blackoutDurationMinutes).toBeGreaterThan(0);
  });

  // --------------------------------------------------------------------------
  // Item 22: Robotic Support Planning (Mule, Scout, Evac Tow)
  // --------------------------------------------------------------------------
  it("Item 22: Plans robotic assistance: equipment mule, forward scouting, and emergency evacuation", () => {
    const plans = roboticSupportPlanner.generateSupportPlan(
      jezeroCoord,
      {
        scoutRover: { latitude: 18.446, longitude: 77.452 },
        muleRover: { latitude: 18.444, longitude: 77.450 },
        relayRover: { latitude: 18.440, longitude: 77.455 },
      },
      "NOMINAL"
    );

    expect(plans.length).toBeGreaterThanOrEqual(2);
    const mule = plans.find((p) => p.assignedRoverId.includes("mule"))!;
    expect(mule.payloadCapacityAvailableKg).toBeGreaterThan(30);
    expect(mule.astronautAssistanceMode.toolTransportActive).toBe(true);

    const scout = plans.find((p) => p.assignedRoverId.includes("scout"))!;
    expect(scout.astronautAssistanceMode.forwardScoutDistanceAheadMeters).toBe(250);

    // Emergency Evacuation Mode
    const evacPlans = roboticSupportPlanner.generateSupportPlan(
      jezeroCoord,
      {
        scoutRover: { latitude: 18.446, longitude: 77.452 },
        muleRover: { latitude: 18.444, longitude: 77.450 },
        relayRover: { latitude: 18.440, longitude: 77.455 },
      },
      "EMERGENCY_RETURN"
    );
    const evacMule = evacPlans.find((p) => p.assignedRoverId.includes("mule"))!;
    expect(evacMule.roverRole).toBe("EMERGENCY_EVACUATION_TOW");
    expect(evacMule.directives.some((d) => d.includes("EMERGENCY PROTOCOL"))).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Item 23: Astronaut-Pair (Buddy Protocol) Operations
  // --------------------------------------------------------------------------
  it("Item 23: Monitors dual-crew distance tether, workload distribution, and buddy breathing", () => {
    // Crew close together (~30m separation)
    const nominalBuddy = buddyProtocolService.evaluateBuddyState(
      jezeroCoord,
      { latitude: 18.4450, longitude: 77.4510 }
    );
    expect(nominalBuddy.separationSafetyState).toBe("OPTIMAL_VISIBILITY");
    expect(nominalBuddy.workloadDistributionScore).toBeGreaterThan(60);
    expect(nominalBuddy.buddyBreathingUmbilicalReady).toBe(true);

    // Crew separated too far (~280m separation)
    const separatedBuddy = buddyProtocolService.evaluateBuddyState(
      jezeroCoord,
      { latitude: 18.4490, longitude: 77.4510 } // ~280m
    );
    expect(separatedBuddy.separationSafetyState).toBe("CRITICAL_TETHER_VIOLATION");
    expect(separatedBuddy.mutualAssistanceDirective).toContain("CRITICAL BUDDY RULE VIOLATION");

    // Emergency life-support cross feed
    const crossFeed = buddyProtocolService.triggerEmergencyBuddyBreathing();
    expect(crossFeed.umbilicalConnected).toBe(true);
    expect(crossFeed.contingencyDurationMinutes).toBeGreaterThan(20);
  });

  // --------------------------------------------------------------------------
  // REST API Endpoints Verification
  // --------------------------------------------------------------------------
  it("REST API: Serves constellation-comms, robotic-support, and buddy-pair endpoints", async () => {
    const commsRes = await request(app).get("/api/data/authentic/constellation-comms?lat=18.44&lon=77.45&timeMinutes=50");
    expect(commsRes.status).toBe(200);
    expect(commsRes.body.data.orbiters.length).toBe(3);

    const supportRes = await request(app).get("/api/data/authentic/robotic-support?lat=18.44&lon=77.45");
    expect(supportRes.status).toBe(200);
    expect(supportRes.body.data.length).toBeGreaterThanOrEqual(2);

    const buddyRes = await request(app).get("/api/data/authentic/buddy-pair?lat1=18.44&lon1=77.45&lat2=18.445&lon2=77.451");
    expect(buddyRes.status).toBe(200);
    expect(buddyRes.body.data.crew1.id).toBe("ASTRONAUT-01");
    expect(buddyRes.body.data.crew2.id).toBe("ASTRONAUT-02");
  });
});
