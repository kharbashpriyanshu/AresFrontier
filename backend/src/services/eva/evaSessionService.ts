import fs from "fs";
import path from "path";
import { CANONICAL_BACKEND_DATA_DIR } from "../../utils/dataDir.js";
import { AgentRegistry } from "../agents/agentRegistry.js";
import { AstronautAgent, RoverAgent } from "../agents/agentTypes.js";
import { MissionEventStore } from "../persistence/missionEventStore.js";
import { ProvenanceService } from "../planetary/provenanceService.js";
import { TaskLifecycleService, OperationsValidationError } from "../operations/taskLifecycleService.js";
import { auditChainService } from "../security/auditChainService.js";

export type EVASessionStatus =
  | "PLANNED"
  | "ACTIVE"
  | "PAUSED"
  | "EMERGENCY_RETURN"
  | "COMPLETED"
  | "ABORTED";

export type EVASessionAction =
  | "START"
  | "PAUSE"
  | "RESUME"
  | "EMERGENCY_RETURN"
  | "COMPLETE"
  | "ABORT";

export interface EVASafetyEvaluation {
  overallSafe: boolean;
  reserveMarginMinutes: number;
  suitOxygenReserveMinutes: number;
  crewBatteryPercent: number;
  roverBatteryPercent: number | null;
  violations: string[];
  warnings: string[];
}

export interface EVASessionHistoryEntry {
  timestamp: string;
  fromStatus: EVASessionStatus | null;
  toStatus: EVASessionStatus;
  actor: string;
  reason: string;
}

export interface EVASessionRecord {
  id: string;
  missionId: string;
  title: string;
  status: EVASessionStatus;
  crewAgentId: string;
  supportRoverId?: string;
  routeId: string;
  plannedDurationMinutes: number;
  elapsedMinutes: number;
  remainingMinutes: number;
  startedAt?: string;
  pausedAt?: string;
  endedAt?: string;
  updatedAt: string;
  safetyChecks: EVASafetyEvaluation;
  telemetryProvenance: {
    sourceType: "SIMULATED";
    label: string;
    updatedAt: string;
  };
  history: EVASessionHistoryEntry[];
}

export interface EVAEmergencySimulationResult {
  simulationId: string;
  sessionId: string;
  isolatedFromLiveState: true;
  scenario: string;
  estimatedReturnMinutes: number;
  projectedOxygenAtBaseMinutes: number;
  projectedCrewBatteryAtBasePercent: number;
  projectedRoverBatteryAtBasePercent: number | null;
  s3ReserveCompliant: boolean;
  s1BatteryCompliant: boolean;
  outcome: "SAFE_RETURN" | "MARGINAL_RETURN" | "CRITICAL_SHORTFALL";
  recommendations: string[];
  simulatedAt: string;
}

const VALID_EVA_TRANSITIONS: Record<EVASessionStatus, EVASessionAction[]> = {
  PLANNED: ["START", "ABORT"],
  ACTIVE: ["PAUSE", "EMERGENCY_RETURN", "COMPLETE", "ABORT"],
  PAUSED: ["RESUME", "EMERGENCY_RETURN", "COMPLETE", "ABORT"],
  EMERGENCY_RETURN: ["COMPLETE", "ABORT"],
  COMPLETED: [],
  ABORTED: [],
};

const ACTION_TO_EVA_STATUS: Record<EVASessionAction, EVASessionStatus> = {
  START: "ACTIVE",
  PAUSE: "PAUSED",
  RESUME: "ACTIVE",
  EMERGENCY_RETURN: "EMERGENCY_RETURN",
  COMPLETE: "COMPLETED",
  ABORT: "ABORTED",
};

export class EvaSessionService {
  private static readonly filePath = path.resolve(CANONICAL_BACKEND_DATA_DIR, "eva_sessions.json");
  private static sessions: Map<string, EVASessionRecord> = new Map();
  private static loaded = false;

