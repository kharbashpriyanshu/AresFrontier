import { CommunicationPacket, MarsCoordinate, MessagePriorityClass } from "../../types/index.js";
import { auditChainService } from "../security/auditChainService.js";
import { AgentStateStore } from "../agents/agentStateStore.js";
import { AgentRegistry } from "../agents/agentRegistry.js";
import { LineOfSightEngine } from "./lineOfSightEngine.js";
import { OrbitalVisibilityEngine } from "./orbitalVisibilityEngine.js";

export class CommunicationQueueService {
  private static priorityWeight: Record<MessagePriorityClass, number> = {
    EMERGENCY_SAFETY: 5,
    CRITICAL: 5,
    MISSION_CRITICAL_OPS: 4,
    HIGH: 4,
    NAVIGATION_TELEMETRY: 3,
    MEDIUM: 3,
    SCIENTIFIC_OBSERVATIONS: 2,
    BULK: 2,
    ROUTINE_STATUS: 1,
  };

  private static packetQueue: CommunicationPacket[] = [
    {
      packetId: "pkt-crit-001",
      sourceAgentId: "agent-rover-01",
      priority: "CRITICAL",
      type: "TELEMETRY",
      payloadSizeKb: 12,
      createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      status: "DELIVERED",
      attempts: 1,
      storeAndForward: true,
      ttlMinutes: 120,
    },
    {
      packetId: "pkt-sci-002",
      sourceAgentId: "agent-rover-02",
      priority: "BULK",
      type: "SCIENCE_DATA",
      payloadSizeKb: 4500,
      createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      status: "BUFFERED",
      attempts: 0,
      storeAndForward: true,
      ttlMinutes: 240,
    },
    {
      packetId: "pkt-haz-003",
      sourceAgentId: "agent-rover-01",
      priority: "CRITICAL",
      type: "HAZARD_ALERT",
      payloadSizeKb: 8,
      createdAt: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
      status: "TRANSMITTING",
      attempts: 1,
      storeAndForward: true,
      ttlMinutes: 60,
    },
  ];

  public static getQueue(): CommunicationPacket[] {
    return this.packetQueue;
  }

  public static setQueue(queue: CommunicationPacket[]): void {
    this.packetQueue = [...queue];
  }

