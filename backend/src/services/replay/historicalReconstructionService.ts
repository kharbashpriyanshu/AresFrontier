import { MissionEventRecord, MarsCoordinate, FusedHazardReport } from "../../types/index.js";
import { MissionEventStore } from "../persistence/missionEventStore.js";
import { ReplayStateManager, DigitalTwinSnapshot } from "./replayStateManager.js";
import { MissionReplayEngine } from "./missionReplayEngine.js";
import { MissionStateCoordinator } from "../state/missionStateCoordinator.js";
import { MissionValidationEngine } from "../validation/missionValidationEngine.js";
import { AgentRegistry } from "../agents/agentRegistry.js";
import { TaskLifecycleService } from "../operations/taskLifecycleService.js";
import { CommunicationQueueService } from "../comms/communicationQueueService.js";
import { EvaSessionService } from "../eva/evaSessionService.js";
import { auditChainService } from "../security/auditChainService.js";

export type ReconstructionCompleteness = "COMPLETE" | "PARTIAL";

export interface ReconstructedHistoricalState {
  isHistoricalReconstruction: true;
  missionId: string;
  reconstructedAt: string;
  targetTimestamp: string;
  targetEventIndex: number;
  targetSequenceNumber: number | null;
  targetEvent: MissionEventRecord | null;
  totalEvents: number;
  completeness: ReconstructionCompleteness;
  anomalies: string[];
  snapshotUsed: { snapshotId: string; tag: string; verified: boolean } | null;
  auditIntegrity: { valid: boolean; totalEvents: number; brokenIndex?: number; reason?: string };
  missionStatus: string;
  routeId: string | null;
  agents: any[];
  tasks: Record<string, any>;
  packets: Record<string, any>;
  evaSessions: Record<string, any>;
  activeHazards: FusedHazardReport[];
  activeWaypoints: MarsCoordinate[];
  metrics: any;
  schemaValid: boolean;
}

export type ComparisonTarget =
  | { type: "LIVE" }
  | { type: "EVENT"; eventId: string }
  | { type: "SEQUENCE"; sequenceNumber: number }
  | { type: "TIMESTAMP"; timestamp: string };

export interface StateDiffItem {
  domain: "agents" | "tasks" | "routes" | "resources" | "hazards" | "communications" | "evaSessions" | "safetyInvariants";
  entityId: string;
  changeType: "CHANGED" | "ADDED" | "REMOVED" | "UNAVAILABLE";
  summary: string;
  leftValue: any;
  rightValue: any;
}

export class HistoricalReconstructionService {
  private static getMissionEvents(missionId: string): MissionEventRecord[] {
    let events = MissionEventStore.getEventsByMission(missionId);
    if (events.length === 0 && missionId === "MARSWALK-001") {
      MissionReplayEngine.loadMission(missionId);
      events = MissionEventStore.getEventsByMission(missionId);
    }
    return events;
  }

