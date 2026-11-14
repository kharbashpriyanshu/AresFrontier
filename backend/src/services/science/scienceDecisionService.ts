import fs from "fs";
import path from "path";
import crypto from "crypto";
import { CANONICAL_BACKEND_DATA_DIR } from "../../utils/dataDir.js";
import { missionRepository } from "../../repositories/missionRepository.js";
import { NASA_DATA_SOURCES_CATALOG, VERIFIED_NASA_SCIENCE_TARGETS } from "../nasa/adapters/benchmarkData.js";
import { nasaDatasetIngestionService } from "../nasa/nasaDatasetIngestionService.js";
import { MissionEventStore } from "../persistence/missionEventStore.js";
import { auditChainService } from "../security/auditChainService.js";
import { ProvenanceService } from "../planetary/provenanceService.js";
import { DataSourceInfo, ScienceObjectiveId } from "../../types/index.js";

export interface ScienceDecisionRecord {
  id: string;
  targetId: string;
  targetName: string;
  region?: string;
  missionId: string;
  objectiveId?: ScienceObjectiveId;
  rationale: string;
  actor: string;
  provenanceClassification: "MEASURED" | "DERIVED" | "PREDICTED" | "SIMULATED" | "BENCHMARK" | "SYNTHETIC";
  evidenceStatus?: string;
  dataSource: string;
  createdAt: string;
  auditBlockHash: string;
  eventId: string;
}

export interface ProvenanceExplorerFilter {
  source?: string;
  classification?: string;
  mission?: string;
  product?: string;
  stage?: string;
  validationStatus?: string;
  search?: string;
}

export class ScienceDecisionService {
  private filePath: string;
  private decisions: ScienceDecisionRecord[] = [];

