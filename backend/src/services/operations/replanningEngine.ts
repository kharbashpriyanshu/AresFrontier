import { MarsCoordinate, RouteCandidate } from "../../types/index.js";
import { routeOptimizationEngine } from "../intelligence/routeOptimizationEngine.js";
import { auditChainService } from "../security/auditChainService.js";
import { AgentStateStore } from "../agents/agentStateStore.js";
import { AgentRegistry } from "../agents/agentRegistry.js";

export interface ReplanTrigger {
  triggerType:
    | "HAZARD_DETECTED"
    | "BATTERY_LOW"
    | "COMMS_LOST"
    | "SCIENCE_PRIORITY_CHANGED"
    | "ROUTE_BLOCKED"
    | "EMERGENCY";
  initiatorAgentId: string;
  initiatorCallsign: string;
  hazardId?: string;
  hazardDescription?: string;
  detectedCoordinate?: MarsCoordinate;
  reason: string;
}

export interface ReplanProposal {
  replanId: string;
  timestamp: string;
  trigger: ReplanTrigger;
  status: "PROPOSED" | "APPROVED" | "REJECTED";
  currentRouteId: string;
  proposedRouteId: string;
  candidateAlternatives: RouteCandidate[];
  comparison: {
    distanceDiffKm: number;
    durationDiffMin: number;
    safetyScoreDiff: number;
    scienceScoreDiff: number;
    riskAdjustedDiff: number;
    safetyRationale: string;
    scienceTradeoff: string;
  };
  humanApprovalRequired: boolean;
  approvedBy?: string;
  auditBlockHash?: string;
}

export class ReplanningEngine {
  private static activeProposals: Map<string, ReplanProposal> = new Map();

  /**
   * Evaluates a replanning trigger and synthesizes alternative routes and trade-offs.
   */
  public static async triggerReplan(trigger: ReplanTrigger): Promise<ReplanProposal> {
    const replanId = `replan-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const startCoord = trigger.detectedCoordinate || { latitude: 18.4485, longitude: 77.432 };
    const destCoord = { latitude: 18.455, longitude: 77.41 }; // Jezero Delta target

    // Generate fresh candidate routes avoiding the detected obstruction
    const candidates = await routeOptimizationEngine.generateCandidates({
      startCoordinate: startCoord,
      destinationCoordinate: destCoord,
      maxDurationMinutes: 240,
      objectiveId: "ANCIENT_WATER_ACTIVITY",
      returnRequired: true,
    });

    const recommended = candidates.find((c: RouteCandidate) => c.profileType === "safest") || candidates[0];
    const previous = candidates.find((c: RouteCandidate) => c.profileType === "shortest") || candidates[1];

    const distanceDiff = Number((recommended.distanceKm - previous.distanceKm).toFixed(2));
    const durationDiff = recommended.estimatedDurationMin - previous.estimatedDurationMin;
    const safetyDiff = recommended.safetyScore - previous.safetyScore;
    const scienceDiff = recommended.scienceScore - previous.scienceScore;
    const riskDiff = (recommended.riskAdjustedScore ?? 80) - (previous.riskAdjustedScore ?? 65);

    const proposal: ReplanProposal = {
      replanId,
      timestamp: new Date().toISOString(),
      trigger,
      status: "PROPOSED",
      currentRouteId: previous.id,
      proposedRouteId: recommended.id,
      candidateAlternatives: candidates,
      comparison: {
        distanceDiffKm: distanceDiff,
        durationDiffMin: durationDiff,
        safetyScoreDiff: safetyDiff,
        scienceScoreDiff: scienceDiff,
        riskAdjustedDiff: riskDiff,
        safetyRationale: `Rerouting eliminates high-gradient slope hazard. Safety index improved by +${safetyDiff} points.`,
        scienceTradeoff: `Preserves primary ancient water sedimentary objective with an additional +${Math.max(0, durationDiff)} minutes traverse margin.`,
      },
      humanApprovalRequired: true,
    };

    this.activeProposals.set(replanId, proposal);

    // Record replanning proposal in the audit chain
    const auditBlock = auditChainService.appendEvent({
      userId: trigger.initiatorCallsign,
      role: "ANALYST",
      action: "OPTIMIZE_ROUTE",
      missionPlanId: "MARSWALK-001",
      planVersion: 1,
      details: {
        replanId,
        triggerType: trigger.triggerType,
        reason: trigger.reason,
        proposedRoute: recommended.name,
      },
    });
    proposal.auditBlockHash = auditBlock.integrityHash;

    AgentStateStore.recordEvent({
      agentId: trigger.initiatorAgentId,
      eventType: "REPLAN_PROPOSED",
      severity: "WARNING",
      message: `Replanning proposed by ${trigger.initiatorCallsign}: ${trigger.reason}`,
      details: { replanId, recommendedRoute: recommended.name },
    });

    return proposal;
  }

  /**
   * Approves a proposed replan, updating agent waypoints and locking authorization.
   */
  public static approveReplan(
    replanId: string,
    approvedBy: string = "MISSION_COMMANDER"
  ): ReplanProposal {
    const proposal = this.activeProposals.get(replanId);
    if (!proposal) {
      throw new Error(`Replan proposal ${replanId} not found`);
    }

    proposal.status = "APPROVED";
    proposal.approvedBy = approvedBy;

    // Resume agents that were paused by this replan
    const scout = AgentRegistry.getAgentById("agent-rover-01");
    if (scout && scout.status === "PAUSED") {
      scout.status = "EXECUTING";
      AgentRegistry.updateAgent(scout);
    }

    // Append to audit chain
    const auditBlock = auditChainService.appendEvent({
      userId: approvedBy,
      role: "MISSION_COMMAND",
      action: "APPROVE_PLAN",
      missionPlanId: "MARSWALK-001",
      planVersion: 2,
      details: {
        replanId,
        approvedRouteId: proposal.proposedRouteId,
        approvedBy,
      },
    });
    proposal.auditBlockHash = auditBlock.integrityHash;

    AgentStateStore.recordEvent({
      agentId: "agent-rover-01",
      eventType: "REPLAN_APPROVED",
      severity: "INFO",
      message: `Replan ${replanId} formally approved by ${approvedBy}. Rover resuming along safest detour corridor.`,
      details: { replanId, approvedBy },
    });

    return proposal;
  }

  public static getProposal(id: string): ReplanProposal | undefined {
    return this.activeProposals.get(id);
  }

  public static getActiveProposals(): ReplanProposal[] {
    return Array.from(this.activeProposals.values());
  }
}
