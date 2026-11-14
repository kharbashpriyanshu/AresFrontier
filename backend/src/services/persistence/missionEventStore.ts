import crypto from "crypto";
import fs from "fs";
import path from "path";
import { MissionEventRecord, MissionEventType, DataProvenance } from "../../types/index.js";
import { ProvenanceService } from "../planetary/provenanceService.js";
import { CANONICAL_BACKEND_DATA_DIR } from "../../utils/dataDir.js";

const baseDataDir = CANONICAL_BACKEND_DATA_DIR;

export interface AppendMissionEventParams {
  missionId: string;
  actor: string;
  agentId?: string;
  entityId?: string;
  correlationId?: string;
  auditRef?: string;
  idempotencyKey?: string;
  simulationTime?: number;
  timestamp?: string;
  eventType: MissionEventType;
  previousState?: Record<string, unknown>;
  resultingState?: Record<string, unknown>;
  payload: Record<string, unknown>;
  provenance?: DataProvenance;
}

export class MissionEventStore {
  private static events: MissionEventRecord[] = [];
  private static filePath: string = path.resolve(baseDataDir, "mission_events.json");
  private static readonly GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000";
  private static initialized = false;

  private static ensureInitialized(): void {
    if (!this.initialized) {
      this.initialize();
    }
  }

  public static initialize(): void {
    this.initialized = true;
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, "utf-8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.events = parsed;
          return;
        }
      }
    } catch {
      // In-memory fallback
    }
    this.events = [];
  }

  public static computeEventHash(params: {
    previousEventHash: string;
    eventId: string;
    missionId: string;
    timestamp: string;
    actor: string;
    eventType: MissionEventType;
    payload: Record<string, unknown>;
  }): string {
    const hashPayload = JSON.stringify({
      previousEventHash: params.previousEventHash,
      eventId: params.eventId,
      missionId: params.missionId,
      timestamp: params.timestamp,
      actor: params.actor,
      eventType: params.eventType,
      payload: params.payload,
    });
    return crypto.createHash("sha256").update(hashPayload).digest("hex");
  }

  /**
   * Deterministic sort by (timestamp ASC, sequenceNumber ASC, eventId ASC).
   */
  public static sortDeterministic(list: MissionEventRecord[]): MissionEventRecord[] {
    return [...list].sort((a, b) => {
      const ta = new Date(a.timestamp).getTime();
      const tb = new Date(b.timestamp).getTime();
      if (ta !== tb) return ta - tb;
      const sa = a.sequenceNumber ?? 0;
      const sb = b.sequenceNumber ?? 0;
      if (sa !== sb) return sa - sb;
      return a.eventId.localeCompare(b.eventId);
    });
  }

  /**
   * Appends an immutable mission event with cryptographic chaining and idempotency protection.
   */
  public static appendEvent(params: AppendMissionEventParams): MissionEventRecord {
    this.ensureInitialized();

    if (params.idempotencyKey) {
      const existing = this.events.find((e) => e.idempotencyKey === params.idempotencyKey);
      if (existing) {
        return existing;
      }
    }

    const previousEventHash =
      this.events.length === 0
        ? this.GENESIS_HASH
        : this.events[this.events.length - 1].eventHash;

    const maxSeq = this.events.reduce((max, e, idx) => Math.max(max, e.sequenceNumber ?? idx + 1), 0);
    const sequenceNumber = maxSeq + 1;

    const eventId = `mevt-${Date.now()}-${sequenceNumber}-${Math.random().toString(36).substring(2, 6)}`;
    const timestamp = params.timestamp || new Date().toISOString();
    const provenance =
      params.provenance ||
      ProvenanceService.createDerivedProvenance(
        "Mission Event Engine",
        ["Audit Logger v5.0"],
        "Cryptographic Chained Event Store"
      );

    const eventHash = this.computeEventHash({
      previousEventHash,
      eventId,
      missionId: params.missionId,
      timestamp,
      actor: params.actor,
      eventType: params.eventType,
      payload: params.payload,
    });

    const record: MissionEventRecord = {
      eventId,
      sequenceNumber,
      missionId: params.missionId,
      timestamp,
      simulationTime: params.simulationTime,
      actor: params.actor,
      agentId: params.agentId,
      entityId: params.entityId,
      correlationId: params.correlationId,
      auditRef: params.auditRef,
      idempotencyKey: params.idempotencyKey,
      eventType: params.eventType,
      previousState: params.previousState,
      resultingState: params.resultingState,
      payload: params.payload,
      provenance,
      previousEventHash,
      eventHash,
    };

    this.events.push(record);
    this.persist();

    return record;
  }

  public static getEvents(limit: number = 50): MissionEventRecord[] {
    this.ensureInitialized();
    return this.events.slice(-limit);
  }

  public static getAllEvents(): MissionEventRecord[] {
    this.ensureInitialized();
    return this.sortDeterministic(this.events);
  }

  public static getEventsByMission(missionId: string): MissionEventRecord[] {
    this.ensureInitialized();
    return this.sortDeterministic(this.events.filter((e) => e.missionId === missionId));
  }

  public static getEventById(id: string): MissionEventRecord | undefined {
    this.ensureInitialized();
    return this.events.find((e) => e.eventId === id);
  }

  public static verifyChain(): { valid: boolean; totalEvents: number; brokenIndex?: number; reason?: string } {
    this.ensureInitialized();
    for (let i = 0; i < this.events.length; i++) {
      const current = this.events[i];
      const expectedPrev = i === 0 ? this.GENESIS_HASH : this.events[i - 1].eventHash;
      if (current.previousEventHash !== expectedPrev) {
        return {
          valid: false,
          totalEvents: this.events.length,
          brokenIndex: i,
          reason: `Previous hash mismatch at index ${i} (${current.eventId})`,
        };
      }
      const recomputed = this.computeEventHash({
        previousEventHash: current.previousEventHash,
        eventId: current.eventId,
        missionId: current.missionId,
        timestamp: current.timestamp,
        actor: current.actor,
        eventType: current.eventType,
        payload: current.payload,
      });
      if (current.eventHash !== recomputed) {
        return {
          valid: false,
          totalEvents: this.events.length,
          brokenIndex: i,
          reason: `SHA-256 payload integrity mismatch at index ${i} (${current.eventId})`,
        };
      }
    }
    return { valid: true, totalEvents: this.events.length };
  }

  private static persist(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const tmp = `${this.filePath}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.events, null, 2), "utf-8");
      fs.renameSync(tmp, this.filePath);
    } catch {
      // Graceful fallback
    }
  }

  public static clearEvents(): void {
    this.events = [];
    this.initialized = true;
    try {
      if (fs.existsSync(this.filePath)) {
        fs.unlinkSync(this.filePath);
      }
    } catch {
      // Ignore
    }
  }
}
