import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../backend/src/app.js";
import { MissionReportService } from "../../backend/src/services/reporting/missionReportService.js";
import { missionReasoningService } from "../../backend/src/services/intelligence/missionReasoningService.js";
import { AgentRegistry } from "../../backend/src/services/agents/agentRegistry.js";
import { MissionStateCoordinator } from "../../backend/src/services/state/missionStateCoordinator.js";

describe("WS7 + WS8: Mission Planning Workspace, Reporting, Copilot & Digital Twin", () => {
  beforeEach(() => {
    AgentRegistry.resetAgents();
  });

  describe("Mission Report Service", () => {
    it("generates a comprehensive structured JSON mission report grounded in canonical state", () => {
      const report = MissionReportService.generateReport("MARSWALK-001");

      expect(report.reportId).toBeDefined();
      expect(report.missionId).toBe("MARSWALK-001");
      expect(report.classification).toBe("DERIVED / MULTI-SOURCE SYNTHESIS");
      expect(report.provenanceNotice).toContain("distinguish modeled projections from empirical rover telemetry");

      // Executive Summary
      expect(report.executiveSummary.status).toBeDefined();
      expect(report.executiveSummary.overallSafetyScore).toBeGreaterThanOrEqual(0);
      expect(report.executiveSummary.activeAgentsCount).toBe(5);
      expect(report.executiveSummary.auditChainBlockHeight).toBeGreaterThan(0);
      expect(report.executiveSummary.auditChainValid).toBe(true);

      // Candidate Routes & Decision Rationale
      expect(report.missionPlan.candidateRoutesSummary.length).toBeGreaterThan(0);
      const recommended = report.missionPlan.candidateRoutesSummary.find(
        (c) => c.recommendationStatus === "RECOMMENDED"
      );
      expect(recommended).toBeDefined();
      expect(recommended?.rationale).toContain("Pareto-optimal");

      // Fleet capabilities
      expect(report.fleetStatus.length).toBe(5);
      const scout = report.fleetStatus.find((a) => a.callsign.includes("SCOUT"));
      expect(scout).toBeDefined();
      expect(scout?.maxSlopeDeg).toBe(20);

      // Invariants S1-S8
      expect(report.safetyInvariantAudits.length).toBeGreaterThanOrEqual(5);
      const s1 = report.safetyInvariantAudits.find((s) => s.id === "S1");
      expect(s1?.status).toBe("PASS");

      // Decision Lineage
      expect(report.decisionLineageSummary.length).toBeGreaterThan(0);
    });

    it("generates multi-table CSV export format with correct headers and escaping", () => {
      const csv = MissionReportService.generateCsvReport("MARSWALK-001");

      expect(csv).toContain('"MISSION REPORT - MARSWALK-001"');
      expect(csv).toContain('"--- EXECUTIVE SUMMARY ---"');
      expect(csv).toContain('"--- EXPEDITION FLEET STATUS ---"');
      expect(csv).toContain('"--- ROUTE CANDIDATES & DECISION RATIONALE ---"');
      expect(csv).toContain('"--- SAFETY INVARIANTS S1-S8 COMPLIANCE ---"');
      expect(csv).toContain('"--- HAZARD MITIGATION REGISTER ---"');
      expect(csv).toContain('"--- STOCHASTIC MONTE CARLO UNCERTAINTY ---"');
    });

    it("generates clean Markdown briefing with GitHub flavored markdown alerts", () => {
      const md = MissionReportService.generateMarkdownReport("MARSWALK-001");

      expect(md).toContain("# MARTIAN EXPEDITION MISSION REPORT");
      expect(md).toContain("> [!NOTE]");
      expect(md).toContain("## 1. Executive Summary");
      expect(md).toContain("## 2. Mission Plan & Route Decision Lineage");
      expect(md).toContain("## 3. Expedition Fleet Status & Structured Capabilities");
      expect(md).toContain("## 4. Safety Invariants S1–S8 Compliance");
      expect(md).toContain("## 5. Hazard Register & Mitigations");
    });
  });

  describe("Mission Report API Endpoints", () => {
    it("GET /api/missions/:id/report returns structured JSON report", async () => {
      const res = await request(app).get("/api/missions/MARSWALK-001/report");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.missionId).toBe("MARSWALK-001");
      expect(res.body.data.executiveSummary).toBeDefined();
    });

    it("GET /api/missions/:id/report?format=csv returns downloadable text/csv", async () => {
      const res = await request(app).get("/api/missions/MARSWALK-001/report?format=csv");

      expect(res.status).toBe(200);
      expect(res.header["content-type"]).toContain("text/csv");
      expect(res.text).toContain("EXECUTIVE SUMMARY");
    });

    it("GET /api/missions/:id/report?format=markdown returns downloadable markdown", async () => {
      const res = await request(app).get("/api/missions/MARSWALK-001/report?format=markdown");

      expect(res.status).toBe(200);
      expect(res.header["content-type"]).toContain("text/markdown");
      expect(res.text).toContain("# MARTIAN EXPEDITION MISSION REPORT");
    });
  });

  describe("Grounded Mission Copilot Decision Explanations", () => {
    it("explains why a route was recommended and rejected alternatives", () => {
      const res = missionReasoningService.generateOperationsCopilotResponse(
        "Why was this route recommended over alternatives?"
      );

      expect(res.assessment).toContain("Recommended route");
      expect(res.observedFact).toContain("Selected route distance");
      expect(res.derivedInsight).toContain("Rejected alternatives");
      expect(res.evidence.length).toBeGreaterThan(0);
      expect(res.options.length).toBeGreaterThan(0);
      expect(res.provenance.sourceName).toContain("Multi-Objective Route Selection Rule");
    });

    it("explains safety invariants S1-S8 as hard non-negotiable constraints", () => {
      const res = missionReasoningService.generateOperationsCopilotResponse(
        "Explain safety invariants S1-S8"
      );

      expect(res.assessment).toContain("8 non-negotiable safety invariants");
      expect(res.observedFact).toContain("Current state");
      expect(res.evidence.some((e) => e.includes("Invariant S1"))).toBe(true);
      expect(res.provenance.sourceName).toContain("Safety Invariants Framework");
    });

    it("explains emergency return margin and battery energy reserves", () => {
      const res = missionReasoningService.generateOperationsCopilotResponse(
        "What is our emergency return reserve margin?"
      );

      expect(res.assessment).toContain("satisfying NASA's 30-minute reserve rule (Invariant S3)");
      expect(res.provenance.sourceName).toContain("Energy & Emergency Return Policy");
    });

    it("summarizes fleet agent structured capabilities and task specialization", () => {
      const res = missionReasoningService.generateOperationsCopilotResponse(
        "Which rover has the rotary drill and can do sampling?"
      );

      expect(res.assessment).toContain("ROVER-02 SCIENCE");
      expect(res.observedFact).toContain("Drill capability");
      expect(res.provenance.sourceName).toContain("Fleet Specialization Policy");
    });

    it("summarizes stochastic Monte Carlo uncertainty with confidence intervals", () => {
      const res = missionReasoningService.generateOperationsCopilotResponse(
        "Explain Monte Carlo uncertainty distributions"
      );

      expect(res.assessment).toContain("Monte Carlo simulation");
      expect(res.simulatedContext).toContain("Classification: SIMULATED / MONTE CARLO");
    });
  });

  describe("Digital Twin & Task Reassignment Endpoints", () => {
    it("POST /api/operations/digital-twin/snapshot creates a cryptographic state snapshot", async () => {
      const res = await request(app)
        .post("/api/operations/digital-twin/snapshot")
        .send({ tag: "TEST_CHECKPOINT" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.stateHash).toBeDefined();
      expect(res.body.data.tag).toBe("TEST_CHECKPOINT");
    });

    it("GET /api/operations/digital-twin/inconsistencies verifies state consistency with canonical state", async () => {
      const res = await request(app).get("/api/operations/digital-twin/inconsistencies");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isConsistent).toBeDefined();
      expect(Array.isArray(res.body.data.discrepancies)).toBe(true);
    });

    it("POST /api/operations/tasks/reassign safely reassigns tasks between eligible agents", async () => {
      // Create a task on ROVER-01
      const taskRes = await request(app)
        .post("/api/operations/agents/agent-rover-01/tasks")
        .send({
          name: "Verify Traverse Corridor",
          taskType: "VERIFY_ROUTE",
          priority: "HIGH",
          targetCoordinate: { latitude: 18.45, longitude: 77.46 },
          estimatedDurationMin: 35,
          requiredBatteryPercent: 12,
        });

      expect(taskRes.status).toBe(201);
      const taskId = taskRes.body.data.task.id;

      // Reassign to ROVER-03
      const reassignRes = await request(app)
        .post("/api/operations/tasks/reassign")
        .send({
          taskId,
          targetAgentId: "agent-rover-03",
          reason: "Load rebalancing due to high priority corridor verification",
        });

      expect(reassignRes.status).toBe(200);
      expect(reassignRes.body.success).toBe(true);
      expect(reassignRes.body.data.message).toContain("successfully transferred");
    });
  });
});
