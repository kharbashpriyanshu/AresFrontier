import { PlanetaryAgent } from "../agents/agentTypes.js";
import { auditChainService } from "../security/auditChainService.js";

export type ResourceType =
  | "SCIENCE_TARGET"
  | "COMMUNICATION_RELAY"
  | "SAFE_ROUTE_CORRIDOR"
  | "BASE_AIRLOCK_CORRIDOR"
  | "BATTERY_CHARGER";

export interface ResourceAllocation {
  resourceId: string;
  resourceType: ResourceType;
  resourceName: string;
  assignedAgentId: string;
  assignedCallsign: string;
  priority: number; // 1-100 (higher wins)
  allocatedAt: string;
  expiresAt: string;
}

export interface ConflictResolutionResult {
  conflictDetected: boolean;
  resourceId: string;
  winnerAgentId: string;
  winnerCallsign: string;
  loserAgentId?: string;
  resolutionReason: string;
  auditHash?: string;
}

export class ResourceAllocator {
  private static allocations: Map<string, ResourceAllocation> = new Map();

  /**
   * Requests allocation of a shared mission resource, resolving conflicts deterministically.
   */
  public static requestResource(
    resourceId: string,
    resourceType: ResourceType,
    resourceName: string,
    requestingAgent: PlanetaryAgent,
    agentPriority: number = 50,
    durationMinutes: number = 60
  ): ConflictResolutionResult {
    const existing = this.allocations.get(resourceId);
    const now = new Date();

    // No conflict if free or expired
    if (!existing || new Date(existing.expiresAt) <= now) {
      const newAllocation: ResourceAllocation = {
        resourceId,
        resourceType,
        resourceName,
        assignedAgentId: requestingAgent.id,
        assignedCallsign: requestingAgent.callsign,
        priority: agentPriority,
        allocatedAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + durationMinutes * 60000).toISOString(),
      };
      this.allocations.set(resourceId, newAllocation);

      return {
        conflictDetected: false,
        resourceId,
        winnerAgentId: requestingAgent.id,
        winnerCallsign: requestingAgent.callsign,
        resolutionReason: `Resource '${resourceName}' was unallocated. Ownership granted to ${requestingAgent.callsign}.`,
      };
    }

    // If requested by the current holder, renew
    if (existing.assignedAgentId === requestingAgent.id) {
      existing.expiresAt = new Date(now.getTime() + durationMinutes * 60000).toISOString();
      return {
        conflictDetected: false,
        resourceId,
        winnerAgentId: requestingAgent.id,
        winnerCallsign: requestingAgent.callsign,
        resolutionReason: `Allocation renewed for current owner ${requestingAgent.callsign}.`,
      };
    }

    // CONFLICT: Evaluate priorities
    // Astronauts always have highest operational priority over autonomous rovers
    const requesterIsAstronaut = requestingAgent.type === "ASTRONAUT";
    const existingIsAstronaut = existing.assignedCallsign.includes("ASTRONAUT");

    let winnerId: string;
    let winnerCallsign: string;
    let loserId: string;
    let resolutionReason: string;

    if (requesterIsAstronaut && !existingIsAstronaut) {
      winnerId = requestingAgent.id;
      winnerCallsign = requestingAgent.callsign;
      loserId = existing.assignedAgentId;
      resolutionReason = `Crew safety priority: Astronaut ${requestingAgent.callsign} preempted autonomous ${existing.assignedCallsign}.`;
    } else if (existingIsAstronaut && !requesterIsAstronaut) {
      winnerId = existing.assignedAgentId;
      winnerCallsign = existing.assignedCallsign;
      loserId = requestingAgent.id;
      resolutionReason = `Human life support priority: Astronaut ${existing.assignedCallsign} retains corridor ownership.`;
    } else if (agentPriority > existing.priority) {
      winnerId = requestingAgent.id;
      winnerCallsign = requestingAgent.callsign;
      loserId = existing.assignedAgentId;
      resolutionReason = `Higher task priority (${agentPriority} > ${existing.priority}) won resource allocation.`;
    } else {
      winnerId = existing.assignedAgentId;
      winnerCallsign = existing.assignedCallsign;
      loserId = requestingAgent.id;
      resolutionReason = `Incumbent agent ${existing.assignedCallsign} retained allocation (equal or higher priority).`;
    }

    // If requester won, overwrite allocation
    if (winnerId === requestingAgent.id) {
      this.allocations.set(resourceId, {
        resourceId,
        resourceType,
        resourceName,
        assignedAgentId: winnerId,
        assignedCallsign: winnerCallsign,
        priority: agentPriority,
        allocatedAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + durationMinutes * 60000).toISOString(),
      });
    }

    // Record conflict resolution in the persistent audit chain
    const auditBlock = auditChainService.appendEvent({
      userId: "MISSION_OPERATIONS_ALLOCATOR",
      role: "MISSION_COMMAND",
      action: "MODIFY_PRIORITIES",
      missionPlanId: "MARSWALK-001",
      planVersion: 1,
      details: {
        conflictType: "RESOURCE_CONTENTION",
        resourceId,
        resourceName,
        winnerCallsign,
        loserId,
        resolutionReason,
      },
    });

    return {
      conflictDetected: true,
      resourceId,
      winnerAgentId: winnerId,
      winnerCallsign,
      loserAgentId: loserId,
      resolutionReason,
      auditHash: auditBlock.integrityHash,
    };
  }

  public static getAllocations(): ResourceAllocation[] {
    return Array.from(this.allocations.values());
  }

  public static clear(): void {
    this.allocations.clear();
  }
}
