import { AgentRegistry } from "../agents/agentRegistry.js";
import { AgentStateStore } from "../agents/agentStateStore.js";
import { ProvenanceService } from "../planetary/provenanceService.js";
import { ScienceObjectiveId } from "../../types/index.js";

export type ScienceQueueStatus = "QUEUED" | "ASSIGNED" | "EN_ROUTE" | "OBSERVING" | "COMPLETED";

export interface ScienceQueueItem {
  id: string;
  targetName: string;
  coordinate: import("../../types/index.js").MarsCoordinate;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  scienceObjective: ScienceObjectiveId;
  recommendedAgentCallsign: string;
  supportingAgentCallsign?: string;
  requiredInstrument: string;
  status: ScienceQueueStatus;
  supportingEvidence: string[];
  assignedAt?: string;
  completedAt?: string;
  sampleReturnPayloadId?: string;
  provenance: import("../../types/index.js").DataProvenance;
}

export class MultiAgentCoordinator {
  private static scienceQueue: ScienceQueueItem[] = [
    {
      id: "sci-queue-01",
      targetName: "Jezero Delta Front Sedimentary Scarp",
      coordinate: { latitude: 18.4485, longitude: 77.402 },
      priority: "CRITICAL",
      scienceObjective: "ANCIENT_WATER_ACTIVITY",
      recommendedAgentCallsign: "ROVER-02 SCIENCE",
      supportingAgentCallsign: "ASTRONAUT-01",
      requiredInstrument: "Deep UV Raman + Abrasion Core Drill",
      status: "ASSIGNED",
      supportingEvidence: [
        "MGS MOLA MEGDR Lacustrine Deltaic Bottomset Altimetry",
        "MRO HiRISE Stereo DTM 0.25m/px Cross-Bedding Layers",
        "2001 Mars Odyssey THEMIS Daytime Thermal Regolith Bedrock",
        "Mars 2020 Perseverance SuperCam In-Situ Spectroscopy",
      ],
      assignedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      provenance: ProvenanceService.createRoverProvenance("Mars 2020 (Perseverance)", "SUPERCAM-PIXL", 100),
    },
    {
      id: "sci-queue-02",
      targetName: "Kodiak Butte Isolated Delta Remnant",
      coordinate: { latitude: 18.425, longitude: 77.415 },
      priority: "HIGH",
      scienceObjective: "SEDIMENTARY_HISTORY",
      recommendedAgentCallsign: "ROVER-01 SCOUT",
      supportingAgentCallsign: "ROVER-02 SCIENCE",
      requiredInstrument: "High-Resolution Laser Profiler + Hazcam",
      status: "EN_ROUTE",
      supportingEvidence: [
        "MRO HiRISE Sub-Meter Foreset Dip Strata",
        "MGS MOLA Regional Elevation Differential (-2540m areoid)",
      ],
      assignedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      provenance: ProvenanceService.createHiriseProvenance("PSP_001415_1985"),
    },
    {
      id: "sci-queue-03",
      targetName: "South Séítah Olivine Cumulate Ridge",
      coordinate: { latitude: 18.432, longitude: 77.448 },
      priority: "MEDIUM",
      scienceObjective: "MINERALOGICAL_DIVERSITY",
      recommendedAgentCallsign: "ROVER-02 SCIENCE",
      requiredInstrument: "X-Ray Fluorescence Spectrometer (PIXL)",
      status: "QUEUED",
      supportingEvidence: [
        "CRISM Spectral Band Absorption at 1.0 & 2.0 Microns",
        "Mars 2020 Abraded Patch In-Situ Ground Truth",
      ],
      provenance: ProvenanceService.createRoverProvenance("Mars 2020 (Perseverance)", "PIXL-ABRASION", 124),
    },
  ];

  public static getScienceQueue(): ScienceQueueItem[] {
    return this.scienceQueue;
  }

  public static updateQueueItemStatus(
    id: string,
    status: ScienceQueueStatus,
    agentCallsign?: string
  ): ScienceQueueItem {
    const item = this.scienceQueue.find((q) => q.id === id);
    if (!item) {
      throw new Error(`Science queue item ${id} not found`);
    }

    item.status = status;
    if (agentCallsign) {
      item.recommendedAgentCallsign = agentCallsign;
    }
    if (status === "COMPLETED") {
      item.completedAt = new Date().toISOString();
      item.sampleReturnPayloadId = `SAMPLE-${Date.now().toString().slice(-4)}`;
    }

    AgentStateStore.recordEvent({
      agentId: item.recommendedAgentCallsign,
      eventType: status === "COMPLETED" ? "SCIENCE_OBSERVATION_RECORDED" : "TASK_ASSIGNED",
      severity: "INFO",
      message: `Science Queue: ${item.targetName} transitioned to ${status} (${item.recommendedAgentCallsign})`,
      details: { queueId: item.id, status, objective: item.scienceObjective },
    });

    return item;
  }
}
