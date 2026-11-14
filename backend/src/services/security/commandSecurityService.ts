import fs from "fs";
import path from "path";
import { MissionCommandEnvelope, UserRole } from "../../types/index.js";
import { auditChainService } from "./auditChainService.js";
import { AgentRegistry } from "../agents/agentRegistry.js";
import { AgentStateStore } from "../agents/agentStateStore.js";

export type SecurityAction =
  | "VIEW_TELEMETRY"
  | "VIEW_HAZARDS"
  | "VIEW_SCIENCE"
  | "ASSIGN_SCIENCE"
  | "COMMAND_ROVER"
  | "PAUSE_MISSION"
  | "APPROVE_REPLAN"
  | "LOCK_MISSION"
  | "EMERGENCY_STOP";

export const RBAC_PERMISSIONS: Record<SecurityAction, UserRole[]> = {
  VIEW_TELEMETRY: ["VIEWER", "ANALYST", "ASTRONAUT", "SCIENCE_OFFICER", "MISSION_COMMAND"],
  VIEW_HAZARDS: ["VIEWER", "ANALYST", "ASTRONAUT", "SCIENCE_OFFICER", "MISSION_COMMAND"],
  VIEW_SCIENCE: ["VIEWER", "ANALYST", "ASTRONAUT", "SCIENCE_OFFICER", "MISSION_COMMAND"],
  ASSIGN_SCIENCE: ["SCIENCE_OFFICER", "MISSION_COMMAND"],
  COMMAND_ROVER: ["ASTRONAUT", "MISSION_COMMAND"],
  PAUSE_MISSION: ["MISSION_COMMAND"],
  APPROVE_REPLAN: ["MISSION_COMMAND"],
  LOCK_MISSION: ["MISSION_COMMAND"],
  EMERGENCY_STOP: ["ASTRONAUT", "MISSION_COMMAND"],
};

export interface CommandValidationResult {
  valid: boolean;
  code?: string;
  reason?: string;
}

export interface ProcessedCommandRecord {
  commandId: string;
  nonce: string;
  issuer: string;
  role: UserRole;
  agentId: string;
  command: string;
  issuedAt: number;
  expiresAt: number;
  status: "EXECUTED" | "REJECTED";
  processedAt: string;
}

const baseDataDir = process.cwd().endsWith("backend")
  ? path.resolve(process.cwd(), "data")
  : path.resolve(process.cwd(), "backend", "data");

export class CommandSecurityService {
  private static processedCommands: Map<string, number> = new Map(); // commandId -> expiresAt
  private static processedNonces: Set<string> = new Set();
  public static readonly MAX_COMMAND_TTL_MS = 300 * 1000; // 300 seconds (5 min) max TTL
  private static readonly MAX_CLOCK_SKEW_MS = 30 * 1000; // 30 sec future allowance
  private static persistencePath = path.resolve(baseDataDir, "command_security_state.json");
  private static records: ProcessedCommandRecord[] = [];
  private static initialized = false;

  private static ensureInitialized(): void {
    if (this.initialized) return;
    this.initialized = true;
    try {
      if (fs.existsSync(this.persistencePath)) {
        const raw = fs.readFileSync(this.persistencePath, "utf-8");
        this.records = JSON.parse(raw);
        const now = Date.now();
        for (const rec of this.records) {
          if (rec.expiresAt > now) {
            this.processedCommands.set(rec.commandId, rec.expiresAt);
            this.processedNonces.add(rec.nonce);
          }
        }
      }
    } catch (err) {
      console.warn("Failed to load persistent security state. Initializing empty.", err);
    }
  }

  /**
   * Checks if a given role possesses permission for the specified action.
   */
  public static checkPermission(role: UserRole, action: SecurityAction): boolean {
    const allowed = RBAC_PERMISSIONS[action];
    return allowed ? allowed.includes(role) : false;
  }