  public static enqueuePacket(
    packet: Omit<CommunicationPacket, "packetId" | "createdAt" | "status" | "attempts">,
    initialStatus: "QUEUED" | "BUFFERED" = "BUFFERED"
  ): CommunicationPacket {
    const priority = packet.priority;
    const priWeight = this.priorityWeight[priority] || 1;
    const packetId = `pkt-${priority.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newPacket: CommunicationPacket = {
      ...packet,
      priorityClass: priWeight as 1 | 2 | 3 | 4 | 5,
      packetId,
      createdAt: new Date().toISOString(),
      status: initialStatus,
      attempts: 0,
      ttlMinutes: packet.ttlMinutes ?? (priWeight >= 4 ? 360 : 120),
      storeAndForward: packet.storeAndForward ?? true,
    };
    this.packetQueue.push(newPacket);
    return newPacket;
  }

  /**
   * Processes the packet queue according to orbiter availability and priority.
   */
  public static flushQueue(isOrbiterAvailable: boolean, bandwidthKbps: number): {
    transmitted: CommunicationPacket[];
    buffered: CommunicationPacket[];
    expired: CommunicationPacket[];
  } {
    const transmitted: CommunicationPacket[] = [];
    const buffered: CommunicationPacket[] = [];
    const expired: CommunicationPacket[] = [];

    // Sort: highest priority first, then older createdAt first (FIFO within priority)
    this.packetQueue.sort((a, b) => {
      const weightA = this.priorityWeight[a.priority] || 1;
      const weightB = this.priorityWeight[b.priority] || 1;
      if (weightB !== weightA) return weightB - weightA;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    const now = Date.now();

    for (const packet of this.packetQueue) {
      if (packet.status === "DELIVERED") continue;

      // Check TTL expiration
      const ageMinutes = (now - new Date(packet.createdAt).getTime()) / (60 * 1000);
      if (packet.ttlMinutes && ageMinutes > packet.ttlMinutes) {
        packet.status = "EXPIRED";
        expired.push(packet);
        continue;
      }

      if (!isOrbiterAvailable) {
        // Blackout: packets with storeAndForward remain BUFFERED
        if (packet.storeAndForward !== false) {
          packet.status = "BUFFERED";
          buffered.push(packet);
        } else {
          packet.status = "FAILED_BLACKOUT";
        }
      } else {
        // Contact active: transmit in priority order with transmission latency
        const latencySec = bandwidthKbps > 0
          ? Number(((packet.payloadSizeKb * 8) / bandwidthKbps + 0.3).toFixed(2))
          : 1.0;
        packet.status = "DELIVERED";
        packet.attempts += 1;
        packet.deliveredAt = new Date().toISOString();
        packet.transmissionDelaySeconds = latencySec;
        transmitted.push(packet);
      }
    }

    if (transmitted.length > 0) {
      auditChainService.appendEvent({
        userId: "COMM_SUBSYSTEM",
        role: "MISSION_COMMAND",
        action: "OPTIMIZE_ROUTE",
        missionPlanId: "ORBITAL_DOWNLINK",
        details: {
          transmittedCount: transmitted.length,
          criticalCount: transmitted.filter((p) => (this.priorityWeight[p.priority] || 1) >= 4).length,
          bandwidthKbps,
        },
      });
    }

    return { transmitted, buffered, expired };
  }

  /**
   * Evaluates physical communication links for each agent using Line-of-Sight and Orbital Visibility
   * and processes queued messages accordingly without faking delivery during real blackout windows.
   */
  public static processQueueWithPhysics(
    simulationTimeMinutes: number,
    baseCoord: MarsCoordinate = { latitude: 18.38, longitude: 77.58 }
  ): {
    transmittedCount: number;
    bufferedCount: number;
    expiredCount: number;
    activeRelayAvailable: boolean;
    agentLinkStates: Record<string, { directLOS: boolean; orbiterPass: boolean; available: boolean }>;
  } {
    const orbiterWindow = OrbitalVisibilityEngine.calculateVisibility(baseCoord, simulationTimeMinutes);
    const isOrbiterActive = orbiterWindow.state === "PASS_ACTIVE" || orbiterWindow.state === "PASS_ENDING";
    const bandwidthKbps = isOrbiterActive ? orbiterWindow.bandwidthKbps : 0;

    const agents = AgentRegistry.getAllAgents();
    const agentLinkStates: Record<string, { directLOS: boolean; orbiterPass: boolean; available: boolean }> = {};

    let anyLinkActive = isOrbiterActive;

    for (const agent of agents) {
      if (agent.type === "ORBITER") {
        agentLinkStates[agent.id] = { directLOS: true, orbiterPass: true, available: true };
        continue;
      }

      const losResult = LineOfSightEngine.calculateLineOfSight(baseCoord, agent.position, 5.0, 2.0);
      const orbForAgent = OrbitalVisibilityEngine.calculateVisibility(agent.position, simulationTimeMinutes);
      const orbActiveForAgent = orbForAgent.state === "PASS_ACTIVE" || orbForAgent.state === "PASS_ENDING";
      const isAvailable = losResult.lineOfSight || orbActiveForAgent;

      if (isAvailable) anyLinkActive = true;

      agentLinkStates[agent.id] = {
        directLOS: losResult.lineOfSight,
        orbiterPass: orbActiveForAgent,
        available: isAvailable,
      };

      // Synchronize agent telemetry lineOfSightToRelay state
      const wasCommsLost = !agent.telemetry.lineOfSightToRelay;
      agent.telemetry.lineOfSightToRelay = isAvailable;
      agent.telemetry.signalStrengthPercent = isAvailable ? (losResult.lineOfSight ? 95 : 85) : 0;

      // Telemetry synchronization after reconnection event
      if (wasCommsLost && isAvailable) {
        AgentStateStore.recordEvent({
          agentId: agent.callsign,
          eventType: "COMMUNICATION_RESTORED",
          severity: "INFO",
          message: `COMM-RECONNECT: ${agent.callsign} re-established link via ${losResult.lineOfSight ? "Direct RF LOS" : "MRO Orbital Relay"}. Telemetry backlog synchronized.`,
          details: { agentId: agent.id, simTime: simulationTimeMinutes },
        });
      }
      AgentRegistry.updateAgent(agent);
    }

    const flushResult = this.flushQueue(anyLinkActive, bandwidthKbps || (anyLinkActive ? 1024 : 0));

    return {
      transmittedCount: flushResult.transmitted.length,
      bufferedCount: flushResult.buffered.length,
      expiredCount: flushResult.expired.length,
      activeRelayAvailable: anyLinkActive,
      agentLinkStates,
    };
  }

  /**
   * Executes deterministic Scenario COMM-BLACKOUT-001.
   */
  public static executeBlackoutScenario(): {
    step1_blackoutActive: boolean;
    step2_bufferedPackets: CommunicationPacket[];
    step3_passRestored: boolean;
    step4_priorityDelivered: CommunicationPacket[];
  } {
    // 1. Orbiter expires -> blackout
    const step1 = this.flushQueue(false, 0);

    AgentStateStore.recordEvent({
      agentId: "ORBITER-01",
      eventType: "COMMUNICATION_LOST",
      severity: "WARNING",
      message: "COMM-BLACKOUT-001: MRO-Relay orbital pass ended. Telemetry queue transitioned to BUFFERED state.",
      details: { bufferedCount: step1.buffered.length },
    });

    // 2. Next orbital pass restores contact -> priority flush
    const step2 = this.flushQueue(true, 2048);

    AgentStateStore.recordEvent({
      agentId: "ORBITER-01",
      eventType: "COMMUNICATION_RESTORED",
      severity: "INFO",
      message: "COMM-BLACKOUT-001: MRO-Relay pass reacquired. Critical telemetry transmitted ahead of bulk science cubes.",
      details: { transmittedCount: step2.transmitted.length },
    });

    return {
      step1_blackoutActive: true,
      step2_bufferedPackets: step1.buffered,
      step3_passRestored: true,
      step4_priorityDelivered: step2.transmitted,
    };
  }
}
