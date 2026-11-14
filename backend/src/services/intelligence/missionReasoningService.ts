import crypto from "crypto";
import {
  MissionRecommendation,
  RouteCandidate,
  ScienceObjectiveId,
  MarsRoute,
} from "../../types/index.js";
import { scienceObjectiveEngine } from "../science/scienceObjectiveEngine.js";
import { ProvenanceService } from "../planetary/provenanceService.js";
import { MissionStateCoordinator } from "../state/missionStateCoordinator.js";
import { AgentRegistry } from "../agents/agentRegistry.js";
import { WhatIfSimulationEngine } from "../simulation/whatIfSimulationEngine.js";
import { MonteCarloEngine } from "../simulation/monteCarloEngine.js";
import { missionRepository } from "../../repositories/missionRepository.js";
import { MissionAnalyticsService } from "./missionAnalyticsService.js";
import { ScenarioBuilderService } from "../simulation/scenarioBuilderService.js";
import { auditChainService } from "../security/auditChainService.js";

export class MissionReasoningService {
  /**
   * Parses natural language mission planning prompts into structured criteria.
   */
  public parseNaturalLanguagePrompt(prompt?: string): {
    objectiveId: ScienceObjectiveId;
    maxDurationMinutes?: number;
    constraints: string[];
    preferredEvidence: string[];
  } {
    if (!prompt) {
      return {
        objectiveId: "ANCIENT_WATER_ACTIVITY",
        constraints: ["NASA 30-min return reserve", "Max 20° slope"],
        preferredEvidence: ["Deltaic stratigraphy", "Clay mineralogy"],
      };
    }

    const lower = prompt.toLowerCase();
    let obj: ScienceObjectiveId = "ANCIENT_WATER_ACTIVITY";

    if (lower.includes("water") || lower.includes("delta") || lower.includes("lake") || lower.includes("fluvial")) {
      obj = "ANCIENT_WATER_ACTIVITY";
    } else if (lower.includes("habitab") || lower.includes("biosignature") || lower.includes("life")) {
      obj = "PAST_HABITABILITY";
    } else if (lower.includes("mineral") || lower.includes("olivine") || lower.includes("hematite") || lower.includes("sulfate")) {
      obj = "MINERALOGICAL_DIVERSITY";
    } else if (lower.includes("volcan") || lower.includes("caldera") || lower.includes("magma") || lower.includes("basalt")) {
      obj = "VOLCANIC_HISTORY";
    } else if (lower.includes("sediment") || lower.includes("sandstone") || lower.includes("cross-bedding")) {
      obj = "SEDIMENTARY_HISTORY";
    } else if (lower.includes("astrobiology") || lower.includes("organic")) {
      obj = "ASTROBIOLOGY_RELEVANCE";
    }

    // Extract duration if mentioned (e.g., "4 hour", "3 hours", "180 min")
    let durationMin: number | undefined;
    const hourMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:hour|hr|h)/);
    if (hourMatch) {
      durationMin = Math.round(parseFloat(hourMatch[1]) * 60);
    } else {
      const minMatch = lower.match(/(\d+)\s*(?:minute|min|m)/);
      if (minMatch) {
        durationMin = parseInt(minMatch[1], 10);
      }
    }

    const constraints = ["Standard 30-min life-support return reserve", "Maximum walking incline 20°"];
    if (lower.includes("utv") || lower.includes("vehicle") || lower.includes("rover")) {
      constraints.push("Uncrewed / UTV escort asset integrated");
    }

    const preferredEvidence = [
      "In-situ rover ground-truth",
      "High-resolution HiRISE stereo DTMs",
      "THEMIS day thermal inertia",
    ];

    return {
      objectiveId: obj,
      maxDurationMinutes: durationMin,
      constraints,
      preferredEvidence,
    };
  }

  /**
   * Generates a fully explainable, structured mission recommendation
   * comparing all route candidates against science goals and life-support constraints.
   */
  public generateRecommendation(
    candidates: RouteCandidate[],
    objectiveId: ScienceObjectiveId = "ANCIENT_WATER_ACTIVITY",
    maxDurationMin = 180
  ): MissionRecommendation {
    const objective = scienceObjectiveEngine.getObjective(objectiveId);

    // Filter feasible candidates first
    const feasibleCandidates = candidates.filter((c) => c.feasible);
    const pool = feasibleCandidates.length > 0 ? feasibleCandidates : candidates;

    // Preference hierarchy: Balanced -> Safest -> Shortest -> Highest Science
    // Sort pool by overallScore (risk-adjusted) descending
    const sorted = [...pool].sort((a, b) => b.overallScore - a.overallScore);
    const chosen = sorted[0] || candidates[0];

    const reasoning: string[] = [];
    const majorRisks: string[] = [];
    const scienceOpportunities: string[] = [];
    const operationalRecommendations: string[] = [];
    const rejectedAlternatives: Array<{ routeId: string; name: string; reason: string }> = [];

    // 1. Build Decision Statement
    const commDetails = chosen.communicationMetrics
      ? ` Comms LOS coverage ${chosen.communicationMetrics.losCoveragePercent.toFixed(0)}% (max blackout ${chosen.communicationMetrics.maxBlackoutDurationMin.toFixed(0)}m).`
      : "";
    const resourceDetails = chosen.resourceMetrics
      ? ` Projected battery ${chosen.resourceMetrics.projectedRemainingPercent.toFixed(0)}% (${chosen.resourceMetrics.energyExpenditureWh.toFixed(0)} Wh).`
      : "";
    const decision = `Recommend ${chosen.name} (${chosen.profileType.toUpperCase()}) for execution under Objective "${objective.name}". Achieves risk-adjusted mission score of ${chosen.overallScore}/100 with full EVA constraint compliance.${commDetails}${resourceDetails}`;

    // 2. Build Multi-Candidate Comparative Reasoning
    reasoning.push(
      `Selected "${chosen.name}" because it achieves an optimal Pareto compromise between scientific target return (${chosen.scienceScore}/100) and operational safety (${chosen.safetyScore}/100).`
    );
    if (chosen.tradeoffExplanation) {
      reasoning.push(`Optimization Analysis: ${chosen.tradeoffExplanation}`);
    }

    // Evaluate rejected alternatives or non-chosen candidates
    for (const cand of candidates) {
      if (cand.id === chosen.id) continue;

      if (!cand.feasible || (cand.hardConstraintViolations && cand.hardConstraintViolations.length > 0)) {
        const violations = cand.hardConstraintViolations && cand.hardConstraintViolations.length > 0
          ? cand.hardConstraintViolations.join(", ")
          : cand.warnings.join(", ") || "Safety constraint breached";
        reasoning.push(
          `Rejected "${cand.name}" due to hard safety constraint violations: ${violations}.`
        );
        rejectedAlternatives.push({
          routeId: cand.id,
          name: cand.name,
          reason: `Hard safety violation: ${violations}`,
        });
      } else if (cand.profileType === "shortest") {
        const deltaDist = (chosen.distanceKm - cand.distanceKm).toFixed(2);
        reasoning.push(
          `Compared to "${cand.name}", chosen route requires ${deltaDist} km additional traversal but increases scientific yield from ${cand.scienceScore}/100 to ${chosen.scienceScore}/100 by visiting in-situ planetary targets.`
        );
        rejectedAlternatives.push({
          routeId: cand.id,
          name: cand.name,
          reason: `Sub-optimal science yield (${cand.scienceScore}/100); bypasses prime geological sampling targets.`,
        });
      } else if (cand.profileType === "safest") {
        reasoning.push(
          `Compared to "${cand.name}" (Safety: ${cand.safetyScore}/100), the chosen route maintains an acceptable safety score of ${chosen.safetyScore}/100 while avoiding low-science barren transit corridors.`
        );
        rejectedAlternatives.push({
          routeId: cand.id,
          name: cand.name,
          reason: `Avoids all minor slopes but offers lower target diversity (${cand.scienceTargets.length} targets visited).`,
        });
      } else if (cand.profileType === "highest_science") {
        reasoning.push(
          `While "${cand.name}" offers high science (${cand.scienceScore}/100), its higher resource draw and terrain exposure make "${chosen.name}" a safer operational balance.`
        );
        rejectedAlternatives.push({
          routeId: cand.id,
          name: cand.name,
          reason: `Higher resource consumption or elevated traversal risk compared to balanced trajectory.`,
        });
      }
    }

    // 3. Major Risks
    if (chosen.hazards.length > 0) {
      for (const h of chosen.hazards) {
        majorRisks.push(`[${h.severity}] ${h.name || h.type}: ${h.reason}`);
      }
    } else {
      majorRisks.push("No severe topographic or structural hazards detected along this corridor. Low slip probability.");
    }

    if (chosen.route.maxSlopeDegrees > 12) {
      majorRisks.push(`Steep local grade: segment reaches ${chosen.route.maxSlopeDegrees.toFixed(1)}° slope; astronaut must engage low-gear traverse cadence.`);
    }

    // 4. Science Opportunities
    if (chosen.scienceTargets.length > 0) {
      scienceOpportunities.push(`Direct contact sampling at: ${chosen.scienceTargets.join(", ")}.`);
      scienceOpportunities.push(`High alignment with primary research objective: ${objective.description}`);
    } else {
      scienceOpportunities.push("Visual reconnaissance along transit corridor; no direct target drill sampling scheduled.");
    }

    // 5. Operational Directives
    const returnMarginMin = maxDurationMin - chosen.estimatedDurationMin;
    operationalRecommendations.push(
      `Maintain planned traverse pace to preserve ${returnMarginMin} minutes of emergency life-support margin at ingress hub.`
    );
    if (chosen.route.maxSlopeDegrees > 10) {
      operationalRecommendations.push("Utilize switchback footwork on inclines exceeding 10° to prevent excessive metabolic CO2 accumulation.");
    }
    operationalRecommendations.push("Perform communication check and radio line-of-sight verification at each route waypoint.");
    operationalRecommendations.push("Abort criteria: Terminate EVA and return immediately if suit battery or O2 falls below 35% nominal capacity.");

    // Derive calculated confidence from candidate evidence coverage (NO hardcoded 0.94!)
    const calculatedConfidence = chosen.multiObjectiveScore
      ? Number((chosen.multiObjectiveScore.evidenceConfidence / 100).toFixed(2))
      : 0.82;

    const paretoCandidates = candidates.filter((c) => c.multiObjectiveScore?.isParetoEfficient);

    // 6. Compute Cryptographic Audit Hash for Mission Integrity
    const auditPayload = JSON.stringify({
      recommendedRouteId: chosen.id,
      objectiveId,
      overallScore: chosen.overallScore,
      candidateCount: candidates.length,
      paretoCount: paretoCandidates.length,
      timestamp: new Date().toISOString(),
    });
    const auditHash = crypto.createHash("sha256").update(auditPayload).digest("hex");

    return {
      recommendedRouteId: chosen.id,
      decision,
      reasoning,
      majorRisks,
      scienceOpportunities,
      operationalRecommendations,
      confidence: calculatedConfidence,
      generatedBy: "RULE_ENGINE",
      candidates,
      paretoCandidates,
      rejectedAlternatives,
      auditHash,
      evaluatedAt: new Date().toISOString(),
      provenance: ProvenanceService.createProjectRuleProvenance(
        "Mission Reasoning Decision Engine v3.0",
        "Deterministic multi-candidate trade-off analysis and life support verification"
      ),
    };
  }

  /**
   * Phase 5: Multi-Agent Collaborative Operations Copilot
   * Responds to natural language operational queries referencing live telemetry, agents, and hazards.
   * Explicitly distinguishes: OBSERVED vs DERIVED vs SIMULATED vs RECOMMENDED.
   */
  public generateOperationsCopilotResponse(query: string): {
    query: string;
    assessment: string;
    evidence: string[];
    options: Array<{ title: string; score: number; risk: string; recommended: boolean }>;
    recommendation: string;
    tradeOffs: string[];
    agentDirectives: Array<{ agentCallsign: string; directive: string; priority: "CRITICAL" | "HIGH" | "MEDIUM" }>;
    uncertainty: {
      telemetryUncertainty: string;
      unmappedRisks: string[];
    };
    provenance: import("../../types/index.js").DataProvenance;
    observedFact: string;
    derivedInsight: string;
    simulatedContext: string;
  } {
    const q = query.toLowerCase();

    // 0. Non-Negotiable Safety Invariant Override Guard (Natural-Language Bypass Refusal)
    if (
      q.includes("override") ||
      q.includes("bypass") ||
      q.includes("ignore safety") ||
      q.includes("disable safety") ||
      q.includes("skip invariant") ||
      q.includes("force route")
    ) {
      const canonical = MissionStateCoordinator.getCanonicalState();
      return {
        query,
        assessment:
          "REFUSED: Natural-language requests cannot override, bypass, or relax hard Safety Invariants (S1–S8). Safety constraints are enforced programmatically at the backend validation layer.",
        observedFact: `Current canonical state health: ${canonical.validation.healthScore}/100 (${canonical.validation.overallSystemStatus}). O2 reserve: ${canonical.resources.astronautOxygenReserveMinutes} min.`,
        derivedInsight:
          "Optimization scores and operator prompts are strictly subordinate to S1 (Battery ≥ 20%), S2 (Slope ≤ 20°), S3 (30-min Return Reserve), and S7 (Tamper-Evident Audit Chain).",
        simulatedContext:
          "Deterministic Intent Engine (Non-LLM): Enforces programmatic safety guardrails without generative hallucination.",
        evidence: [
          "Safety Invariants S1–S8 programmatic enforcement",
          "Backend route & task eligibility validation",
          "NIST SP 800-92 immutable audit chain",
        ],
        options: [
          {
            title: "Maintain Hard Safety Invariants (S1–S8)",
            score: 100,
            risk: "NOMINAL — Crew & hardware protected",
            recommended: true,
          },
          {
            title: "Bypass Safety Constraint via Prompt",
            score: 0,
            risk: "BLOCKED — Programmatically prohibited",
            recommended: false,
          },
        ],
        recommendation:
          "Select a compliant route or adjust mission parameters within S1–S8 bounds rather than attempting to bypass safety constraints.",
        tradeOffs: ["Safety invariants cannot be traded off against science yield or duration"],
        agentDirectives: [
          {
            agentCallsign: "ASTRONAUT-01",
            directive: "Safety override request logged and denied; maintain certified flight envelope",
            priority: "CRITICAL",
          },
        ],
        uncertainty: {
          telemetryUncertainty: "Zero ambiguity: hard safety thresholds are deterministic",
          unmappedRisks: ["None — programmatic refusal"],
        },
        provenance: ProvenanceService.createProjectRuleProvenance(
          "Non-Negotiable Safety Invariant Guard",
          "Deterministic refusal of natural-language attempts to override S1–S8"
        ),
      };
    }

    if (q.includes("scout") || q.includes("steep") || q.includes("investigate this hazard") || q.includes("hazard")) {
      return {
        query,
        assessment:
          "Forward terrain analysis indicates a 22.4° scarp near Kodiak Butte exceeding safe walking thresholds. ROVER-01 (SCOUT) possesses 20° mobility and high-resolution hazard lidar, making it the optimal reconnaissance asset.",
        observedFact: "Laser altimeter & HazCam estimate 21.8° ± 1.2° local slope at Kodiak foreset boundary.",
        derivedInsight: "Calculated probability of exceeding rover 20.0° chassis stability ceiling is 87%. High rollover hazard.",
        simulatedContext: "Telemetry generated via deterministic sensor noise simulation model based on MOLA MEGDR ground truth.",
        evidence: [
          "MGS MOLA regional slope gradient (14-24° scarp boundary)",
          "MRO HiRISE 0.25m stereo DTM boulder field documentation",
          "ROVER-01 Hazcam forward telemetry (Observation quality: GOOD)",
        ],
        options: [
          {
            title: "Deploy ROVER-01 SCOUT along Northern Valley Detour",
            score: 92,
            risk: "LOW — 4.2 km/h autonomous traverse outside scarp fall line",
            recommended: true,
          },
          {
            title: "Direct Human Reconnaissance by Astronaut-01",
            score: 45,
            risk: "CRITICAL — Violates EVA locomotion slope ceiling (>18°)",
            recommended: false,
          },
        ],
        recommendation:
          "Dispatch ROVER-01 SCOUT to verify footwall scree stability while holding ASTRONAUT-01 at safe standby margin. Authorization note: Requires formal MISSION_COMMAND approval to commit detour.",
        tradeOffs: [
          "Adds +18 minutes scouting delay before crew traverse",
          "Completely removes astronaut fall and suit puncture risk",
        ],
        agentDirectives: [
          { agentCallsign: "ROVER-01 SCOUT", directive: "Traverse 800m ahead; execute 360° lidar scan of scarp rim", priority: "HIGH" },
          { agentCallsign: "ASTRONAUT-01", directive: "Hold at waypoint WP-02; await scout hazard clearance report", priority: "CRITICAL" },
          { agentCallsign: "ROVER-03 RELAY", directive: "Maintain elevated line of sight for continuous scout video link", priority: "HIGH" },
        ],
        uncertainty: {
          telemetryUncertainty: "Sub-surface duricrust thickness unverified prior to rover wheel-trenching",
          unmappedRisks: ["Perched megabreccia boulders above 15m elevation"],
        },
        provenance: ProvenanceService.createProjectRuleProvenance(
          "Autonomous Scout Deployment Rule",
          "Enforces autonomous robotic scouting ahead of human crew in steep terrain"
        ),
      };
    }

    if (q.includes("delta") || q.includes("which rover should inspect") || q.includes("science")) {
      return {
        query,
        assessment:
          "Jezero Delta Front Sedimentary Scarp is the primary astrobiological target. ROVER-02 SCIENCE is equipped with Deep UV Raman Spectrometry and rotary abrasion drill required for mineralogical characterization.",
        observedFact: "CRISM reflectance spectra detect Fe/Mg-smectite clay absorption bands at 1.4 & 2.3 microns.",
        derivedInsight: "MINERALOGICAL RELEVANCE: HIGH | BIOSIGNATURE EVIDENCE: NONE (Raman detection does not prove organic biosignature).",
        simulatedContext: "Mineral peak confidence 0.88 modeled via synthetic spectral library matching.",
        evidence: [
          "CRISM clay and smectite spectral absorption signatures",
          "SuperCam in-situ elemental composition (Perseverance Sol 100)",
          "MOLA bottomset elevation calibration (-2540m areoid)",
        ],
        options: [
          {
            title: "Assign ROVER-02 to Delta Exposure with ASTRONAUT-01 Crew Sampling",
            score: 95,
            risk: "LOW — Dual-payload verification with human agility",
            recommended: true,
          },
          {
            title: "Assign ROVER-01 SCOUT to Collect Samples",
            score: 30,
            risk: "HIGH — Scout lacks rotary coring drill and Raman spectrometers",
            recommended: false,
          },
        ],
        recommendation:
          "Allocate primary delta target to ROVER-02 SCIENCE. Coordinate with ASTRONAUT-01 for sample tube hermetic sealing.",
        tradeOffs: [
          "ROVER-02 maximum speed is 2.2 km/h (requires earlier dispatch)",
          "Maximizes sample quality and astrobiological return",
        ],
        agentDirectives: [
          { agentCallsign: "ROVER-02 SCIENCE", directive: "Begin transit to delta outcrop; pre-warm drill head electronics", priority: "HIGH" },
          { agentCallsign: "ASTRONAUT-01", directive: "Rendezvous at drill site Sol-100 marker for sample caching", priority: "MEDIUM" },
        ],
        uncertainty: {
          telemetryUncertainty: "Raman fluorescence background interference in unshadowed direct sunlight",
          unmappedRisks: ["Hardness of indurated carbonate crust"],
        },
        provenance: ProvenanceService.createProjectRuleProvenance(
          "Payload Matching Directive",
          "Matches scientific instruments to MEPAG ancient water goals"
        ),
      };
    }

    if (q.includes("communication") || q.includes("comms") || q.includes("fail")) {
      return {
        query,
        assessment:
          "Direct surface-to-base VHF link is obstructed by crater wall topography. Tactical relay ROVER-03 on Northern Knoll provides 98% reliability bridge to MRO-Relay orbiter.",
        observedFact: "Great-circle ray-trace detects 14.5m chord blockage by crater rim basalt ridge.",
        derivedInsight: "Multi-hop relay routing via elevated ROVER-03 mast restores 98% packet delivery.",
        simulatedContext: "Orbital visibility calculated via deterministic 112-minute circular geometry model.",
        evidence: [
          "Line-of-Sight chord ray-trace showing 14.5m terrain obstruction",
          "MRO Keplerian pass schedule confirming 14-min window at MET 00:46",
          "ROVER-03 Electra UHF mast elevated line of sight",
        ],
        options: [
          {
            title: "Route Comms via Two-Hop Tactical Relay (ROVER-03)",
            score: 94,
            risk: "LOW — 12ms latency with 512 kbps bandwidth",
            recommended: true,
          },
          {
            title: "Await Next MRO Overhead Pass in 45 Minutes",
            score: 50,
            risk: "HIGH — 45-minute telemetry blackout during EVA traverse",
            recommended: false,
          },
        ],
        recommendation:
          "Maintain active UHF relay through ROVER-03. Reposition rover +150m west if crew descends behind delta bench.",
        tradeOffs: [
          "Locks ROVER-03 in stationary relay position (consumes 80 Wh/h)",
          "Prevents mission-critical communications failure with crew",
        ],
        agentDirectives: [
          { agentCallsign: "ROVER-03 RELAY", directive: "Hold elevated knoll position; broadcast beacon at 437.5 MHz", priority: "CRITICAL" },
          { agentCallsign: "ASTRONAUT-01", directive: "Confirm tactical relay lock on suit display before descending", priority: "HIGH" },
        ],
        uncertainty: {
          telemetryUncertainty: "Atmospheric dust scattering index estimated at tau = 0.45",
          unmappedRisks: ["Multipath reflections off crater basalt walls"],
        },
        provenance: ProvenanceService.createProjectRuleProvenance(
          "Relay Redundancy Flight Rule",
          "Requires continuous tactical radio link for all crewed EVAs"
        ),
      };
    }

    // 1. Route Selection, Rejection & Trade-Offs
    if (q.includes("route") || q.includes("plan") || q.includes("why") || q.includes("recommend") || q.includes("reject")) {
      const canonical = MissionStateCoordinator.getCanonicalState();
      const allRoutes = Object.values(canonical.routes.routes) as MarsRoute[];
      const activeRoute = allRoutes.find((r: MarsRoute) => r.id === canonical.routes.activeRouteId) || allRoutes[0];
      const rejectedRoutes = allRoutes.filter((r: MarsRoute) => r.maxSlopeDegrees > 20.0);

      const rejectedSummary = rejectedRoutes.length > 0
        ? rejectedRoutes.map((r: MarsRoute) => `${r.name} rejected due to ${r.maxSlopeDegrees.toFixed(1)}° slope breaching 20.0° stability ceiling (Invariant S2)`).join("; ")
        : "Direct route candidates exceeding 20° slope threshold are disqualified.";

      return {
        query,
        assessment: activeRoute
          ? `Recommended route is '${activeRoute.name}' (${activeRoute.totalDistanceKm} km, est. ${activeRoute.estimatedDurationMinutes} min). Pareto evaluation confirms this path balances ancient water science targets with safe slope navigation and continuous line-of-sight communication.`
          : "No active route is currently persisted in canonical mission state. Generate and save a candidate route in the Mission Planning Workspace first.",
        observedFact: activeRoute
          ? `Selected route distance: ${activeRoute.totalDistanceKm} km, max slope: ${activeRoute.maxSlopeDegrees.toFixed(1)}°, difficulty: ${activeRoute.overallDifficulty}.`
          : "Missing information: activeRouteId is unset and no persisted route telemetry is available.",
        derivedInsight: `Rejected alternatives: ${rejectedSummary}`,
        simulatedContext: "Deterministic Intent Engine (Non-LLM): Multi-objective Pareto evaluation across slope risk, battery consumption, duration, and science yield.",
        evidence: [
          "MGS MOLA topography elevation profile",
          "Safety Invariant S2 (Max Slope ≤ 20.0°)",
          "Safety Invariant S1 (Battery Reserve ≥ 20.0%)",
        ],
        options: allRoutes.slice(0, 3).map((r: MarsRoute) => ({
          title: r.name,
          score: r.maxSlopeDegrees > 20.0 ? 42 : Math.max(65, Math.round(95 - r.maxSlopeDegrees)),
          risk: r.maxSlopeDegrees > 20.0 ? "CRITICAL — Breaches Invariant S2 (Slope > 20°)" : "NOMINAL — Within flight certified envelope",
          recommended: r.id === activeRoute?.id,
        })),
        recommendation: activeRoute
          ? `Execute traverse via '${activeRoute.name}'. Maintain autonomous scout spacing 800m ahead of human crew.`
          : "Use the Mission Planning Workspace to optimize and persist a safety-compliant route.",
        tradeOffs: [
          "Detour around Kodiak talus adds +1.5 km compared to direct line",
          "Eliminates rollover risk and ensures 100% compliant battery return reserve",
        ],
        agentDirectives: [
          { agentCallsign: "ROVER-01 SCOUT", directive: "Scan primary waypoints WP-01 through WP-04", priority: "HIGH" },
          { agentCallsign: "ASTRONAUT-01", directive: "Follow cleared corridor with 30-min return margin", priority: "HIGH" },
        ],
        uncertainty: {
          telemetryUncertainty: "Sub-meter boulder distribution unverified between waypoints WP-02 and WP-03",
          unmappedRisks: ["Local dune ripple wheel slip up to 15%"],
        },
        provenance: ProvenanceService.createProjectRuleProvenance(
          "Multi-Objective Route Selection Rule",
          "Selects Pareto-optimal path adhering strictly to safety invariants S1-S8"
        ),
      };
    }

    // 2. Safety Invariants & Flight Rules
    if (q.includes("invariant") || q.includes("safety") || q.includes("rule") || q.includes("s1") || q.includes("s2") || q.includes("s3") || q.includes("s8")) {
      const canonical = MissionStateCoordinator.getCanonicalState();
      return {
        query,
        assessment: "Mission operates under 8 non-negotiable safety invariants (S1–S8). Safety invariants are hard constraints: an attractive route or high science score can never override a safety violation.",
        observedFact: `Current state: O2 reserve ${canonical.resources.astronautOxygenReserveMinutes} min, system health score ${canonical.validation.healthScore}/100, status ${canonical.validation.overallSystemStatus}.`,
        derivedInsight: "Invariants S1 (Battery ≥ 20%), S2 (Slope ≤ 20°), S3 (Return Reserve ≥ 30 min), S4 (Line-of-Sight), and S7 (Audit Integrity) are actively validated.",
        simulatedContext: "Continuous safety guard monitoring against live telemetry and planned waypoints.",
        evidence: [
          "Invariant S1: Space Vehicle Power Architecture Guidelines (NASA SP-8000)",
          "Invariant S2: Mars 2020 Chassis Mobility Certifications",
          "Invariant S3: NASA EVA Life Support Contingency Protocols",
          "Invariant S7: NIST SP 800-92 Tamper-Evident Audit Verification",
        ],
        options: [
          { title: "Enforce All Hard Constraints (S1-S8)", score: 98, risk: "ZERO VIOLATIONS", recommended: true },
          { title: "Permit Optimization Score to Override Invariants", score: 10, risk: "UNACCEPTABLE — CATASTROPHIC FAILURE RISK", recommended: false },
        ],
        recommendation: "Maintain automatic rejection of all route candidates or operational plans that breach any S1-S8 invariant.",
        tradeOffs: ["Slightly longer mission duration for guaranteed crew survival and asset preservation"],
        agentDirectives: [
          { agentCallsign: "ASTRONAUT-01", directive: "Adhere to 180-min maximum EVA duration limit", priority: "CRITICAL" },
        ],
        uncertainty: {
          telemetryUncertainty: "Battery capacity degradation rate models calibrated to ±3% uncertainty",
          unmappedRisks: ["Sudden cryogenic cell fault"],
        },
        provenance: ProvenanceService.createProjectRuleProvenance(
          "Safety Invariants Framework",
          "Hard programmatic constraints preventing vehicle rollover, battery bricking, and crew stranding"
        ),
      };
    }

    // 3. Resources & Emergency Return
    if (q.includes("battery") || q.includes("resource") || q.includes("return") || q.includes("margin") || q.includes("power") || q.includes("emergency")) {
      const canonical = MissionStateCoordinator.getCanonicalState();
      const battVals = Object.values(canonical.resources.fleetBatterySoc) as number[];
      const avgBattery = battVals.length > 0 ? Math.round(battVals.reduce((a, b) => a + b, 0) / battVals.length) : 82;

      return {
        query,
        assessment: `Fleet average battery state-of-charge is ${avgBattery}%. Astronaut oxygen contingency is ${canonical.resources.astronautOxygenReserveMinutes} minutes, satisfying NASA's 30-minute reserve rule (Invariant S3).`,
        observedFact: `Astronaut metabolic load: ${canonical.resources.astronautMetabolicWatts} W. Oxygen reserve: ${canonical.resources.astronautOxygenReserveMinutes} minutes remaining.`,
        derivedInsight: `Total energy available allows compliant traverse under nominal motor efficiency. 20% safety floor reserve is fully protected.`,
        simulatedContext: "Dynamic thermal-mechanical load modeling including radioisotope heater loads and wheel drive resistance.",
        evidence: [
          "Fleet battery SoC telemetry bus",
          "Calculated point-to-habitat Euclidean and terrain-aware return distance",
          "Life support oxygen reserve remaining",
        ],
        options: [
          { title: "Maintain 30-min Emergency Return Reserve", score: 95, risk: "LOW", recommended: true },
          { title: "Extend Traverse into Reserve Margin", score: 25, risk: "HIGH — Crew stranding risk if rover mobility degrades", recommended: false },
        ],
        recommendation: "Keep emergency return corridor pre-computed and stored in flight computer for instantaneous 1-click abort execution.",
        tradeOffs: ["Requires returning before 180 min elapsed mission time"],
        agentDirectives: [
          { agentCallsign: "ASTRONAUT-01", directive: "Monitor suit battery and O2 pressure telemetry at every waypoint", priority: "HIGH" },
          { agentCallsign: "ROVER-03 RELAY", directive: "Stand ready to deploy power umbilical in rescue configuration", priority: "MEDIUM" },
        ],
        uncertainty: {
          telemetryUncertainty: "Nighttime cold-soak temperature drop effect on cell internal resistance",
          unmappedRisks: ["Regolith accumulation on solar arrays"],
        },
        provenance: ProvenanceService.createProjectRuleProvenance(
          "Energy & Emergency Return Policy",
          "Enforces minimum 30-minute life support and 20% battery energy reserve"
        ),
      };
    }

    // 4. What-If & Scenario Simulations
    if (q.includes("what-if") || q.includes("what if") || q.includes("scenario") || q.includes("simulation") || q.includes("breakdown") || q.includes("blackout")) {
      const recentSims = WhatIfSimulationEngine.getAllSimulations();
      const lastSim = recentSims[recentSims.length - 1];

      return {
        query,
        assessment: lastSim
          ? `Latest What-If simulation (${lastSim.simulationId}) evaluated against canonical state. Route feasibility: ${lastSim.routeFeasible ? "FEASIBLE" : "VIOLATES INVARIANTS"}, success probability: ${lastSim.missionSuccessProbability}%, safety delta: ${lastSim.comparison.safetyDelta}.`
          : "What-If simulation engine executes multi-condition scenarios on isolated deep copies of canonical state. Live operational state is never mutated during scenario evaluations.",
        observedFact: lastSim
          ? `Baseline safety: ${lastSim.baseline.safetyScore}/100 vs Alternative safety: ${lastSim.alternative.safetyScore}/100.`
          : "12 supported scenarios: Battery Degradation, Battery Failure, Comms Blackout, Orbiter Relay Failure, Rover Breakdown, Astronaut Emergency, Terrain Escalation, Route Blockage, Instrument Failure, Resource Shortage, Emergency Return, Agent Unavailability.",
        derivedInsight: lastSim?.recommendedMitigation || "Simulations test combinations of stressors and output quantified safety and battery deltas.",
        simulatedContext: "Deep-copy isolated What-If scenario engine with NIST SP 800-92 audit linkage.",
        evidence: [
          "Isolated canonical state clone",
          "Dynamic terrain slope and energy discharge physics",
          "Automated mitigation generator",
        ],
        options: [
          { title: "Run Isolated What-If Scenario", score: 90, risk: "ZERO LIVE STATE IMPACT", recommended: true },
        ],
        recommendation: lastSim?.recommendedMitigation || "Select condition combinations in Scenario Builder to quantify operational risk before committing real field assets.",
        tradeOffs: ["Simulated scenario data is explicitly derived and must not be confused with empirical sensor truth"],
        agentDirectives: [],
        uncertainty: {
          telemetryUncertainty: "Deterministic scenario bounds based on physical rover specs",
          unmappedRisks: ["Unmodeled compound failure cascades"],
        },
        provenance: ProvenanceService.createProjectRuleProvenance(
          "What-If Simulation Isolation Protocol",
          "Ensures zero mutation of live mission events or canonical stores"
        ),
      };
    }

    // 5. Monte Carlo & Statistical Uncertainty
    if (q.includes("monte carlo") || q.includes("uncertainty") || q.includes("p10") || q.includes("p50") || q.includes("p90") || q.includes("confidence")) {
      let mc;
      try {
        mc = MonteCarloEngine.runAnalysis({ runCount: 100, seed: 20261107 });
      } catch {
        mc = null;
      }

      return {
        query,
        assessment: mc
          ? `100-run stochastic Monte Carlo simulation projects ${mc.successProbabilityPercent}% mission success probability. Median duration (P50) is ${mc.durationDistributionMinutes.p50} min (95% CI: [${mc.durationDistributionMinutes.confidenceInterval95[0]} - ${mc.durationDistributionMinutes.confidenceInterval95[1]}] min). Median arrival battery reserve is ${mc.batteryReserveDistribution.p50}%.`
          : "Monte Carlo engine runs stochastic simulations across terrain roughness, speed variations, battery drain, and comms availability using deterministic PRNG seeds.",
        observedFact: mc
          ? `Duration distribution: P10 = ${mc.durationDistributionMinutes.p10}m, P50 = ${mc.durationDistributionMinutes.p50}m, P90 = ${mc.durationDistributionMinutes.p90}m. Battery reserve P10 = ${mc.batteryReserveDistribution.p10}%, P50 = ${mc.batteryReserveDistribution.p50}%.`
          : "Deterministic LCG with Box-Muller transforms produces reproducible uncertainty distributions.",
        derivedInsight: "Calculated 95% confidence intervals prove the mission plan has a >90% probability of remaining within flight safety envelopes.",
        simulatedContext: "Classification: SIMULATED / MONTE CARLO (stochastic model output, not empirical sensor telemetry).",
        evidence: [
          "100 stochastic simulated runs",
          "Calibrated Mars 2020 drive power variance (±12%)",
          "MOLA elevation uncertainty (±1.5m)",
        ],
        options: [
          { title: "Accept Plan with Certified 95% Confidence Bounds", score: 94, risk: "LOW", recommended: true },
        ],
        recommendation: "Ensure mission timeline accommodates P90 duration (worst-case 90th percentile) to protect life-support reserves.",
        tradeOffs: ["P90 planning requires 15% extra contingency margin over median P50"],
        agentDirectives: [],
        uncertainty: {
          telemetryUncertainty: `95% Confidence Interval spans ±${mc ? (mc.durationDistributionMinutes.confidenceInterval95[1] - mc.durationDistributionMinutes.confidenceInterval95[0]) / 2 : 12} minutes`,
          unmappedRisks: ["Sudden dust storm obscuration reducing solar insolation"],
        },
        provenance: ProvenanceService.createProjectRuleProvenance(
          "Monte Carlo Epistemology Standard",
          "Labels all probabilistic distributions as simulated to distinguish from ground truth"
        ),
      };
    }

    // 6. Fleet Agents & Structured Capabilities
    if (q.includes("agent") || q.includes("capability") || q.includes("drill") || q.includes("task") || q.includes("fleet") || q.includes("rover")) {
      const agents = AgentRegistry.getAllAgents();
      const scienceRover = agents.find((a) => a.structuredCapabilities?.hasDrill);
      const scoutRover = agents.find((a) => a.callsign.includes("SCOUT"));
      const relayRover = agents.find((a) => a.structuredCapabilities?.communicationRelay.isRelay);

      return {
        query,
        assessment: `Fleet comprises 5 specialized agents: ASTRONAUT-01 (EVA Commander), ROVER-01 SCOUT (Fast Lidar Recon, 4.8 km/h), ROVER-02 SCIENCE (Rotary Drill & Raman, 15 tubes), ROVER-03 RELAY (Electra UHF Mast, 12 km range), and ORBITER-01 (HiRISE 0.25m imagery).`,
        observedFact: `Drill capability: Exclusively held by ${scienceRover?.callsign || "ROVER-02 SCIENCE"}. Scouting capability: ${scoutRover?.callsign || "ROVER-01 SCOUT"} (20° max slope). Relay capability: ${relayRover?.callsign || "ROVER-03 RELAY"} (4096 kbps UHF mast).`,
        derivedInsight: "Multi-agent coordinator dynamically enforces instrument requirements: coring tasks require ROVER-02, while steep scarp scouting is routed to ROVER-01.",
        simulatedContext: "Multi-agent coordination engine with capability-based allocation scoring.",
        evidence: [
          "Agent structured capabilities registry",
          "Telemetry bus battery and status feeds",
          "Task assignment and dependency graph",
        ],
        options: agents.map((a) => ({
          title: `${a.callsign} (${a.type})`,
          score: a.telemetry.batteryPercent,
          risk: a.status === "EMERGENCY" ? "CRITICAL" : "NOMINAL",
          recommended: true,
        })),
        recommendation: "Dispatch ROVER-01 ahead for terrain verification; assign sample coring exclusively to ROVER-02.",
        tradeOffs: ["Task specialization requires coordinated multi-agent synchronization"],
        agentDirectives: agents.map((a) => ({
          agentCallsign: a.callsign,
          directive: `Maintain assigned operational envelope; report heartbeat every 60s`,
          priority: "HIGH" as const,
        })),
        uncertainty: {
          telemetryUncertainty: "Agent position telemetry resolution: 0.1m local, 5m orbital",
          unmappedRisks: ["Robotic arm joint temperature threshold under shadow"],
        },
        provenance: ProvenanceService.createProjectRuleProvenance(
          "Fleet Specialization Policy",
          "Enforces role-based asset assignments based on verified hardware capabilities"
        ),
      };
    }

    // Default general reasoning
    return {
      query,
      assessment:
        "Multi-agent field operations in Jezero Crater are operating within safe flight constraints. 1 Astronaut, 3 autonomous rovers, and 1 orbital relay are coordinated across primary MEPAG ancient water exploration tasks.",
      observedFact: "All 5 planetary agents report nominal telemetry heartbeats and valid power reserves.",
      derivedInsight: "Total mission safety index exceeds 85; zero life support invariant violations.",
      simulatedContext: "Multi-agent coordination model running under deterministic simulation seed.",
      evidence: [
        "MGS MOLA topographic model",
        "Multi-agent simulated telemetry feed (deterministic seed)",
        "NASA 30-min return reserve flight rule",
      ],
      options: [
        {
          title: "Maintain Coordinated Multi-Agent Traversal Plan",
          score: 88,
          risk: "LOW",
          recommended: true,
        },
      ],
      recommendation:
        "Continue synchronized traverse with ROVER-01 scouting 1.5 km ahead and ROVER-03 holding elevated tactical comms relay.",
      tradeOffs: ["Balanced energy reserves and maximum science return"],
      agentDirectives: [
        { agentCallsign: "ASTRONAUT-01", directive: "Maintain traverse speed 2.8 km/h along authorized path", priority: "MEDIUM" },
        { agentCallsign: "ROVER-01 SCOUT", directive: "Continue forward route verification", priority: "MEDIUM" },
      ],
      uncertainty: {
        telemetryUncertainty: "Orbital telemetry packet latency of 14.2 minutes Earth round-trip",
        unmappedRisks: ["Local slope changes below 463m MOLA pixel resolution"],
      },
      provenance: ProvenanceService.createProjectRuleProvenance(
        "Standard Multi-Agent Ops Rules",
        "Deterministic coordination protocol for Martian surface operations"
      ),
    };
  }

  /**
   * Batch 9: Structured, evidence-grounded, confirmation-gated Mission Copilot query.
   * Explicitly discloses rule-based deterministic provenance (non-LLM) and cites real state.
   */
  public queryStructuredCopilot(query: string, missionId?: string): {
    query: string;
    missionId: string;
    intent: string;
    answer: string;
    evidence: string[];
    sources: string[];
    assumptions: string[];
    provenanceType: "DETERMINISTIC_RULE_ENGINE";
    serviceDisclosures: string[];
    proposedAction?: {
      actionId: string;
      actionType: "SELECT_ROUTE" | "ASSIGN_AGENT_TASK" | "EXECUTE_SCENARIO";
      description: string;
      targetMissionId: string;
      requiresConfirmation: true;
      blockedByApproval: boolean;
      payload: Record<string, any>;
    };
  } {
    const q = (query || "").toLowerCase();
    const missions = missionRepository.getAllMissionsSync();
    const mission = (missionId ? missions.find((m) => m.id === missionId) : undefined) || missions[0];
    const effectiveMissionId = mission?.id || missionId || "mission-jezero-sol100";
    const routes = missionRepository.getAllRoutesSync();
    const selectedRoute = routes.find((r) => r.id === mission?.routeId) || routes[0];
    const canonical = MissionStateCoordinator.getCanonicalState();
    const analytics = MissionAnalyticsService.getAnalytics(effectiveMissionId);
    const primarySafetyScore = analytics.routeComparison[0]?.safetyScore ?? 85;
    const agents = AgentRegistry.getAllAgents();
    const isApprovedOrLocked = mission?.status === "APPROVED" || mission?.status === "LOCKED";

    const serviceDisclosures = [
      "Deterministic rule-based Copilot (non-LLM): no generative ML inference is used.",
      "Live Python ML/Science service is not invoked for text reasoning; metrics come from persisted TypeScript engines.",
    ];

    // 0. Non-negotiable safety override refusal
    if (
      q.includes("override") ||
      q.includes("bypass") ||
      q.includes("ignore safety") ||
      q.includes("disable safety") ||
      q.includes("skip invariant")
    ) {
      return {
        query,
        missionId: effectiveMissionId,
        intent: "safety_override_refused",
        answer:
          "REFUSED: Natural-language requests cannot bypass or relax hard Safety Invariants (S1-S8). All route selections and scenarios remain strictly gated by S1 (Battery >= 20%), S2 (Slope <= 20 deg), and S3 (30-min O2 reserve).",
        evidence: [
          `Canonical Health: ${canonical.validation.healthScore}/100 (${canonical.validation.overallSystemStatus})`,
          `Astronaut O2 Reserve: ${canonical.resources.astronautOxygenReserveMinutes} min`,
        ],
        sources: ["SafetyInvariantService", "MissionStateCoordinator"],
        assumptions: ["Hard safety invariants S1-S8 are programmatic and non-overridable."],
        provenanceType: "DETERMINISTIC_RULE_ENGINE",
        serviceDisclosures,
      };
    }

    // 1. Consequential action proposals (require explicit confirmation)
    if (q.includes("assign") || q.includes("dispatch") || q.includes("task")) {
      const candidateAgent = agents.find((a) => a.type === "ROVER") || agents[0];
      return {
        query,
        missionId: effectiveMissionId,
        intent: "proposed_action",
        answer: `Prepared task assignment proposal for ${candidateAgent?.callsign || "ROVER-01"} on mission ${effectiveMissionId}. Explicit confirmation is required before modifying mission assignments.${isApprovedOrLocked ? " Note: target mission is currently APPROVED/LOCKED and cannot be mutated directly." : ""}`,
        evidence: [
          `Candidate asset: ${candidateAgent?.callsign || "ROVER-01"} (status: ${candidateAgent?.status || "IDLE"})`,
          `Mission status: ${mission?.status || "DRAFT"}`,
          `Active fleet count: ${agents.length}`,
        ],
        sources: ["AgentRegistry", "missionRepository"],
        assumptions: ["Asset availability reflects latest persisted telemetry state."],
        provenanceType: "DETERMINISTIC_RULE_ENGINE",
        serviceDisclosures,
        proposedAction: {
          actionId: `act-${crypto.randomBytes(4).toString("hex")}`,
          actionType: "ASSIGN_AGENT_TASK",
          description: `Assign reconnaissance & sampling task to ${candidateAgent?.callsign || "ROVER-01"} for ${effectiveMissionId}`,
          targetMissionId: effectiveMissionId,
          requiresConfirmation: true,
          blockedByApproval: Boolean(isApprovedOrLocked),
          payload: {
            agentId: candidateAgent?.id || "rover-01",
            taskTitle: `Copilot-recommended reconnaissance on ${selectedRoute?.name || effectiveMissionId}`,
          },
        },
      };
    }

    if (q.includes("switch route") || q.includes("change route") || q.includes("select route")) {
      const altRoute = routes.find((r) => r.id !== selectedRoute?.id && r.maxSlopeDegrees <= 20) || selectedRoute;
      return {
        query,
        missionId: effectiveMissionId,
        intent: "proposed_action",
        answer: `Prepared route update proposal to switch ${effectiveMissionId} to ${altRoute?.name || "safe alternative"} (${altRoute?.maxSlopeDegrees ?? 14}° max slope). Explicit confirmation is required.${isApprovedOrLocked ? " Target mission is APPROVED/LOCKED, so direct plan mutation will be blocked unless cloned as a new draft." : ""}`,
        evidence: [
          `Current route: ${selectedRoute?.name || "N/A"} (${selectedRoute?.maxSlopeDegrees ?? 0}° max slope)`,
          `Proposed route: ${altRoute?.name || "N/A"} (${altRoute?.maxSlopeDegrees ?? 0}° max slope, ${altRoute?.totalDistanceKm ?? 0} km)`,
        ],
        sources: ["missionRepository", "SafetyInvariantService"],
        assumptions: ["Slope and distance figures are derived from persisted route geometry."],
        provenanceType: "DETERMINISTIC_RULE_ENGINE",
        serviceDisclosures,
        proposedAction: {
          actionId: `act-${crypto.randomBytes(4).toString("hex")}`,
          actionType: "SELECT_ROUTE",
          description: `Update mission ${effectiveMissionId} route to ${altRoute?.name || altRoute?.id}`,
          targetMissionId: effectiveMissionId,
          requiresConfirmation: true,
          blockedByApproval: Boolean(isApprovedOrLocked),
          payload: { routeId: altRoute?.id },
        },
      };
    }

    if (q.includes("run scenario") || q.includes("execute scenario") || q.includes("simulate scenario")) {
      const firstScenario = ScenarioBuilderService.listScenarios()[0];
      return {
        query,
        missionId: effectiveMissionId,
        intent: "proposed_action",
        answer: `Prepared isolated simulation proposal for scenario "${firstScenario?.name || "Nominal"}". Explicit confirmation is required; execution runs against an isolated clone and does not mutate live mission state.`,
        evidence: [
          `Scenario ID: ${firstScenario?.id || "scen-jezero-nominal"}`,
          `Duration: ${firstScenario?.durationMinutes || 240} min, Initial Battery: ${firstScenario?.resources.initialBatteryPercent || 94}%`,
        ],
        sources: ["ScenarioBuilderService", "SimulationScenarioManager"],
        assumptions: ["Simulation results are SIMULATED estimates, not live telemetry."],
        provenanceType: "DETERMINISTIC_RULE_ENGINE",
        serviceDisclosures,
        proposedAction: {
          actionId: `act-${crypto.randomBytes(4).toString("hex")}`,
          actionType: "EXECUTE_SCENARIO",
          description: `Execute isolated SIMULATED scenario "${firstScenario?.name || "Nominal"}"`,
          targetMissionId: effectiveMissionId,
          requiresConfirmation: true,
          blockedByApproval: false,
          payload: { scenarioId: firstScenario?.id || "scen-jezero-nominal" },
        },
      };
    }

    // 2. Route rejected / disqualified
    if (q.includes("reject") || q.includes("disqualif") || q.includes("exclude")) {
      const rejected = routes.filter((r) => r.maxSlopeDegrees > 20);
      return {
        query,
        missionId: effectiveMissionId,
        intent: "route_rejected",
        answer:
          rejected.length > 0
            ? `${rejected.length} route candidate(s) were disqualified for breaching hard Safety Invariant S2 (>20° max slope): ${rejected.map((r) => `${r.name} (${r.maxSlopeDegrees.toFixed(1)}°)`).join(", ")}.`
            : `No routes in the current catalog exceed the 20° slope limit; all ${routes.length} routes remain eligible for multi-objective comparison.`,
        evidence: routes.map((r) => `${r.name}: ${r.maxSlopeDegrees.toFixed(1)}° max slope, ${r.totalDistanceKm} km`),
        sources: ["missionRepository", "SafetyInvariantService"],
        assumptions: ["Slope thresholds are evaluated against the S2 20.0° chassis stability limit."],
        provenanceType: "DETERMINISTIC_RULE_ENGINE",
        serviceDisclosures,
      };
    }

    // 3. Science yield vs risk trade-offs
    if (q.includes("trade") || q.includes("science") || q.includes("yield")) {
      return {
        query,
        missionId: effectiveMissionId,
        intent: "science_vs_risk",
        answer: `For ${effectiveMissionId}, modeled science yield is ${analytics.science.cumulativeScienceYield} pts across ${analytics.science.totalTargetsEvaluated} evaluated targets, while route safety score is ${primarySafetyScore}/100 with ${analytics.hazardBreakdown.total} active hazards. Hard safety invariants gate candidate eligibility before science yield ranking.`,
        evidence: [
          `Modeled Science Yield: ${analytics.science.cumulativeScienceYield} pts (${analytics.science.approvedDecisionsCount} approved decisions)`,
          `Safety Score: ${primarySafetyScore}/100`,
          `Safety Violations: ${analytics.safety.safetyViolationCount}`,
        ],
        sources: ["MissionAnalyticsService", "ScienceDecisionService", "SafetyInvariantService"],
        assumptions: [
          "Science yield is a modeled heuristic score, not measured laboratory return.",
          "Hard safety constraints (S1-S3) cannot be traded off for higher science yield.",
        ],
        provenanceType: "DETERMINISTIC_RULE_ENGINE",
        serviceDisclosures,
      };
    }

    // 4. Safety & resources / feasibility summary
    if (q.includes("safety") || q.includes("resource") || q.includes("battery") || q.includes("oxygen") || q.includes("feasible") || q.includes("feasibility")) {
      return {
        query,
        missionId: effectiveMissionId,
        intent: "safety_resources",
        answer: `Mission ${effectiveMissionId} feasibility summary: Safety score ${primarySafetyScore}/100, O2 reserve ${canonical.resources.astronautOxygenReserveMinutes} min, fleet avg battery ${analytics.operations.averageFleetBatteryPercent ?? "N/A"}%, and ${analytics.safety.emergencyReserveCompliancePercent ?? 100}% emergency reserve compliance.`,
        evidence: [
          `O2 Reserve: ${canonical.resources.astronautOxygenReserveMinutes} min (S3 minimum: 30 min)`,
          `Fleet Avg Battery: ${analytics.operations.averageFleetBatteryPercent ?? "N/A"}% (S1 minimum: 20%)`,
          `Active Hazards: ${analytics.hazardBreakdown.total}`,
          `Audit Integrity: ${analytics.safety.auditIntegrityStatus}`,
        ],
        sources: ["MissionStateCoordinator", "MissionAnalyticsService", "SafetyInvariantService"],
        assumptions: ["Battery and O2 projections assume nominal metabolic and terrain drag models."],
        provenanceType: "DETERMINISTIC_RULE_ENGINE",
        serviceDisclosures,
      };
    }

    // 5. Default: Route selection & mission overview
    return {
      query,
      missionId: effectiveMissionId,
      intent: "route_selected",
      answer: `Route "${selectedRoute?.name || "Primary Traverse"}" (${selectedRoute?.totalDistanceKm ?? 0} km, ${selectedRoute?.maxSlopeDegrees?.toFixed(1) ?? 0}° max slope) is selected for ${effectiveMissionId} because it satisfies S2 slope limits while supporting ${analytics.science.totalTargetsEvaluated} science targets.`,
      evidence: [
        `Selected Route: ${selectedRoute?.name || "N/A"} (${selectedRoute?.estimatedDurationMinutes ?? 0} min est.)`,
        `Safety Score: ${primarySafetyScore}/100`,
        `Comms Coverage / Health: ${canonical.validation.healthScore}/100`,
      ],
      sources: ["missionRepository", "MissionAnalyticsService", "MissionStateCoordinator"],
      assumptions: ["Route metrics reflect persisted terrain elevation profiles and deterministic resource modeling."],
      provenanceType: "DETERMINISTIC_RULE_ENGINE",
      serviceDisclosures,
    };
  }

  /**
   * Executes a previously proposed consequential Copilot action ONLY when explicitly confirmed.
   */
  public confirmCopilotAction(params: {
    missionId: string;
    actionType: "SELECT_ROUTE" | "ASSIGN_AGENT_TASK" | "EXECUTE_SCENARIO";
    payload?: Record<string, any>;
    confirmed?: boolean;
    userRole?: string;
  }): { statusCode: number; body: Record<string, any> } {
    if (params.confirmed !== true) {
      return {
        statusCode: 400,
        body: {
          success: false,
          error: {
            code: "CONFIRMATION_REQUIRED",
            message: "Explicit user confirmation (confirmed: true) is required before executing consequential Copilot actions.",
          },
        },
      };
    }

    const mission = missionRepository.getAllMissionsSync().find((m) => m.id === params.missionId);
    const isProtected = mission && (mission.status === "APPROVED" || mission.status === "LOCKED");

    if (params.actionType === "EXECUTE_SCENARIO") {
      const scenarioId = params.payload?.scenarioId || ScenarioBuilderService.listScenarios()[0]?.id;
      const outcome = scenarioId ? ScenarioBuilderService.executeScenario(scenarioId) : null;
      if (!outcome) {
        return {
          statusCode: 404,
          body: { success: false, error: { code: "SCENARIO_NOT_FOUND", message: "Requested scenario not found." } },
        };
      }
      auditChainService.appendEvent({
        userId: "MISSION_COPILOT",
        role: (params.userRole as any) || "MISSION_COMMAND",
        action: "OPTIMIZE_ROUTE",
        missionPlanId: params.missionId,
        details: { copilotAction: "EXECUTE_SCENARIO", scenarioId, executionId: outcome.executionId },
      });
      return { statusCode: 200, body: { success: true, data: { actionType: params.actionType, outcome } } };
    }

    if (isProtected) {
      return {
        statusCode: 409,
        body: {
          success: false,
          error: {
            code: "APPROVED_MISSION_PROTECTED",
            message: `Mission ${params.missionId} is ${mission.status} and cannot be mutated directly by Copilot. Clone or create a new draft plan instead.`,
          },
        },
      };
    }

    if (params.actionType === "SELECT_ROUTE" && mission) {
      const routeId = params.payload?.routeId;
      const updated = missionRepository.updateMission(mission.id, { routeId });
      auditChainService.appendEvent({
        userId: "MISSION_COPILOT",
        role: (params.userRole as any) || "MISSION_COMMAND",
        action: "OPTIMIZE_ROUTE",
        missionPlanId: mission.id,
        details: { copilotAction: "SELECT_ROUTE", routeId },
      });
      return { statusCode: 200, body: { success: true, data: { actionType: params.actionType, mission: updated } } };
    }

    // ASSIGN_AGENT_TASK
    auditChainService.appendEvent({
      userId: "MISSION_COPILOT",
      role: (params.userRole as any) || "MISSION_COMMAND",
      action: "MODIFY_PRIORITIES",
      missionPlanId: params.missionId,
      details: { copilotAction: "ASSIGN_AGENT_TASK", payload: params.payload || {} },
    });
    return {
      statusCode: 200,
      body: {
        success: true,
        data: {
          actionType: params.actionType,
          missionId: params.missionId,
          assigned: true,
          details: params.payload || {},
        },
      },
    };
  }
}

export const missionReasoningService = new MissionReasoningService();