  /**
   * Validates a command envelope for replay, expiration, structure, and RBAC authorization.
   */
  public static validateCommandEnvelope(
    envelope: MissionCommandEnvelope,
    authenticatedUser: { userId: string; role: UserRole; callsign: string }
  ): CommandValidationResult {
    this.ensureInitialized();
    const now = Date.now();

    // 1. Structural checks
    if (!envelope.commandId || !envelope.agentId || !envelope.command || !envelope.nonce) {
      this.recordRejectedCommand(envelope, authenticatedUser, "MALFORMED_COMMAND", "Missing required fields");
      return { valid: false, code: "MALFORMED_COMMAND", reason: "Command envelope missing mandatory fields" };
    }

    // 2. Identity match: Never trust unauthenticated role or issuer in body
    if (envelope.role && envelope.role !== authenticatedUser.role) {
      this.recordRejectedCommand(
        envelope,
        authenticatedUser,
        "ROLE_MISMATCH",
        `Claimed role '${envelope.role}' does not match authenticated token '${authenticatedUser.role}'`
      );
      return {
        valid: false,
        code: "ROLE_MISMATCH",
        reason: "Claimed role does not match authenticated token",
      };
    }

    // 3. RBAC authorization check based on command type
    let requiredAction: SecurityAction = "COMMAND_ROVER";
    if (envelope.command === "EMERGENCY_STOP") requiredAction = "EMERGENCY_STOP";
    else if (envelope.command === "ASSIGN_TASK") requiredAction = "ASSIGN_SCIENCE";

    if (!this.checkPermission(authenticatedUser.role, requiredAction)) {
      this.recordRejectedCommand(
        envelope,
        authenticatedUser,
        "UNAUTHORIZED_ACTION",
        `Role '${authenticatedUser.role}' lacks permission for '${requiredAction}'`
      );
      return {
        valid: false,
        code: "FORBIDDEN",
        reason: `Role '${authenticatedUser.role}' is not authorized to execute '${requiredAction}'`,
      };
    }

    // 4. Temporal TTL & Expiration checks (Invariant S8 Hardening)
    if (envelope.issuedAt && envelope.expiresAt) {
      const commandTtl = envelope.expiresAt - envelope.issuedAt;
      if (commandTtl > this.MAX_COMMAND_TTL_MS) {
        this.recordRejectedCommand(
          envelope,
          authenticatedUser,
          "TTL_EXCEEDED",
          `Command TTL of ${Math.round(commandTtl / 1000)}s exceeds maximum allowed ${this.MAX_COMMAND_TTL_MS / 1000}s`
        );
        return {
          valid: false,
          code: "TTL_EXCEEDED",
          reason: `Command TTL ${Math.round(commandTtl / 1000)}s exceeds maximum allowed 300 seconds`,
        };
      }
    }

    // Reject commands issued too far in past
    if (envelope.issuedAt && envelope.issuedAt < now - this.MAX_COMMAND_TTL_MS - this.MAX_CLOCK_SKEW_MS) {
      this.recordRejectedCommand(
        envelope,
        authenticatedUser,
        "COMMAND_STALE",
        `Command issued timestamp is older than maximum freshness limit (300s)`
      );
      return {
        valid: false,
        code: "COMMAND_STALE",
        reason: "Command issued timestamp exceeds maximum freshness window",
      };
    }

    if (envelope.expiresAt && now > envelope.expiresAt) {
      this.recordRejectedCommand(envelope, authenticatedUser, "COMMAND_EXPIRED", "Command expired before processing");
      return { valid: false, code: "COMMAND_EXPIRED", reason: "Command TTL has expired" };
    }

    // 5. Clock skew check
    if (envelope.issuedAt && envelope.issuedAt > now + this.MAX_CLOCK_SKEW_MS) {
      this.recordRejectedCommand(envelope, authenticatedUser, "INVALID_TIMESTAMP", "IssuedAt is too far in future");
      return { valid: false, code: "INVALID_TIMESTAMP", reason: "Command timestamp is in the future" };
    }

    // 6. Replay protection (Command ID)
    if (this.processedCommands.has(envelope.commandId)) {
      this.recordRejectedCommand(envelope, authenticatedUser, "COMMAND_REPLAYED", `Command ${envelope.commandId} was already executed`);
      return { valid: false, code: "COMMAND_REPLAYED", reason: "Duplicate commandId detected (replay attack blocked)" };
    }

    // 7. Nonce check
    if (this.processedNonces.has(envelope.nonce)) {
      this.recordRejectedCommand(envelope, authenticatedUser, "NONCE_REPLAYED", `Nonce ${envelope.nonce} was already spent`);
      return { valid: false, code: "NONCE_REPLAYED", reason: "Cryptographic nonce already consumed" };
    }

    // 8. Agent state transition safety check
    const agent = AgentRegistry.getAgentById(envelope.agentId);
    if (!agent) {
      return { valid: false, code: "AGENT_NOT_FOUND", reason: `Agent '${envelope.agentId}' does not exist` };
    }

    if (agent.status === "EMERGENCY" && envelope.command === "RESUME") {
      this.recordRejectedCommand(
        envelope,
        authenticatedUser,
        "INVALID_STATE_TRANSITION",
        "Cannot resume agent in EMERGENCY status without explicit reset"
      );
      return {
        valid: false,
        code: "INVALID_STATE_TRANSITION",
        reason: "Cannot resume agent in EMERGENCY status without explicit mission command clear",
      };
    }

    // Record as spent
    const expTime = envelope.expiresAt || now + this.MAX_COMMAND_TTL_MS;
    this.processedCommands.set(envelope.commandId, expTime);
    this.processedNonces.add(envelope.nonce);

    // Persist to disk
    this.persistCommandRecord({
      commandId: envelope.commandId,
      nonce: envelope.nonce,
      issuer: authenticatedUser.userId,
      role: authenticatedUser.role,
      agentId: envelope.agentId,
      command: envelope.command,
      issuedAt: envelope.issuedAt || now,
      expiresAt: expTime,
      status: "EXECUTED",
      processedAt: new Date().toISOString(),
    });

    // Clean up expired items periodically
    this.pruneOldRecords();

    return { valid: true };
  }

