import crypto from "crypto";
import fs from "fs";
import path from "path";
import { CANONICAL_BACKEND_DATA_DIR } from "../../utils/dataDir.js";
import {
  AuditChainBlock,
  AuditVerificationResult,
  MissionPlanStatus,
  MissionPlanVersion,
  UserRole,
} from "../../types/index.js";

/**
 * Persistent Hash-Chained Audit Service (Person 2 Cybersecurity Contract)
 * Maintains a cryptographic, tamper-evident hash chain for all mission plan events.
 */
export class AuditChainService {
  private chain: AuditChainBlock[] = [];
  private planVersions: Map<string, MissionPlanVersion[]> = new Map();
  private filePath: string;

  private static readonly GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000";

  constructor(storageDir?: string) {
    const dir = storageDir || CANONICAL_BACKEND_DATA_DIR;
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch {
        // Fallback for restricted environments
      }
    }
    this.filePath = path.join(dir, "audit_chain.json");
    this.loadChain();
  }

  private loadChain(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, "utf-8");
        this.chain = JSON.parse(raw);
        return;
      }
    } catch {
      // In-memory fallback if disk is read-only
    }
    this.chain = [];
  }

  private persistChain(): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.chain, null, 2), "utf-8");
    } catch {
      // Graceful in-memory operation
    }
  }

  /**
   * Appends an event to the cryptographic audit chain.
   */
  public appendEvent(params: {
    userId: string;
    role: UserRole;
    action: AuditChainBlock["action"];
    missionPlanId: string;
    planVersion?: number;
    details: Record<string, unknown>;
  }): AuditChainBlock {
    const blockHeight = this.chain.length;
    const previousHash = blockHeight === 0 ? AuditChainService.GENESIS_HASH : this.chain[blockHeight - 1].integrityHash;
    const eventId = `evt-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
    const timestamp = new Date().toISOString();
    const planVersion = params.planVersion || 1;

    const payload = [
      previousHash,
      eventId,
      blockHeight,
      timestamp,
      params.userId,
      params.role,
      params.action,
      params.missionPlanId,
      planVersion,
      JSON.stringify(params.details),
    ].join("|");

    const integrityHash = crypto.createHash("sha256").update(payload).digest("hex");

    const block: AuditChainBlock = {
      eventId,
      blockHeight,
      timestamp,
      userId: params.userId,
      role: params.role,
      action: params.action,
      missionPlanId: params.missionPlanId,
      planVersion,
      previousHash,
      integrityHash,
      details: params.details,
    };

    this.chain.push(block);
    this.persistChain();
    return block;
  }

  /**
   * Verifies the cryptographic integrity of the entire audit chain.
   */
  public verifyChain(): AuditVerificationResult {
    const verifiedAt = new Date().toISOString();

    if (this.chain.length === 0) {
      return {
        isValid: true,
        chainLength: 0,
        verifiedAt,
        message: "Audit chain is empty. Genesis state valid.",
      };
    }

    for (let i = 0; i < this.chain.length; i++) {
      const block = this.chain[i];
      const expectedPrev = i === 0 ? AuditChainService.GENESIS_HASH : this.chain[i - 1].integrityHash;

      if (block.previousHash !== expectedPrev) {
        return {
          isValid: false,
          chainLength: this.chain.length,
          verifiedAt,
          tamperDetectedAtBlock: i,
          message: `TAMPER DETECTED: Block #${i} (${block.eventId}) previousHash mismatch. Chain broken.`,
        };
      }

      const payload = [
        expectedPrev,
        block.eventId,
        block.blockHeight,
        block.timestamp,
        block.userId,
        block.role,
        block.action,
        block.missionPlanId,
        block.planVersion,
        JSON.stringify(block.details),
      ].join("|");

      const computedHash = crypto.createHash("sha256").update(payload).digest("hex");
      if (computedHash !== block.integrityHash) {
        return {
          isValid: false,
          chainLength: this.chain.length,
          verifiedAt,
          tamperDetectedAtBlock: i,
          message: `TAMPER DETECTED: Block #${i} (${block.eventId}) content has been altered. Signature mismatch.`,
        };
      }
    }

    return {
      isValid: true,
      chainLength: this.chain.length,
      verifiedAt,
      message: `Audit chain cryptographically verified. All ${this.chain.length} blocks valid and tamper-free.`,
    };
  }

  public getChain(limit = 100): AuditChainBlock[] {
    return this.chain.slice(-limit).reverse();
  }

  /**
   * Mission Plan Lifecycle & Versioning (DRAFT -> ASSESSED -> APPROVED -> LOCKED)
   */
  public registerPlanVersion(plan: {
    planId: string;
    routeId: string;
    status: MissionPlanStatus;
    recommendedProfile: string;
    riskAdjustedScore: number;
    userId: string;
    role: UserRole;
  }): MissionPlanVersion {
    const existing = this.planVersions.get(plan.planId) || [];
    const latest = existing[existing.length - 1];

    if (latest && latest.status === "LOCKED") {
      // Must increment version if locked
      const newVersionNum = latest.version + 1;
      const block = this.appendEvent({
        userId: plan.userId,
        role: plan.role,
        action: "CREATE_ROUTE",
        missionPlanId: plan.planId,
        planVersion: newVersionNum,
        details: { action: "FORK_LOCKED_PLAN", previousVersion: latest.version },
      });

      const newVer: MissionPlanVersion = {
        version: newVersionNum,
        planId: plan.planId,
        status: "DRAFT",
        routeId: plan.routeId,
        recommendedProfile: plan.recommendedProfile,
        riskAdjustedScore: plan.riskAdjustedScore,
        auditHash: block.integrityHash,
        createdAt: new Date().toISOString(),
      };
      existing.push(newVer);
      this.planVersions.set(plan.planId, existing);
      return newVer;
    }

    const versionNum = latest ? latest.version : 1;
    const block = this.appendEvent({
      userId: plan.userId,
      role: plan.role,
      action: plan.status === "APPROVED" ? "APPROVE_PLAN" : plan.status === "LOCKED" ? "LOCK_PLAN" : "ASSESS_MISSION",
      missionPlanId: plan.planId,
      planVersion: versionNum,
      details: { status: plan.status, score: plan.riskAdjustedScore },
    });

    const updatedVer: MissionPlanVersion = {
      version: versionNum,
      planId: plan.planId,
      status: plan.status,
      approvedBy: plan.status === "APPROVED" || plan.status === "LOCKED" ? plan.userId : undefined,
      approvedAt: plan.status === "APPROVED" ? new Date().toISOString() : undefined,
      lockedAt: plan.status === "LOCKED" ? new Date().toISOString() : undefined,
      routeId: plan.routeId,
      recommendedProfile: plan.recommendedProfile,
      riskAdjustedScore: plan.riskAdjustedScore,
      auditHash: block.integrityHash,
      createdAt: latest ? latest.createdAt : new Date().toISOString(),
    };

    if (latest) {
      existing[existing.length - 1] = updatedVer;
    } else {
      existing.push(updatedVer);
    }
    this.planVersions.set(plan.planId, existing);
    return updatedVer;
  }

  public getPlanVersions(planId: string): MissionPlanVersion[] {
    return this.planVersions.get(planId) || [];
  }
}

export const auditChainService = new AuditChainService();