  public static reconstructAt(params: {
    missionId: string;
    eventId?: string;
    sequenceNumber?: number;
    timestamp?: string;
    snapshotId?: string;
  }): ReconstructedHistoricalState {
    const { missionId, eventId, sequenceNumber, timestamp, snapshotId } = params;
    const events = this.getMissionEvents(missionId);
    const anomalies: string[] = [];
    const auditIntegrity = MissionEventStore.verifyChain();

    if (!auditIntegrity.valid) {
      anomalies.push(auditIntegrity.reason || "Event store cryptographic chain verification failed.");
    }

    // Detect sequence gaps across mission events
    for (let i = 1; i < events.length; i++) {
      const prevSeq = events[i - 1].sequenceNumber;
      const curSeq = events[i].sequenceNumber;
      if (prevSeq !== undefined && curSeq !== undefined && curSeq <= prevSeq) {
        anomalies.push(`Non-monotonic sequence detected between ${events[i - 1].eventId} and ${events[i].eventId}.`);
      }
    }

    // Resolve target event index
    let targetIndex = events.length > 0 ? events.length - 1 : -1;
    if (eventId) {
      const idx = events.findIndex((e) => e.eventId === eventId);
      if (idx === -1) {
        anomalies.push(`Requested eventId '${eventId}' not found in persisted history for '${missionId}'.`);
      } else {
        targetIndex = idx;
      }
    } else if (sequenceNumber !== undefined) {
      const idx = events.findIndex((e, i) => (e.sequenceNumber ?? i + 1) === sequenceNumber);
      if (idx === -1) {
        // Fallback to nearest <= sequenceNumber
        let nearest = -1;
        for (let i = 0; i < events.length; i++) {
          if ((events[i].sequenceNumber ?? i + 1) <= sequenceNumber) nearest = i;
        }
        targetIndex = nearest;
        anomalies.push(`Exact sequenceNumber ${sequenceNumber} not found; reconstructed nearest prior state.`);
      } else {
        targetIndex = idx;
      }
    } else if (timestamp) {
      const targetMs = new Date(timestamp).getTime();
      if (Number.isNaN(targetMs)) {
        anomalies.push(`Invalid timestamp '${timestamp}'.`);
      } else {
        let nearest = -1;
        for (let i = 0; i < events.length; i++) {
          if (new Date(events[i].timestamp).getTime() <= targetMs) {
            nearest = i;
          }
        }
        if (nearest === -1 && events.length > 0) {
          anomalies.push(`Timestamp '${timestamp}' precedes mission start; showing initial baseline.`);
        }
        targetIndex = nearest;
      }
    }

    const manager = new ReplayStateManager();
    manager.reset();

    // Check snapshots for nearest valid snapshot <= targetTimestamp
    let snapshotUsed: { snapshotId: string; tag: string; verified: boolean } | null = null;
    let startIndex = 0;
    const targetEvent = targetIndex >= 0 && targetIndex < events.length ? events[targetIndex] : null;
    const targetTimeMs = targetEvent
      ? new Date(targetEvent.timestamp).getTime()
      : timestamp
      ? new Date(timestamp).getTime()
      : Date.now();

    const allSnaps = MissionReplayEngine.stateManager.getAllSnapshots().filter(
      (s) => !s.missionId || s.missionId === missionId
    );
    let candidateSnap: DigitalTwinSnapshot | undefined;
    if (snapshotId) {
      candidateSnap = MissionReplayEngine.stateManager.getSnapshot(snapshotId);
      if (!candidateSnap) {
        anomalies.push(`Requested snapshot '${snapshotId}' not found.`);
      }
    } else if (allSnaps.length > 0 && targetIndex >= 0) {
      const eligible = allSnaps
        .filter((s) => new Date(s.timestamp).getTime() <= targetTimeMs)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      candidateSnap = eligible[0];
    }

    if (candidateSnap) {
      const valid = manager.hydrateFromSnapshot(candidateSnap);
      snapshotUsed = { snapshotId: candidateSnap.snapshotId, tag: candidateSnap.tag, verified: valid };
      if (!valid) {
        anomalies.push(`Snapshot '${candidateSnap.snapshotId}' corrupted (SHA-256 mismatch); rebuilt from genesis.`);
        manager.reset();
      } else {
        const snapMs = new Date(candidateSnap.timestamp).getTime();
        startIndex = events.findIndex((e) => new Date(e.timestamp).getTime() > snapMs);
        if (startIndex === -1) startIndex = targetIndex + 1;
      }
    }

    for (let i = startIndex; i <= targetIndex && i < events.length; i++) {
      manager.applyEvent(events[i]);
    }

    const warnings = manager.getReconstructionWarnings();
    for (const w of warnings) {
      if (!anomalies.includes(w)) anomalies.push(w);
    }

    const agents = manager.getAgents();
    const metrics = manager.getMetrics();
    const activeWaypoints = manager.getWaypoints();
    const schemaValid =
      Array.isArray(agents) &&
      agents.length > 0 &&
      typeof metrics?.safetyScore === "number" &&
      Array.isArray(activeWaypoints);

    if (!schemaValid) {
      anomalies.push("Reconstructed state failed structural schema validation.");
    }

    const completeness: ReconstructionCompleteness =
      anomalies.length === 0 && targetIndex >= 0 ? "COMPLETE" : "PARTIAL";

    return {
      isHistoricalReconstruction: true,
      missionId,
      reconstructedAt: new Date().toISOString(),
      targetTimestamp: targetEvent?.timestamp || timestamp || new Date().toISOString(),
      targetEventIndex: targetIndex,
      targetSequenceNumber: targetEvent?.sequenceNumber ?? (targetIndex >= 0 ? targetIndex + 1 : null),
      targetEvent,
      totalEvents: events.length,
      completeness,
      anomalies,
      snapshotUsed,
      auditIntegrity,
      missionStatus: manager.getMissionStatus(),
      routeId: manager.getRouteId(),
      agents,
      tasks: manager.getTasks(),
      packets: manager.getPackets(),
      evaSessions: manager.getEvaSessions(),
      activeHazards: manager.getHazards(),
      activeWaypoints,
      metrics,
      schemaValid,
    };
  }