  private static recordRejectedCommand(
    envelope: MissionCommandEnvelope,
    user: { userId: string; role: UserRole; callsign: string },
    code: string,
    reason: string
  ): void {
    auditChainService.appendEvent({
      userId: user.userId,
      role: user.role,
      action: "OPTIMIZE_ROUTE", // fallback action
      missionPlanId: "SECURITY_EVENT",
      details: {
        eventType: "COMMAND_REJECTED",
        commandId: envelope.commandId,
        agentId: envelope.agentId,
        rejectedCode: code,
        rejectedReason: reason,
        attemptedCommand: envelope.command,
      },
    });

    AgentStateStore.recordEvent({
      agentId: envelope.agentId,
      eventType: "COMMAND_REJECTED",
      severity: "CRITICAL",
      message: `Security rejection for ${envelope.commandId}: ${reason}`,
      details: { code, actor: user.userId },
    });

    this.persistCommandRecord({
      commandId: envelope.commandId,
      nonce: envelope.nonce,
      issuer: user.userId,
      role: user.role,
      agentId: envelope.agentId,
      command: envelope.command,
      issuedAt: envelope.issuedAt || Date.now(),
      expiresAt: envelope.expiresAt || Date.now() + this.MAX_COMMAND_TTL_MS,
      status: "REJECTED",
      processedAt: new Date().toISOString(),
    });
  }

  private static persistCommandRecord(record: ProcessedCommandRecord): void {
    try {
      this.records.push(record);
      // Keep bounded to last 1000 records
      if (this.records.length > 1000) {
        this.records = this.records.slice(-1000);
      }
      const dir = path.dirname(this.persistencePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Atomic persistence
      const tmpPath = `${this.persistencePath}.tmp.${Date.now()}`;
      fs.writeFileSync(tmpPath, JSON.stringify(this.records, null, 2), "utf-8");
      const fd = fs.openSync(tmpPath, "r+");
      fs.fsyncSync(fd);
      fs.closeSync(fd);
      fs.renameSync(tmpPath, this.persistencePath);
    } catch (err) {
      console.warn("Failed to persist command security record", err);
    }
  }

  private static pruneOldRecords(): void {
    const now = Date.now();
    for (const [id, exp] of this.processedCommands.entries()) {
      if (now > exp) {
        this.processedCommands.delete(id);
      }
    }
  }

  /**
   * Resets the processed command memory and disk storage (for testing purposes).
   */
  public static resetSecurityState(purgeDisk: boolean = true): void {
    this.processedCommands.clear();
    this.processedNonces.clear();
    this.records = [];
    if (purgeDisk) {
      try {
        if (fs.existsSync(this.persistencePath)) {
          fs.unlinkSync(this.persistencePath);
        }
      } catch {
        // Ignore
      }
    }
    this.initialized = false;
  }
}
