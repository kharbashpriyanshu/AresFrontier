import crypto from "crypto";
import fs from "fs";
import path from "path";
import { MissionEventRecord, MissionEventType, DataProvenance } from "../../types/index.js";
import { ProvenanceService } from "../planetary/provenanceService.js";

const baseDataDir = process.cwd().endsWith("backend")
  ? path.resolve(process.cwd(), "data")
  : path.resolve(process.cwd(), "backend", "data");

export class MissionEventStore {
  private static events: MissionEventRecord[] = [];
  private static filePath: string = path.resolve(baseDataDir, "mission_events.json");
  private static readonly GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000";

  public static initialize(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, "utf-8");
        this.events = JSON.parse(raw);
        return;
      }
    } catch {
      // In-memory fallback
    }
    this.events = [];
  }

  /**
   * Appends an immutable mission event with cryptographic chaining.
   */
  public static appendEvent(params: {
    missionId: string;
    actor: string;
    eventType: MissionEventType;
    payload: Record<string, unknown>;
    provenance?: DataProvenance;
  }): MissionEventRecord {
    const previousEventHash =
      this.events.length === 0
        ? this.GENESIS_HASH
        : this.events[this.events.length - 1].eventHash;

    const eventId = `mevt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const timestamp = new Date().toISOString();
    const provenance =
      params.provenance ||
      ProvenanceService.createDerivedProvenance(
        "Mission Event Engine",
        ["Audit Logger v5.0"],
        "Cryptographic Chained Event Store"
      );

    const hashPayload = JSON.stringify({
      previousEventHash,
      eventId,
      missionId: params.missionId,
      timestamp,
      actor: params.actor,
      eventType: params.eventType,
      payload: params.payload,
    });

    const eventHash = crypto.createHash("sha256").update(hashPayload).digest("hex");

    const record: MissionEventRecord = {
      eventId,
      missionId: params.missionId,
      timestamp,
      actor: params.actor,
      eventType: params.eventType,
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
    return this.events.slice(-limit);
  }

  public static getEventById(id: string): MissionEventRecord | undefined {
    return this.events.find((e) => e.eventId === id);
  }

  public static verifyChain(): { valid: boolean; totalEvents: number; brokenIndex?: number } {
    for (let i = 0; i < this.events.length; i++) {
      const current = this.events[i];
      const expectedPrev = i === 0 ? this.GENESIS_HASH : this.events[i - 1].eventHash;
      if (current.previousEventHash !== expectedPrev) {
        return { valid: false, totalEvents: this.events.length, brokenIndex: i };
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
      fs.writeFileSync(this.filePath, JSON.stringify(this.events, null, 2), "utf-8");
    } catch {
      // Graceful fallback
    }
  }

  public static clearEvents(): void {
    this.events = [];
    try {
      if (fs.existsSync(this.filePath)) {
        fs.unlinkSync(this.filePath);
      }
    } catch {
      // Ignore
    }
  }
}
