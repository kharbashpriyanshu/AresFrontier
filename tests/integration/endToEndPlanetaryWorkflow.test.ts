import { describe, it, expect, beforeEach } from "vitest";
import { molaProvider } from "../../backend/src/services/planetary/molaProvider.js";
import { themisProvider } from "../../backend/src/services/planetary/themisProvider.js";
import { crismProvider } from "../../backend/src/services/planetary/crismProvider.js";
import { geologyProvider } from "../../backend/src/services/planetary/geologyProvider.js";
import { subsurfaceIceProvider } from "../../backend/src/services/planetary/subsurfaceIceProvider.js";
import { atmosphereService } from "../../backend/src/services/planetary/atmosphereService.js";
import { radiationService } from "../../backend/src/services/planetary/radiationService.js";
import { unifiedScienceLayerService } from "../../backend/src/services/planetary/unifiedScienceLayerService.js";
import { microTerrainService } from "../../backend/src/services/terrain/microTerrainService.js";
import { astronautMobilityEngine } from "../../backend/src/services/astronaut/astronautMobilityEngine.js";
import { multiOrbiterVisibilityEngine } from "../../backend/src/services/comms/multiOrbiterVisibilityEngine.js";
import { roboticSupportPlanner } from "../../backend/src/services/agents/roboticSupportPlanner.js";
import { buddyProtocolService } from "../../backend/src/services/astronaut/buddyProtocolService.js";
import { mepagTargetPrioritizer } from "../../backend/src/services/science/mepagTargetPrioritizer.js";
import { comprehensiveParetoPlanner } from "../../backend/src/services/intelligence/comprehensiveParetoPlanner.js";
import { observationPlanningService } from "../../backend/src/services/science/observationPlanningService.js";
import { MissionReportService } from "../../backend/src/services/reporting/missionReportService.js";
import { auditChainService } from "../../backend/src/services/security/auditChainService.js";