  constructor() {
    this.filePath = path.resolve(CANONICAL_BACKEND_DATA_DIR, "science-decisions.json");
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, "utf-8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.decisions = parsed;
        }
      }
    } catch {
      this.decisions = [];
    }
  }

  private save(): void {
    try {
      if (!fs.existsSync(CANONICAL_BACKEND_DATA_DIR)) {
        fs.mkdirSync(CANONICAL_BACKEND_DATA_DIR, { recursive: true });
      }
      const tmp = `${this.filePath}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.decisions, null, 2), "utf-8");
      fs.renameSync(tmp, this.filePath);
    } catch (err) {
      console.warn("[ScienceDecisionService] Failed to persist science decisions:", err);
    }
  }

  public getDecisions(missionId?: string): ScienceDecisionRecord[] {
    if (!missionId) {
      return [...this.decisions].reverse();
    }
    return this.decisions.filter((d) => d.missionId === missionId).reverse();
  }

  public assignTargetToMission(params: {
    targetId: string;
    missionId: string;
    rationale?: string;
    actor?: string;
    objectiveId?: ScienceObjectiveId;
  }):
    | { ok: true; decision: ScienceDecisionRecord }
    | { ok: false; status: number; code: string; message: string } {
    const target = VERIFIED_NASA_SCIENCE_TARGETS.find((t) => t.id === params.targetId);
    if (!target) {
      return {
        ok: false,
        status: 404,
        code: "TARGET_NOT_FOUND",
        message: `Science target '${params.targetId}' was not found in catalog.`,
      };
    }

    const mission = missionRepository.getMissionByIdSync(params.missionId);
    if (mission && (mission.status === "APPROVED" || mission.status === "LOCKED")) {
      return {
        ok: false,
        status: 409,
        code: "APPROVED_MISSION_PROTECTED",
        message: `Mission '${params.missionId}' has status '${mission.status}' and cannot be silently mutated by scientific target assignments. Create a draft revision instead.`,
      };
    }

    const actor = params.actor?.trim() || "SCIENCE_LEAD";
    const rationale =
      params.rationale?.trim() ||
      `Selected ${target.name} (${target.category}) for mission ${params.missionId} investigation.`;
    const createdAt = new Date().toISOString();
    const id = `scidec-${crypto.randomBytes(4).toString("hex")}`;

    const auditBlock = auditChainService.appendEvent({
      userId: actor,
      role: "SCIENCE_OFFICER",
      action: "MODIFY_PRIORITIES",
      missionPlanId: params.missionId,
      details: {
        subAction: "SCIENCE_TARGET_ASSIGNED",
        decisionId: id,
        targetId: target.id,
        targetName: target.name,
        missionId: params.missionId,
        objectiveId: params.objectiveId || null,
        evidenceStatus: target.evidenceStatus || "unknown",
        rationale,
      },
    });

    const event = MissionEventStore.appendEvent({
      missionId: params.missionId,
      actor,
      entityId: target.id,
      auditRef: auditBlock.integrityHash,
      eventType: "MISSION_UPDATED",
      payload: {
        action: "SCIENCE_TARGET_ASSIGNED",
        decisionId: id,
        targetId: target.id,
        targetName: target.name,
        region: target.region || "Mars",
        objectiveId: params.objectiveId,
        rationale,
      },
      provenance: ProvenanceService.createDerivedProvenance(
        `Science Target Assignment: ${target.name}`,
        [target.dataSource],
        "Human-approved scientific target association with mission planning workspace"
      ),
    });

    const record: ScienceDecisionRecord = {
      id,
      targetId: target.id,
      targetName: target.name,
      region: target.region,
      missionId: params.missionId,
      objectiveId: params.objectiveId,
      rationale,
      actor,
      provenanceClassification: target.provenanceClassification || "BENCHMARK",
      evidenceStatus: target.evidenceStatus,
      dataSource: target.dataSource,
      createdAt,
      auditBlockHash: auditBlock.integrityHash,
      eventId: event.eventId,
    };

    this.decisions.push(record);
    this.save();

    return { ok: true, decision: record };
  }

  public getProvenanceExplorer(filters: ProvenanceExplorerFilter) {
    const normalize = (v?: string) => (v || "").trim().toLowerCase();
    const qSource = normalize(filters.source);
    const qClass = normalize(filters.classification);
    const qMission = normalize(filters.mission);
    const qProduct = normalize(filters.product);
    const qStage = normalize(filters.stage);
    const qStatus = normalize(filters.validationStatus);
    const qSearch = normalize(filters.search);

    const datasets: DataSourceInfo[] = NASA_DATA_SOURCES_CATALOG.filter((ds) => {
      if (qSource && !ds.id.toLowerCase().includes(qSource) && !ds.name.toLowerCase().includes(qSource)) {
        return false;
      }
      if (qClass && (ds.classification || "").toLowerCase() !== qClass) {
        return false;
      }
      if (qMission && !ds.mission.toLowerCase().includes(qMission)) {
        return false;
      }
      if (qProduct && !(ds.product || "").toLowerCase().includes(qProduct)) {
        return false;
      }
      if (qStage && !(ds.processingStage || "").toLowerCase().includes(qStage)) {
        return false;
      }
      if (qStatus && (ds.validationStatus || "").toLowerCase() !== qStatus) {
        return false;
      }
      if (qSearch) {
        const haystack = [
          ds.id,
          ds.name,
          ds.mission,
          ds.product,
          ds.processingStage,
          ds.pipelineName,
          ds.modelVersion,
          ds.attribution,
          ds.limitations,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(qSearch)) return false;
      }
      return true;
    });

    const linkedDecisions = this.getDecisions().filter((d) => {
      if (qMission && !d.missionId.toLowerCase().includes(qMission)) return false;
      if (qClass && d.provenanceClassification.toLowerCase() !== qClass) return false;
      if (qSearch) {
        const hay = `${d.targetName} ${d.missionId} ${d.rationale} ${d.dataSource}`.toLowerCase();
        if (!hay.includes(qSearch)) return false;
      }
      return true;
    });

    const auditVerification = auditChainService.verifyChain();
    const auditChain = auditChainService.getChain(20);
    const recentEvents = MissionEventStore.getEvents(20).filter((e) => {
      if (qMission && !e.missionId.toLowerCase().includes(qMission)) return false;
      return true;
    });

    const ingestedDatasets = nasaDatasetIngestionService.getIngestedDatasets().map((d) => ({
      id: d.id,
      name: d.name,
      mission: d.mission,
      product: d.product,
      recordKind: d.recordKind,
      ingestionStatus: d.ingestionStatus,
      validationStatus: d.validationStatus,
      classification: d.classification,
      retrievedAt: d.retrievedAt,
      checksumSha256: d.checksumSha256,
      byteSize: d.byteSize,
      coordinateSystem: d.coordinateSystem,
      featureCount: d.featureCount,
      boundingBox: d.boundingBox,
      summary: d.summary,
      url: d.url,
      attribution: d.attribution,
      limitations: d.limitations,
    }));

    return {
      datasets,
      ingestedDatasets,
      totalDatasets: NASA_DATA_SOURCES_CATALOG.length,
      linkedDecisions,
      auditVerification: {
        valid: auditVerification.isValid,
        totalBlocks: auditVerification.chainLength,
        tamperDetectedAtBlock: auditVerification.tamperDetectedAtBlock,
        latestHash: auditChain[auditChain.length - 1]?.integrityHash || null,
        message: auditVerification.message,
      },
      recentAuditBlocks: auditChain.slice(-10).reverse(),
      recentEvents: recentEvents.slice(0, 10),
      pipelines: Array.from(
        new Set(NASA_DATA_SOURCES_CATALOG.map((d) => `${d.pipelineName || d.id} (${d.modelVersion || "v1"})`))
      ),
    };
  }

  /**
   * Removes science decisions belonging strictly to the given mission IDs (e.g., isolated demo reset).
   */
  public deleteDecisionsForMissions(missionIds: string[]): number {
    const idSet = new Set(missionIds);
    const before = this.decisions.length;
    this.decisions = this.decisions.filter((d) => !idSet.has(d.missionId));
    const removed = before - this.decisions.length;
    if (removed > 0) {
      this.save();
    }
    return removed;
  }
}

export const scienceDecisionService = new ScienceDecisionService();