  public static inspectEvent(missionId: string, eventId: string): {
    event: MissionEventRecord;
    relatedEvents: MissionEventRecord[];
    auditIntegrity: { valid: boolean; totalEvents: number; brokenIndex?: number; reason?: string };
    auditChainValid: boolean;
    explanation: string;
    safetyChecks: any[];
  } | null {
    const events = this.getMissionEvents(missionId);
    const event = events.find((e) => e.eventId === eventId) || MissionEventStore.getEventById(eventId);
    if (!event) return null;

    const relatedEvents = events.filter(
      (e) =>
        e.eventId !== event.eventId &&
        ((event.correlationId && e.correlationId === event.correlationId) ||
          (event.entityId && e.entityId === event.entityId))
    );

    const auditIntegrity = MissionEventStore.verifyChain();
    const auditVerification = auditChainService.verifyChain();
    const p = (event.payload || {}) as Record<string, any>;

    let explanation = `${event.eventType} executed by ${event.actor}`;
    if (p.reason) explanation += ` — Rationale: ${p.reason}`;
    else if (p.taskName) explanation += ` — Task: ${p.taskName}`;
    else if (p.objective) explanation += ` — Objective: ${p.objective}`;

    const safetyChecks = Array.isArray(p.safetyWarnings)
      ? p.safetyWarnings
      : p.safetyChecks
      ? [p.safetyChecks]
      : [];

    return {
      event,
      relatedEvents,
      auditIntegrity,
      auditChainValid: Boolean(auditVerification.valid),
      explanation,
      safetyChecks,
    };
  }

  private static resolveComparisonSide(missionId: string, target: ComparisonTarget): {
    label: string;
    isLive: boolean;
    agents: any[];
    tasks: Record<string, any>;
    packets: Record<string, any>;
    evaSessions: Record<string, any>;
    hazards: any[];
    routeId: string | null;
    safetyStatus: string;
  } {
    if (target.type === "LIVE") {
      const liveAgents = AgentRegistry.getAllAgents();
      const tasksMap: Record<string, any> = {};
      for (const t of TaskLifecycleService.getAllTasks(missionId)) {
        tasksMap[t.id] = t;
      }
      const pktsMap: Record<string, any> = {};
      for (const pkt of CommunicationQueueService.getQueue()) {
        pktsMap[pkt.packetId] = pkt;
      }
      const evaMap: Record<string, any> = {};
      for (const s of EvaSessionService.listSessions(missionId)) {
        evaMap[s.id] = s;
      }
      const canonical = MissionStateCoordinator.synthesizeCanonicalState(missionId);
      const validation = MissionValidationEngine.validateMission(missionId);
      return {
        label: "LIVE CANONICAL STATE",
        isLive: true,
        agents: liveAgents,
        tasks: tasksMap,
        packets: pktsMap,
        evaSessions: evaMap,
        hazards: canonical.hazards?.catalogHazards || [],
        routeId: canonical.metadata?.activeRouteId || null,
        safetyStatus: validation.overallStatus,
      };
    }

    const rec = this.reconstructAt({
      missionId,
      eventId: target.type === "EVENT" ? target.eventId : undefined,
      sequenceNumber: target.type === "SEQUENCE" ? target.sequenceNumber : undefined,
      timestamp: target.type === "TIMESTAMP" ? target.timestamp : undefined,
    });

    return {
      label: `HISTORICAL (${rec.targetTimestamp})`,
      isLive: false,
      agents: rec.agents,
      tasks: rec.tasks,
      packets: rec.packets,
      evaSessions: rec.evaSessions,
      hazards: rec.activeHazards,
      routeId: rec.routeId,
      safetyStatus: rec.metrics?.safetyScore >= 70 ? "NOMINAL" : "WARNING",
    };
  }

