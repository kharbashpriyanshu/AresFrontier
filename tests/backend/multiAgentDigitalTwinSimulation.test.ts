import { describe, it, expect, beforeEach } from "vitest";
import { AgentRegistry } from "../../backend/src/services/agents/agentRegistry.js";
import { AgentTaskPlanner } from "../../backend/src/services/agents/agentTaskPlanner.js";
import { MultiAgentCoordinator } from "../../backend/src/services/operations/multiAgentCoordinator.js";
import { CommunicationQueueService } from "../../backend/src/services/comms/communicationQueueService.js";
import { ReplayStateManager } from "../../backend/src/services/replay/replayStateManager.js";
import { WhatIfSimulationEngine } from "../../backend/src/services/simulation/whatIfSimulationEngine.js";
import { MonteCarloEngine } from "../../backend/src/services/simulation/monteCarloEngine.js";
import { SimulationScenarioManager } from "../../backend/src/services/simulation/simulationScenarioManager.js";
import { MissionStateCoordinator } from "../../backend/src/services/state/missionStateCoordinator.js";
import { AgentTask } from "../../backend/src/services/agents/agentTypes.js";

describe("WS5 + WS6: Multi-Agent Operations, Digital Twin & Mission Simulation", () => {
  beforeEach(() => {
    AgentRegistry.resetAgents();
    MissionStateCoordinator.initialize();
  });

  describe("Part 1: Multi-Agent Coordination & Capability-Aware Task Allocation", () => {
    it("initializes structured capabilities across all 5 expedition agents", () => {
      const agents = AgentRegistry.getAllAgents();
      expect(agents.length).toBe(5);

      const astronaut = agents.find((a) => a.type === "ASTRONAUT")!;
      const scout = agents.find((a) => a.callsign.includes("SCOUT"))!;
      const science = agents.find((a) => a.callsign.includes("SCIENCE"))!;
      const relay = agents.find((a) => a.callsign.includes("RELAY") && a.type === "ROVER")!;
      const orbiter = agents.find((a) => a.type === "ORBITER")!;

      expect(astronaut.structuredCapabilities).toBeDefined();
      expect(astronaut.structuredCapabilities!.mobility.maxSlopeDeg).toBe(20.0);
      expect(astronaut.structuredCapabilities!.enduranceMinutes).toBe(240);

      expect(scout.structuredCapabilities!.hasLidar).toBe(true);
      expect(scout.structuredCapabilities!.mobility.maxSlopeDeg).toBe(20.0);

      expect(science.structuredCapabilities!.hasDrill).toBe(true);
      expect(science.structuredCapabilities!.sampleTubeCapacity).toBe(15);

      expect(relay.structuredCapabilities!.communicationRelay.isRelay).toBe(true);
      expect(relay.structuredCapabilities!.communicationRelay.relayRangeKm).toBe(12.0);

      expect(orbiter.structuredCapabilities!.communicationRelay.isRelay).toBe(true);
      expect(orbiter.structuredCapabilities!.communicationRelay.relayRangeKm).toBe(850.0);
    });

    it("allocates tasks to the most suitable agent based on structured capabilities", () => {
      // 1. Task requiring rock abrasion drill should be allocated to ROVER-02 SCIENCE
      const drillTask = AgentTaskPlanner.createTask({
        agentId: "",
        taskType: "COLLECT_SCIENCE",
        priority: "HIGH",
        name: "Delta Clay Core Extraction",
        targetCoordinate: { latitude: 18.448, longitude: 77.405 },
        description: "Abrasion core drill sampling into delta bottomset strata",
        estimatedDurationMin: 60,
        requiredBatteryPercent: 15,
      });

      const allocDrill = MultiAgentCoordinator.allocateTask(drillTask);
      expect(allocDrill.success).toBe(true);
      expect(allocDrill.assignedAgent!.callsign).toContain("SCIENCE");

      // 2. High-speed terrain laser recon should be allocated to ROVER-01 SCOUT
      const reconTask = AgentTaskPlanner.createTask({
        agentId: "",
        taskType: "SURVEY_TERRAIN",
        priority: "HIGH",
        name: "Scarp Lidar Profiling",
        targetCoordinate: { latitude: 18.455, longitude: 77.41 },
        description: "Laser profiling along steep scarp ridge",
        estimatedDurationMin: 40,
        requiredBatteryPercent: 12,
      });

      const allocRecon = MultiAgentCoordinator.allocateTask(reconTask);
      expect(allocRecon.success).toBe(true);
      expect(allocRecon.assignedAgent!.callsign).toContain("SCOUT");
    });

    it("enforces task dependencies and marks dependent tasks blocked until predecessors complete", () => {
      const predTask = AgentTaskPlanner.createTask({
        agentId: "agent-rover-01",
        taskType: "SURVEY_TERRAIN",
        priority: "HIGH",
        name: "Predecessor Hazard Survey",
        targetCoordinate: { latitude: 18.448, longitude: 77.432 },
        estimatedDurationMin: 30,
        requiredBatteryPercent: 10,
      });
      MultiAgentCoordinator.allocateTask(predTask);

      const dependentTask = AgentTaskPlanner.createTask({
        agentId: "agent-rover-02",
        taskType: "COLLECT_SCIENCE",
        priority: "HIGH",
        name: "Follow-up Core Drilling",
        targetCoordinate: { latitude: 18.448, longitude: 77.432 },
        estimatedDurationMin: 45,
        requiredBatteryPercent: 15,
        dependencies: [predTask.id],
      });

      const scienceAgent = AgentRegistry.getAgentById("agent-rover-02")!;
      const check = AgentTaskPlanner.checkTaskEligibility(scienceAgent, dependentTask, MultiAgentCoordinator.getActiveTasks());
      expect(check.eligible).toBe(false);
      expect(check.blockedByDependency).toBe(predTask.id);

      // Complete predecessor task
      predTask.status = "COMPLETED";
      const checkAfter = AgentTaskPlanner.checkTaskEligibility(scienceAgent, dependentTask, MultiAgentCoordinator.getActiveTasks());
      expect(checkAfter.eligible).toBe(true);
    });

    it("supports dynamic task reassignment with safety validation", () => {
      const task = AgentTaskPlanner.createTask({
        agentId: "agent-rover-01",
        taskType: "VERIFY_ROUTE",
        priority: "HIGH",
        name: "Relay Knoll Check",
        targetCoordinate: { latitude: 18.446, longitude: 77.445 },
        estimatedDurationMin: 25,
        requiredBatteryPercent: 8,
      });
      MultiAgentCoordinator.allocateTask(task);

      const reassign = MultiAgentCoordinator.reassignTask(task.id, "agent-rover-03", "Scout diverted to emergency recon");
      expect(reassign.success).toBe(true);
      expect(reassign.task!.agentId).toBe("agent-rover-03");

      const rover3 = AgentRegistry.getAgentById("agent-rover-03")!;
      expect(rover3.currentTask?.id).toBe(task.id);
    });

    it("handles agent failure by automatically reassigning tasks or blocking them", () => {
      const task = AgentTaskPlanner.createTask({
        agentId: "agent-rover-01",
        taskType: "SURVEY_TERRAIN",
        priority: "HIGH",
        name: "Scout Recon Mission Alpha",
        targetCoordinate: { latitude: 18.448, longitude: 77.432 },
        estimatedDurationMin: 30,
        requiredBatteryPercent: 10,
      });
      MultiAgentCoordinator.allocateTask(task);

      const failover = MultiAgentCoordinator.handleAgentFailure("agent-rover-01", "Left drive rocker actuator locked");
      expect(failover.affectedTasks.length).toBeGreaterThan(0);

      const failedAgent = AgentRegistry.getAgentById("agent-rover-01")!;
      expect(failedAgent.status).toBe("EMERGENCY");
    });

    it("supports collaborative multi-agent assignments", () => {
      const primaryTask = AgentTaskPlanner.createTask({
        agentId: "agent-astronaut-01",
        taskType: "COLLECT_SCIENCE",
        priority: "HIGH",
        name: "Human-Robotic Joint Geological Sampling",
        targetCoordinate: { latitude: 18.445, longitude: 77.44 },
        estimatedDurationMin: 60,
        requiredBatteryPercent: 10,
      });

      const collab = MultiAgentCoordinator.assignCollaborativeTask(primaryTask, ["agent-rover-01", "agent-rover-03"]);
      expect(collab.success).toBe(true);
      expect(collab.supportingAgents.length).toBe(2);
      expect(collab.primaryTask.collaboratingAgentIds).toContain("agent-rover-01");
      expect(collab.primaryTask.collaboratingAgentIds).toContain("agent-rover-03");
    });
  });

  describe("Part 2: Communication & Priority-Based Message Scheduling", () => {
    it("enforces 5 priority classes with highest priority emergency scheduling", () => {
      CommunicationQueueService.setQueue([]);

      // Enqueue lower priority science data first
      CommunicationQueueService.enqueuePacket({
        sourceAgentId: "agent-rover-02",
        priority: "SCIENTIFIC_OBSERVATIONS",
        type: "SCIENCE_DATA",
        payloadSizeKb: 2400,
      });

      // Enqueue routine status
      CommunicationQueueService.enqueuePacket({
        sourceAgentId: "agent-rover-03",
        priority: "ROUTINE_STATUS",
        type: "STATUS_UPDATE",
        payloadSizeKb: 10,
      });

      // Enqueue high emergency safety command last
      CommunicationQueueService.enqueuePacket({
        sourceAgentId: "agent-astronaut-01",
        priority: "EMERGENCY_SAFETY",
        type: "EMERGENCY_SOS",
        payloadSizeKb: 4,
      });

      const queue = CommunicationQueueService.getQueue();
      expect(queue.length).toBe(3);

      // Flush queue with active contact (2048 kbps)
      const flush = CommunicationQueueService.flushQueue(true, 2048);
      expect(flush.transmitted.length).toBe(3);
      // Emergency message MUST be transmitted first
      expect(flush.transmitted[0].priority).toBe("EMERGENCY_SAFETY");
      expect(flush.transmitted[0].transmissionDelaySeconds).toBeDefined();
    });

    it("preserves store-and-forward packets in buffer during communication blackouts without faking delivery", () => {
      CommunicationQueueService.setQueue([]);

      CommunicationQueueService.enqueuePacket({
        sourceAgentId: "agent-rover-01",
        priority: "MISSION_CRITICAL_OPS",
        type: "COMMAND",
        payloadSizeKb: 8,
        storeAndForward: true,
      });

      // Link is unavailable (blackout)
      const flush = CommunicationQueueService.flushQueue(false, 0);
      expect(flush.transmitted.length).toBe(0);
      expect(flush.buffered.length).toBe(1);
      expect(flush.buffered[0].status).toBe("BUFFERED");
    });

    it("expires packets exceeding TTL duration", () => {
      CommunicationQueueService.setQueue([]);

      const oldPacket = CommunicationQueueService.enqueuePacket({
        sourceAgentId: "agent-rover-02",
        priority: "ROUTINE_STATUS",
        type: "STATUS_UPDATE",
        payloadSizeKb: 5,
        ttlMinutes: 30,
      });

      // Artificially age the packet by 45 minutes
      oldPacket.createdAt = new Date(Date.now() - 45 * 60 * 1000).toISOString();

      const flush = CommunicationQueueService.flushQueue(false, 0);
      expect(flush.expired.length).toBe(1);
      expect(flush.expired[0].status).toBe("EXPIRED");
    });
  });

  describe("Part 3: Digital Twin State Synchronization", () => {
    it("hydrates Digital Twin from canonical mission state with full consistency", () => {
      const dtManager = new ReplayStateManager();
      dtManager.hydrateFromCanonicalState();

      const agents = dtManager.getAgents();
      expect(agents.length).toBeGreaterThanOrEqual(4);

      const inconsistencyReport = dtManager.detectInconsistencies();
      expect(inconsistencyReport.isConsistent).toBe(true);
      expect(inconsistencyReport.discrepancies.length).toBe(0);
    });

    it("creates immutable snapshots with cryptographic SHA-256 state hashes", () => {
      const dtManager = new ReplayStateManager();
      dtManager.hydrateFromCanonicalState();

      const snap1 = dtManager.createSnapshot("pre-eva-baseline", 15);
      expect(snap1.snapshotId).toContain("snap-pre-eva-baseline");
      expect(snap1.stateHash).toBeDefined();
      expect(snap1.stateHash.length).toBe(64);

      // Verify state retrieval
      const retrieved = dtManager.getSnapshot(snap1.snapshotId);
      expect(retrieved).toBeDefined();
      expect(retrieved!.stateHash).toBe(snap1.stateHash);
    });

    it("detects telemetry inconsistencies when local twin state diverges from canonical state", () => {
      const dtManager = new ReplayStateManager();
      dtManager.hydrateFromCanonicalState();

      // Intentionally diverge battery on local Digital Twin agent
      dtManager.applyIncrementalUpdate("agent_telemetry", {
        agentId: "agent-rover-01",
        batteryPercent: 35.0, // Canonical is ~85%
      });

      const report = dtManager.detectInconsistencies();
      expect(report.isConsistent).toBe(false);
      expect(report.discrepancies.length).toBeGreaterThan(0);
      expect(report.discrepancies[0].domain).toContain("battery");
    });
  });

  describe("Part 4: Real What-If Simulation on Isolated State", () => {
    it("evaluates battery failure scenario without mutating live canonical mission state", () => {
      const canonicalBefore = JSON.parse(JSON.stringify(MissionStateCoordinator.getCanonicalState()));

      const simResult = WhatIfSimulationEngine.runWhatIfSimulation({
        baselineMissionId: "MARSWALK-001",
        forkSimTimeMinutes: 20,
        decisionOverride: "BATTERY_FAILURE",
      });

      expect(simResult.simulationId).toBeDefined();
      expect(simResult.alternative.batteryPercent).toBeLessThan(20.0);
      expect(simResult.routeFeasible).toBe(false);
      expect(simResult.newHazards.length).toBeGreaterThan(0);
      expect(simResult.verdict).toContain("CRITICAL SAFETY FINDING");

      // Verify that live canonical mission state was NEVER mutated
      const canonicalAfter = JSON.parse(JSON.stringify(MissionStateCoordinator.getCanonicalState()));
      expect(canonicalAfter.resources.fleetBatterySoc).toEqual(canonicalBefore.resources.fleetBatterySoc);
    });

    it("evaluates communication blackout and combines multiple scenario triggers", () => {
      const simResult = WhatIfSimulationEngine.runWhatIfSimulation({
        baselineMissionId: "MARSWALK-001",
        forkSimTimeMinutes: 25,
        scenarios: ["COMMUNICATION_BLACKOUT", "BATTERY_DEGRADATION"],
      });

      expect(simResult.alternative.commReliabilityPercent).toBeLessThan(50);
      expect(simResult.alternative.batteryPercent).toBeLessThan(simResult.baseline.batteryPercent);
      expect(simResult.comparison.durationDeltaMin).toBeDefined();
      expect(simResult.recommendedMitigation.length).toBeGreaterThan(0);
    });
  });

  describe("Part 5: Seeded Monte Carlo Simulation on Mission Parameters", () => {
    it("generates deterministic and reproducible distributions with identical random seeds", () => {
      const run1 = MonteCarloEngine.runAnalysis({ runCount: 80, seed: 42109 });
      const run2 = MonteCarloEngine.runAnalysis({ runCount: 80, seed: 42109 });

      expect(run1.successProbabilityPercent).toBe(run2.successProbabilityPercent);
      expect(run1.batteryReserveDistribution.p10).toBe(run2.batteryReserveDistribution.p10);
      expect(run1.durationDistributionMinutes.mean).toBe(run2.durationDistributionMinutes.mean);
      expect(run1.durationDistributionMinutes.confidenceInterval95).toEqual(run2.durationDistributionMinutes.confidenceInterval95);
    });

    it("rejects invalid run counts outside permitted boundaries", () => {
      expect(() => MonteCarloEngine.runAnalysis({ runCount: -10 })).toThrow(/Invalid runCount/);
      expect(() => MonteCarloEngine.runAnalysis({ runCount: 100000 })).toThrow(/Invalid runCount/);
    });

    it("clearly distinguishes modeled uncertainty from measured empirical truth", () => {
      const analysis = MonteCarloEngine.runAnalysis({ runCount: 50, seed: 12345 });

      expect(analysis.classification).toBe("SIMULATED / MONTE CARLO");
      expect(analysis.modeledVersusMeasuredNote).toContain("MODELED UNCERTAINTY ONLY");
      expect(analysis.baselineParameters).toBeDefined();
    });
  });

  describe("Part 6: Simulation Scenario Manager Integration", () => {
    it("records simulation evaluations in historical lineage and audit chain", () => {
      const result = SimulationScenarioManager.evaluateWhatIf({
        baselineMissionId: "MARSWALK-001",
        forkSimTimeMinutes: 18,
        decisionOverride: "ROVER_BREAKDOWN",
      });

      expect(result.simulationId).toBeDefined();
      const history = SimulationScenarioManager.getSimulationHistory();
      expect(history.length).toBeGreaterThan(0);

      const latest = history[history.length - 1];
      expect(latest.type).toBe("WHAT_IF");
      expect(latest.provenance).toBeDefined();
      expect(latest.provenance.sourceType).toBe("DERIVED");
    });
  });
});

