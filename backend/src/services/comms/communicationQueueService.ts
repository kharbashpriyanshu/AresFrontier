import { CommunicationPacket } from "../../types/index.js";
import { auditChainService } from "../security/auditChainService.js";
import { AgentStateStore } from "../agents/agentStateStore.js";

export class CommunicationQueueService {
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
    },
  ];

  public static getQueue(): CommunicationPacket[] {
    return this.packetQueue;
  }

  public static setQueue(queue: CommunicationPacket[]): void {
    this.packetQueue = [...queue];
  }

  public static enqueuePacket(packet: Omit<CommunicationPacket, "packetId" | "createdAt" | "status" | "attempts">): CommunicationPacket {
    const packetId = `pkt-${packet.priority.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newPacket: CommunicationPacket = {
      ...packet,
      packetId,
      createdAt: new Date().toISOString(),
      status: "BUFFERED",
      attempts: 0,
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
  } {
    const transmitted: CommunicationPacket[] = [];
    const buffered: CommunicationPacket[] = [];

    // Sort: CRITICAL first, then HIGH, MEDIUM, BULK
    const priorityWeight: Record<string, number> = {
      CRITICAL: 4,
      HIGH: 3,
      MEDIUM: 2,
      BULK: 1,
    };

    this.packetQueue.sort((a, b) => priorityWeight[b.priority] - priorityWeight[a.priority]);

    for (const packet of this.packetQueue) {
      if (packet.status === "DELIVERED") continue;

      if (!isOrbiterAvailable) {
        // Blackout: packets remain or become BUFFERED
        packet.status = "BUFFERED";
        buffered.push(packet);
      } else {
        // Contact active: transmit in priority order
        packet.status = "DELIVERED";
        packet.attempts += 1;
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
          criticalCount: transmitted.filter((p) => p.priority === "CRITICAL").length,
          bandwidthKbps,
        },
      });
    }

    return { transmitted, buffered };
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