  public static compareStates(
    missionId: string,
    leftTarget: ComparisonTarget,
    rightTarget: ComparisonTarget
  ): {
    missionId: string;
    leftLabel: string;
    rightLabel: string;
    totalDifferences: number;
    differences: StateDiffItem[];
  } {
    const left = this.resolveComparisonSide(missionId, leftTarget);
    const right = this.resolveComparisonSide(missionId, rightTarget);
    const differences: StateDiffItem[] = [];

    // 1. Agents & Resources
    const allAgentIds = new Set([...left.agents.map((a) => a.id), ...right.agents.map((a) => a.id)]);
    for (const id of allAgentIds) {
      const a1 = left.agents.find((a) => a.id === id);
      const a2 = right.agents.find((a) => a.id === id);
      if (!a1 && a2) {
        differences.push({ domain: "agents", entityId: id, changeType: "ADDED", summary: `Agent ${a2.callsign} added`, leftValue: null, rightValue: a2.status });
      } else if (a1 && !a2) {
        differences.push({ domain: "agents", entityId: id, changeType: "REMOVED", summary: `Agent ${a1.callsign} removed`, leftValue: a1.status, rightValue: null });
      } else if (a1 && a2) {
        if (a1.status !== a2.status) {
          differences.push({ domain: "agents", entityId: a1.callsign, changeType: "CHANGED", summary: `Status: ${a1.status} -> ${a2.status}`, leftValue: a1.status, rightValue: a2.status });
        }
        const b1 = a1.telemetry?.batteryPercent;
        const b2 = a2.telemetry?.batteryPercent;
        if (b1 !== b2) {
          differences.push({ domain: "resources", entityId: a1.callsign, changeType: "CHANGED", summary: `Battery: ${b1}% -> ${b2}%`, leftValue: b1, rightValue: b2 });
        }
        const lat1 = a1.position?.latitude;
        const lon1 = a1.position?.longitude;
        const lat2 = a2.position?.latitude;
        const lon2 = a2.position?.longitude;
        if (lat1 !== lat2 || lon1 !== lon2) {
          differences.push({
            domain: "agents",
            entityId: `${a1.callsign} (position)`,
            changeType: "CHANGED",
            summary: `Position moved (${lat1?.toFixed(4)}, ${lon1?.toFixed(4)}) -> (${lat2?.toFixed(4)}, ${lon2?.toFixed(4)})`,
            leftValue: a1.position,
            rightValue: a2.position,
          });
        }
      }
    }

    // 2. Tasks
    const allTaskIds = new Set([...Object.keys(left.tasks), ...Object.keys(right.tasks)]);
    for (const tid of allTaskIds) {
      const t1 = left.tasks[tid];
      const t2 = right.tasks[tid];
      if (!t1 && t2) {
        differences.push({ domain: "tasks", entityId: tid, changeType: "ADDED", summary: `Task "${t2.name}" (${t2.status}) added`, leftValue: null, rightValue: t2.status });
      } else if (t1 && !t2) {
        differences.push({ domain: "tasks", entityId: tid, changeType: "REMOVED", summary: `Task "${t1.name}" removed`, leftValue: t1.status, rightValue: null });
      } else if (t1 && t2 && t1.status !== t2.status) {
        differences.push({ domain: "tasks", entityId: tid, changeType: "CHANGED", summary: `Task "${t1.name}" status: ${t1.status} -> ${t2.status}`, leftValue: t1.status, rightValue: t2.status });
      }
    }

    // 3. Routes
    if (left.routeId !== right.routeId) {
      differences.push({
        domain: "routes",
        entityId: "activeRoute",
        changeType: "CHANGED",
        summary: `Active route: ${left.routeId || "UNSET"} -> ${right.routeId || "UNSET"}`,
        leftValue: left.routeId,
        rightValue: right.routeId,
      });
    }

    // 4. Hazards
    if (left.hazards.length !== right.hazards.length) {
      differences.push({
        domain: "hazards",
        entityId: "hazardCount",
        changeType: "CHANGED",
        summary: `Detected hazards: ${left.hazards.length} -> ${right.hazards.length}`,
        leftValue: left.hazards.length,
        rightValue: right.hazards.length,
      });
    }

    // 5. Communications
    const allPktIds = new Set([...Object.keys(left.packets), ...Object.keys(right.packets)]);
    for (const pid of allPktIds) {
      const p1 = left.packets[pid];
      const p2 = right.packets[pid];
      if (!p1 && p2) {
        differences.push({ domain: "communications", entityId: pid, changeType: "ADDED", summary: `Packet ${pid} (${p2.status})`, leftValue: null, rightValue: p2.status });
      } else if (p1 && p2 && p1.status !== p2.status) {
        differences.push({ domain: "communications", entityId: pid, changeType: "CHANGED", summary: `Packet ${pid}: ${p1.status} -> ${p2.status}`, leftValue: p1.status, rightValue: p2.status });
      }
    }

    // 6. EVA Sessions
    const allEvaIds = new Set([...Object.keys(left.evaSessions), ...Object.keys(right.evaSessions)]);
    for (const eid of allEvaIds) {
      const e1 = left.evaSessions[eid];
      const e2 = right.evaSessions[eid];
      if (!e1 && e2) {
        differences.push({ domain: "evaSessions", entityId: eid, changeType: "ADDED", summary: `EVA ${eid} (${e2.status})`, leftValue: null, rightValue: e2.status });
      } else if (e1 && e2 && e1.status !== e2.status) {
        differences.push({ domain: "evaSessions", entityId: eid, changeType: "CHANGED", summary: `EVA ${eid}: ${e1.status} -> ${e2.status}`, leftValue: e1.status, rightValue: e2.status });
      }
    }

    // 7. Safety Invariants
    if (left.safetyStatus !== right.safetyStatus) {
      differences.push({
        domain: "safetyInvariants",
        entityId: "overallStatus",
        changeType: "CHANGED",
        summary: `Safety status: ${left.safetyStatus} -> ${right.safetyStatus}`,
        leftValue: left.safetyStatus,
        rightValue: right.safetyStatus,
      });
    }

    return {
      missionId,
      leftLabel: left.label,
      rightLabel: right.label,
      totalDifferences: differences.length,
      differences,
    };
  }