describe("Milestone 7: End-to-End Planetary Exploration Mission Assurance (Items 34-38)", () => {
  const jezeroLanding = { latitude: 18.4447, longitude: 77.4508 };
  const kodiakButte = { latitude: 18.423, longitude: 77.411 };
  const seitahOlivine = { latitude: 18.449, longitude: 77.441 };

  beforeEach(() => {
    // Reset or prepare audit chain if needed
  });

  it("Item 34: generates complete 8-step sampling protocol checklist with tool allocations", () => {
    const plan = observationPlanningService.generateObservationPlan(
      "tgt-kodiak-delta",
      "Kodiak Butte Delta Front",
      kodiakButte
    );

    expect(plan.targetId).toBe("tgt-kodiak-delta");
    expect(plan.geologicalFormation).toBeDefined();
    expect(plan.instrumentSteps.length).toBe(8);

    const step1 = plan.instrumentSteps[0];
    expect(step1.stepNumber).toBe(1);
    expect(step1.instrumentName).toContain("Camera");

    const coringStep = plan.instrumentSteps.find((s) => s.stepNumber === 7);
    expect(coringStep).toBeDefined();
    expect(coringStep?.instrumentName).toContain("Core Drill");
    expect(coringStep?.instrumentType).toBe("CORE_DRILL");

    const sealStep = plan.instrumentSteps.find((s) => s.stepNumber === 8);
    expect(sealStep?.instrumentName).toContain("Seal");
    expect(sealStep?.durationMinutes).toBe(8);
  });

  it("Item 35 & 37: synthesizes authentic mission report with complete multi-mission PDS provenance", () => {
    const report = MissionReportService.generateReport("MARSWALK-001");

    expect(report.missionId).toBe("MARSWALK-001");
    expect(report.classification).toBe("DERIVED / MULTI-SOURCE SYNTHESIS");
    expect(report.provenanceNotice).toContain("synthesizes canonical ground truth");

    // Provenance distinction checks
    expect(report.authenticScienceEnvironment).toBeDefined();
    expect(report.authenticScienceEnvironment?.topography.dataset).toContain("MOLA");
    expect(report.authenticScienceEnvironment?.geology.dataset).toContain("USGS");
    expect(report.authenticScienceEnvironment?.mineralogy.dataset).toContain("CRISM");
    expect(report.authenticScienceEnvironment?.atmosphereAndRadiation.dataset).toContain("MEDA & MSL RAD");

    // Markdown generation
    const md = MissionReportService.generateMarkdownReport("MARSWALK-001");
    expect(md).toContain("# MARTIAN EXPEDITION MISSION REPORT");
    expect(md).toContain("NASA Multi-Mission Authentic Planetary Science");
    expect(md).toContain("Topography (MOLA MEGDR)");
    expect(md).toContain("Stratigraphic Unit (USGS)");

    // CSV generation
    const csv = MissionReportService.generateCsvReport("MARSWALK-001");
    expect(csv).toContain("MISSION REPORT - MARSWALK-001");
    expect(csv).toContain("SAFETY INVARIANTS S1-S8 COMPLIANCE");
  });

  it("Item 36 & 38: validates complete coherent astronaut workflow from target selection to safe return", async () => {
    // 1. Target Prioritization (MEPAG)
    const prioritized = await mepagTargetPrioritizer.prioritizeTargets(jezeroLanding);
    expect(prioritized.length).toBeGreaterThan(0);
    const topTarget = prioritized[0];
    expect(topTarget.compositeScienceScore).toBeGreaterThan(60);

    // 2. Multi-Objective 7D Pareto Route Planning
    const paretoResult = await comprehensiveParetoPlanner.evaluatePlans(
      jezeroLanding,
      topTarget.coordinate
    );
    expect(paretoResult.plans.length).toBe(4);
    const recommended = paretoResult.plans.find((p) => p.planId === paretoResult.recommendedPlanId);
    expect(recommended).toBeDefined();
    expect(recommended!.mandatory30MinReturnBufferPreserved).toBe(true);

    // 3. Biomechanics & Consumables Feasibility with NASA 30-min buffer
    const biomech = astronautMobilityEngine.evaluateBiomechanics(8.0, "standard", 60);
    expect(biomech.effectiveTraversalSpeedKmH).toBeGreaterThan(1.0);
    expect(["MARTIAN_LOPING", "STANDARD_WALK"]).toContain(biomech.locomotionMode);

    const consumables = astronautMobilityEngine.calculateConsumables(180, 8.0, 4.0);
    expect(consumables.oxygen.remainingLiters).toBeGreaterThan(0);
    expect(consumables.oxygen.remainingMinutes).toBeGreaterThan(100);

    const workload = astronautMobilityEngine.evaluateEVAWorkload(75, 2, 8.0);
    expect(workload.mandatory30MinReturnBufferPreserved).toBe(true);
    expect(workload.safeReturnFeasible).toBe(true);

    // 4. Micro-Terrain Obstacle & Scarp Slope Stability
    const micro = await microTerrainService.evaluateMicroTerrain(jezeroLanding, 8.0);
    expect(micro.scarpAndSlopeHazards.reposeAngleMarginDegrees).toBeGreaterThan(0);
    expect(micro.looseRegolithEntrapment.estimatedWheelOrBootSinkageCm).toBeLessThan(20.0);

    // 5. RF Constellation Coverage & Topological Mask
    const comms = multiOrbiterVisibilityEngine.evaluateConstellation(
      jezeroLanding,
      45,
      15.0
    );
    expect(comms.orbiters.length).toBe(3);
    expect(comms.contingencyStoreAndForwardBufferReady).toBe(true);

    // 6. Astronaut Buddy Pair Safety
    const nearCrew2 = { latitude: 18.4450, longitude: 77.4512 };
    const buddyState = buddyProtocolService.evaluateBuddyState(jezeroLanding, nearCrew2);
    expect(["OPTIMAL_VISIBILITY", "ACCEPTABLE_SEPARATION"]).toContain(buddyState.separationSafetyState);
    expect(buddyState.buddyBreathingUmbilicalReady).toBe(true);

    // 7. Robotic Mule & Scout Team Support
    const rovers = {
      scoutRover: { latitude: 18.446, longitude: 77.452 },
      muleRover: { latitude: 18.444, longitude: 77.450 },
      relayRover: { latitude: 18.448, longitude: 77.455 },
    };
    const roboticPlans = roboticSupportPlanner.generateSupportPlan(jezeroLanding, rovers, "NOMINAL");
    expect(roboticPlans.length).toBe(2);
    const mulePlan = roboticPlans.find((p) => p.roverRole === "EQUIPMENT_MULE");
    expect(mulePlan).toBeDefined();

    // 8. Dynamic Contingency: Tether breach triggers alert
    const distantCrew2 = { latitude: 18.4550, longitude: 77.4650 };
    const breachBuddy = buddyProtocolService.evaluateBuddyState(jezeroLanding, distantCrew2);
    expect(breachBuddy.separationSafetyState).toBe("CRITICAL_TETHER_VIOLATION");
    expect(breachBuddy.mutualAssistanceDirective).toContain("Halt");
  });
});