  private static ensureLoaded(): void {
    if (this.loaded) return;
    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, "utf-8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const rec of parsed) {
            if (rec && rec.id) {
              this.sessions.set(rec.id, rec);
            }
          }
        }
      } catch {
        // Ignore corrupt file and reseed
      }
    }

    if (this.sessions.size === 0) {
      const seed = this.buildSessionRecord({
        id: "eva-sol100-marswalk-001",
        missionId: "MARSWALK-001",
        title: "Sol 100 Jezero Western Delta EVA-1",
        crewAgentId: "agent-astronaut-01",
        supportRoverId: "agent-rover-01",
        routeId: "route-jezero-delta-sol100",
        plannedDurationMinutes: 240,
      });
      this.sessions.set(seed.id, seed);
      this.persist();
    }
    this.loaded = true;
  }

  private static persist(): void {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      const tmp = `${this.filePath}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(Array.from(this.sessions.values()), null, 2), "utf-8");
      fs.renameSync(tmp, this.filePath);
    } catch {
      // Non-fatal fallback
    }
  }

  public static evaluateSafety(
    crewAgentId: string,
    supportRoverId: string | undefined,
    plannedDurationMinutes: number,
    elapsedMinutes: number
  ): EVASafetyEvaluation {
    const crew = AgentRegistry.getAgentById(crewAgentId) as AstronautAgent | undefined;
    const rover = supportRoverId ? (AgentRegistry.getAgentById(supportRoverId) as RoverAgent | undefined) : undefined;

    const suitO2 = crew?.suitOxygenReserveMinutes ?? 240;
    const crewBattery = crew?.telemetry.batteryPercent ?? 90;
    const roverBattery = rover ? rover.telemetry.batteryPercent : null;

    const remainingPlanned = Math.max(0, plannedDurationMinutes - elapsedMinutes);
    const reserveMarginMinutes = Math.round(suitO2 - remainingPlanned);

    const violations: string[] = [];
    const warnings: string[] = [];

    if (!crew) {
      violations.push(`Crew agent '${crewAgentId}' not found in registry`);
    } else {
      if (crew.status === "UNAVAILABLE" || crew.status === "EMERGENCY") {
        violations.push(`Crew agent ${crew.callsign} is in ${crew.status} state`);
      }
      if (crewBattery < 20) {
        violations.push(`S1/S3 Violation: Crew suit battery (${crewBattery}%) is below 20% minimum emergency reserve`);
      } else if (crewBattery < 35) {
        warnings.push(`Crew suit battery (${crewBattery}%) approaching reserve threshold`);
      }
      if (suitO2 < 30) {
        violations.push(`S3 Violation: Suit oxygen reserve (${suitO2} min) below 30-min mandatory return reserve`);
      } else if (reserveMarginMinutes < 30) {
        warnings.push(`Suit oxygen margin (${reserveMarginMinutes} min) below 30-min S3 return buffer`);
      }
    }

    if (rover) {
      if (rover.status === "UNAVAILABLE" || rover.status === "EMERGENCY") {
        violations.push(`Support rover ${rover.callsign} is ${rover.status}`);
      }
      if (roverBattery !== null && roverBattery < 20) {
        violations.push(`S1 Violation: Support rover battery (${roverBattery}%) below 20% return reserve`);
      }
    }

    return {
      overallSafe: violations.length === 0,
      reserveMarginMinutes,
      suitOxygenReserveMinutes: Math.round(suitO2),
      crewBatteryPercent: Math.round(crewBattery),
      roverBatteryPercent: roverBattery !== null ? Math.round(roverBattery) : null,
      violations,
      warnings,
    };
  }

  private static buildSessionRecord(input: {
    id?: string;
    missionId: string;
    title: string;
    crewAgentId: string;
    supportRoverId?: string;
    routeId: string;
    plannedDurationMinutes: number;
  }): EVASessionRecord {
    const now = new Date().toISOString();
    const safetyChecks = this.evaluateSafety(
      input.crewAgentId,
      input.supportRoverId,
      input.plannedDurationMinutes,
      0
    );
    return {
      id: input.id || `eva-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      missionId: input.missionId,
      title: input.title,
      status: "PLANNED",
      crewAgentId: input.crewAgentId,
      supportRoverId: input.supportRoverId,
      routeId: input.routeId,
      plannedDurationMinutes: input.plannedDurationMinutes,
      elapsedMinutes: 0,
      remainingMinutes: input.plannedDurationMinutes,
      updatedAt: now,
      safetyChecks,
      telemetryProvenance: {
        sourceType: "SIMULATED",
        label: "Modeled Suit & Rover Telemetry (Not Live Medical Hardware)",
        updatedAt: now,
      },
      history: [
        {
          timestamp: now,
          fromStatus: null,
          toStatus: "PLANNED",
          actor: "MISSION_COMMAND",
          reason: "EVA session created",
        },
      ],
    };
  }

  public static listSessions(missionId?: string): EVASessionRecord[] {
    this.ensureLoaded();
    const all = Array.from(this.sessions.values()).map((s) => ({
      ...s,
      safetyChecks: this.evaluateSafety(s.crewAgentId, s.supportRoverId, s.plannedDurationMinutes, s.elapsedMinutes),
    }));
    if (!missionId) return all;
    return all.filter((s) => s.missionId === missionId);
  }

  public static getSessionById(id: string): EVASessionRecord | undefined {
    this.ensureLoaded();
    const s = this.sessions.get(id);
    if (!s) return undefined;
    s.safetyChecks = this.evaluateSafety(s.crewAgentId, s.supportRoverId, s.plannedDurationMinutes, s.elapsedMinutes);
    return s;
  }

  public static createSession(input: {
    missionId?: string;
    title: string;
    crewAgentId?: string;
    supportRoverId?: string;
    routeId?: string;
    plannedDurationMinutes?: number;
  }): EVASessionRecord {
    this.ensureLoaded();
    const crewAgentId = input.crewAgentId || "agent-astronaut-01";
    const crew = AgentRegistry.getAgentById(crewAgentId);
    if (!crew) {
      throw new OperationsValidationError("NOT_FOUND", `Crew agent '${crewAgentId}' not found`, 404);
    }

    const record = this.buildSessionRecord({
      missionId: input.missionId || "MARSWALK-001",
      title: input.title,
      crewAgentId,
      supportRoverId: input.supportRoverId,
      routeId: input.routeId || "route-jezero-delta-sol100",
      plannedDurationMinutes: input.plannedDurationMinutes ?? 240,
    });

    this.sessions.set(record.id, record);
    this.persist();
    return record;
  }

  public static transitionSession(
    id: string,
    action: EVASessionAction,
    reason?: string
  ): EVASessionRecord {
    this.ensureLoaded();
    const session = this.sessions.get(id);
    if (!session) {
      throw new OperationsValidationError("NOT_FOUND", `EVA session '${id}' not found`, 404);
    }

    const allowed = VALID_EVA_TRANSITIONS[session.status] || [];
    if (!allowed.includes(action)) {
      throw new OperationsValidationError(
        "INVALID_STATE_TRANSITION",
        `Cannot ${action} EVA session '${session.title}' while in status '${session.status}'. Allowed: ${allowed.join(", ") || "none (terminal)"}`,
        400,
        { currentStatus: session.status, attemptedAction: action, allowedActions: allowed }
      );
    }

    const safety = this.evaluateSafety(
      session.crewAgentId,
      session.supportRoverId,
      session.plannedDurationMinutes,
      session.elapsedMinutes
    );

    if ((action === "START" || action === "RESUME") && !safety.overallSafe) {
      throw new OperationsValidationError(
        "SAFETY_INVARIANT_VIOLATION",
        `Cannot ${action.toLowerCase()} EVA: ${safety.violations.join("; ")}`,
        400,
        { safetyChecks: safety }
      );
    }

    const now = new Date().toISOString();
    const prevStatus = session.status;
    const nextStatus = ACTION_TO_EVA_STATUS[action];

    session.status = nextStatus;
    session.updatedAt = now;
    session.safetyChecks = safety;
    session.telemetryProvenance.updatedAt = now;

    if (action === "START" && !session.startedAt) session.startedAt = now;
    if (action === "PAUSE") session.pausedAt = now;
    if (action === "COMPLETE" || action === "ABORT") session.endedAt = now;

    session.history.push({
      timestamp: now,
      fromStatus: prevStatus,
      toStatus: nextStatus,
      actor: "MISSION_COMMAND",
      reason: reason || `EVA ${action}`,
    });

    // Update associated crew & support rover status in canonical AgentRegistry
    const crew = AgentRegistry.getAgentById(session.crewAgentId);
    if (crew) {
      if (nextStatus === "ACTIVE") {
        crew.status = "EXECUTING";
        crew.telemetry.speedKph = 2.6;
      } else if (nextStatus === "PAUSED") {
        crew.status = "PAUSED";
        crew.telemetry.speedKph = 0;
      } else if (nextStatus === "EMERGENCY_RETURN") {
        crew.status = "RETURNING";
        crew.telemetry.speedKph = 3.2;
      } else if (nextStatus === "COMPLETED" || nextStatus === "ABORTED") {
        crew.status = "IDLE";
        crew.telemetry.speedKph = 0;
      }
      AgentRegistry.updateAgent(crew);
    }

    if (session.supportRoverId) {
      const rover = AgentRegistry.getAgentById(session.supportRoverId);
      if (rover && rover.status !== "UNAVAILABLE") {
        if (nextStatus === "EMERGENCY_RETURN") rover.status = "RETURNING";
        else if (nextStatus === "PAUSED") rover.status = "PAUSED";
        else if (nextStatus === "ACTIVE") rover.status = "EXECUTING";
        else if (nextStatus === "COMPLETED" || nextStatus === "ABORTED") rover.status = "IDLE";
        AgentRegistry.updateAgent(rover);
      }
    }

    this.sessions.set(session.id, session);
    this.persist();

    MissionEventStore.appendEvent({
      missionId: session.missionId,
      eventType: nextStatus === "EMERGENCY_RETURN" ? "HAZARD_DETECTED" : "COMMAND_EXECUTED",
      actor: crew?.callsign || session.crewAgentId,
      payload: {
        evaSessionId: session.id,
        action,
        previousStatus: prevStatus,
        nextStatus,
        reason,
      },
      provenance: ProvenanceService.createDerivedProvenance(
        "EVA Session Safety Controller",
        ["Suit Telemetry Model", "S1-S8 Invariants"],
        `EVA ${action}`
      ),
    });

    auditChainService.appendEvent({
      userId: "MISSION_COMMAND",
      role: "MISSION_COMMAND",
      action: "MODIFY_PRIORITIES",
      missionPlanId: session.missionId,
      details: { evaTransition: action, evaSessionId: session.id, prevStatus, nextStatus },
    });

    TaskLifecycleService.syncDigitalTwin(session.missionId);
    return session;
  }

  public static advanceSessionTime(id: string, minutes: number): EVASessionRecord {
    this.ensureLoaded();
    const session = this.sessions.get(id);
    if (!session) {
      throw new OperationsValidationError("NOT_FOUND", `EVA session '${id}' not found`, 404);
    }
    if (session.status !== "ACTIVE" && session.status !== "EMERGENCY_RETURN") {
      throw new OperationsValidationError(
        "INVALID_STATE_TRANSITION",
        `Cannot advance MET while EVA session is '${session.status}'`,
        400
      );
    }

    const delta = Math.max(1, Math.min(120, Math.round(minutes)));
    session.elapsedMinutes += delta;
    session.remainingMinutes = Math.max(0, session.plannedDurationMinutes - session.elapsedMinutes);
    const now = new Date().toISOString();
    session.updatedAt = now;
    session.telemetryProvenance.updatedAt = now;

    // Modeled suit O2 & battery drain
    const crew = AgentRegistry.getAgentById(session.crewAgentId) as AstronautAgent | undefined;
    if (crew) {
      const currentO2 = crew.suitOxygenReserveMinutes ?? 240;
      crew.suitOxygenReserveMinutes = Math.max(0, Number((currentO2 - delta).toFixed(1)));
      crew.telemetry.batteryPercent = Math.max(0, Number((crew.telemetry.batteryPercent - delta * 0.25).toFixed(1)));
      crew.telemetry.suitOxygenPercent = Math.max(0, Math.round((crew.suitOxygenReserveMinutes / 240) * 100));
      crew.telemetry.lastHeartbeat = now;
      AgentRegistry.updateAgent(crew);
    }

    session.safetyChecks = this.evaluateSafety(
      session.crewAgentId,
      session.supportRoverId,
      session.plannedDurationMinutes,
      session.elapsedMinutes
    );

    this.sessions.set(session.id, session);
    this.persist();
    TaskLifecycleService.syncDigitalTwin(session.missionId);
    return session;
  }

  /**
   * Isolated Emergency Return simulation: clones current parameters in memory
   * and evaluates return feasibility without mutating live EVA or fleet state.
   */
  public static simulateEmergencyReturn(
    id: string,
    params?: { scenario?: string; speedFactor?: number; extraHazardDelayMinutes?: number }
  ): EVAEmergencySimulationResult {
    this.ensureLoaded();
    const session = this.sessions.get(id);
    if (!session) {
      throw new OperationsValidationError("NOT_FOUND", `EVA session '${id}' not found`, 404);
    }

    const crew = AgentRegistry.getAgentById(session.crewAgentId) as AstronautAgent | undefined;
    const rover = session.supportRoverId
      ? (AgentRegistry.getAgentById(session.supportRoverId) as RoverAgent | undefined)
      : undefined;

    const speedFactor = Math.max(0.4, Math.min(1.5, params?.speedFactor ?? 1.0));
    const extraDelay = Math.max(0, params?.extraHazardDelayMinutes ?? 0);
    const baseReturnMinutes = Math.max(12, Math.round(session.elapsedMinutes * 0.55) + 15);
    const estimatedReturnMinutes = Math.round(baseReturnMinutes / speedFactor) + extraDelay;

    const currentO2 = crew?.suitOxygenReserveMinutes ?? 240;
    const currentCrewBatt = crew?.telemetry.batteryPercent ?? 90;
    const currentRoverBatt = rover ? rover.telemetry.batteryPercent : null;

    const projectedOxygenAtBaseMinutes = Math.round(currentO2 - estimatedReturnMinutes);
    const projectedCrewBatteryAtBasePercent = Number(
      Math.max(0, currentCrewBatt - estimatedReturnMinutes * 0.28).toFixed(1)
    );
    const projectedRoverBatteryAtBasePercent =
      currentRoverBatt !== null
        ? Number(Math.max(0, currentRoverBatt - estimatedReturnMinutes * 0.22).toFixed(1))
        : null;

    const s3ReserveCompliant = projectedOxygenAtBaseMinutes >= 30;
    const s1BatteryCompliant =
      projectedCrewBatteryAtBasePercent >= 20 &&
      (projectedRoverBatteryAtBasePercent === null || projectedRoverBatteryAtBasePercent >= 20);

    let outcome: EVAEmergencySimulationResult["outcome"] = "SAFE_RETURN";
    const recommendations: string[] = [];

    if (projectedOxygenAtBaseMinutes <= 0 || projectedCrewBatteryAtBasePercent <= 5) {
      outcome = "CRITICAL_SHORTFALL";
      recommendations.push("Immediate emergency abort recommended; deploy support rover rescue tether.");
    } else if (!s3ReserveCompliant || !s1BatteryCompliant) {
      outcome = "MARGINAL_RETURN";
      recommendations.push("Return feasible only by direct shortest-path corridor; suspend all science stops.");
    } else {
      recommendations.push("Direct return to habitat airlock satisfies S1 battery and S3 30-minute oxygen reserve.");
    }

    return {
      simulationId: `sim-eva-rtb-${Date.now()}`,
      sessionId: session.id,
      isolatedFromLiveState: true,
      scenario: params?.scenario || "Direct Habitat Emergency Return",
      estimatedReturnMinutes,
      projectedOxygenAtBaseMinutes,
      projectedCrewBatteryAtBasePercent,
      projectedRoverBatteryAtBasePercent,
      s3ReserveCompliant,
      s1BatteryCompliant,
      outcome,
      recommendations,
      simulatedAt: new Date().toISOString(),
    };
  }

  /**
   * Removes EVA sessions belonging strictly to the given mission IDs (e.g., isolated demo reset).
   */
  public static deleteSessionsForMissions(missionIds: string[]): number {
    this.ensureLoaded();
    const idSet = new Set(missionIds);
    let removed = 0;
    for (const [id, session] of this.sessions.entries()) {
      if (idSet.has(session.missionId)) {
        this.sessions.delete(id);
        removed += 1;
      }
    }
    if (removed > 0) {
      this.persist();
    }
    return removed;
  }
}