  public static exportMissionData(params: {
    missionId: string;
    format: "csv" | "json" | "markdown";
    kind: "events" | "snapshot" | "summary" | "event";
    eventId?: string;
    sequenceNumber?: number;
    timestamp?: string;
    agentId?: string;
    eventType?: string;
  }): { contentType: string; filename: string; body: string } {
    const { missionId, format, kind } = params;
    let events = this.getMissionEvents(missionId);
    if (params.agentId && params.agentId !== "ALL") {
      events = events.filter((e) => e.actor === params.agentId || e.agentId === params.agentId);
    }
    if (params.eventType && params.eventType !== "ALL") {
      events = events.filter((e) => e.eventType === params.eventType);
    }

    const audit = MissionEventStore.verifyChain();

    if (kind === "events" && format === "csv") {
      const header = "sequenceNumber,eventId,missionId,timestamp,eventType,actor,entityId,provenanceSource,eventHash";
      const rows = events.map((e, i) => {
        const cols = [
          e.sequenceNumber ?? i + 1,
          e.eventId,
          e.missionId,
          e.timestamp,
          e.eventType,
          e.actor,
          e.entityId || "",
          e.provenance?.sourceType || "",
          e.eventHash,
        ];
        return cols.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
      });
      return {
        contentType: "text/csv",
        filename: `${missionId}-events.csv`,
        body: [header, ...rows].join("\n"),
      };
    }

    if (kind === "snapshot") {
      const reconstructed = this.reconstructAt({
        missionId,
        eventId: params.eventId,
        sequenceNumber: params.sequenceNumber,
        timestamp: params.timestamp,
      });
      return {
        contentType: "application/json",
        filename: `${missionId}-reconstructed-snapshot.json`,
        body: JSON.stringify(reconstructed, null, 2),
      };
    }

    if (kind === "event" && params.eventId) {
      const detail = this.inspectEvent(missionId, params.eventId);
      return {
        contentType: "application/json",
        filename: `${missionId}-event-${params.eventId}.json`,
        body: JSON.stringify(detail, null, 2),
      };
    }

    if (format === "markdown") {
      const lines = [
        `# Mission Replay Summary — ${missionId}`,
        `- **Exported At (UTC):** ${new Date().toISOString()}`,
        `- **Total Recorded Events:** ${events.length}`,
        `- **Event Chain Integrity:** ${audit.valid ? "VERIFIED (SHA-256)" : `BROKEN (${audit.reason})`}`,
        "",
        "## Chronological Event Timeline",
        ...events.slice(0, 100).map(
          (e, idx) =>
            `${idx + 1}. \`[${e.timestamp}]\` **${e.eventType}** by \`${e.actor}\` (${e.provenance?.sourceType || "DERIVED"}) — \`${e.eventId}\``
        ),
      ];
      return {
        contentType: "text/markdown",
        filename: `${missionId}-replay-summary.md`,
        body: lines.join("\n"),
      };
    }

    return {
      contentType: "application/json",
      filename: `${missionId}-replay-summary.json`,
      body: JSON.stringify({ missionId, exportedAt: new Date().toISOString(), auditIntegrity: audit, events }, null, 2),
    };
  }
}
