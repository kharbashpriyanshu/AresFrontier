import { PlanetaryAgent } from "../agents/agentTypes.js";
import { LineOfSightEngine } from "./lineOfSightEngine.js";
import { calculateMarsDistanceKm } from "../../utils/marsCoordinates.js";
import { OrbitalVisibilityEngine } from "./orbitalVisibilityEngine.js";
import { OrbitalVisibilityWindow } from "../../types/index.js";

export interface CommunicationLink {
  sourceAgentId: string;
  sourceCallsign: string;
  targetAgentId: string;
  targetCallsign: string;
  linkType: "DIRECT" | "ROVER_RELAY" | "ORBITER_RELAY" | "EARTH_DEEP_SPACE";
  distanceKm: number;
  lineOfSight: boolean;
  estimatedLatencyMs: number;
  bandwidthKbps: number;
  reliability: number; // 0.0 - 1.0
  status: "CONNECTED" | "DEGRADED" | "LOST";
  notes?: string;
}

export interface NetworkTopology {
  timestamp: string;
  links: CommunicationLink[];
  missionControlReachable: boolean;
  activeRelayCount: number;
  unconnectedAgents: string[];
  orbitalVisibility?: OrbitalVisibilityWindow;
}

export class CommunicationEngine {
  /**
   * Evaluates active communication links across all registered planetary agents.
   * Orbital pass links are dynamically computed based on simulation time and geometry.
   */
  public static evaluateNetwork(agents: PlanetaryAgent[], simTimeMinutes: number = 48): NetworkTopology {
    const links: CommunicationLink[] = [];
    const unconnectedAgents: string[] = [];

    // Find key relay agents
    const relayRover = agents.find((a) => a.id === "agent-rover-03");
    const orbiter = agents.find((a) => a.type === "ORBITER");
    const astronaut = agents.find((a) => a.type === "ASTRONAUT");

    // 1. Direct surface links between rovers and astronaut
    for (let i = 0; i < agents.length; i++) {
      const a = agents[i];
      if (a.type === "ORBITER") continue;

      for (let j = i + 1; j < agents.length; j++) {
        const b = agents[j];
        if (b.type === "ORBITER") continue;

        const aIsRelay = a.id === "agent-rover-03";
        const bIsRelay = b.id === "agent-rover-03";
        const aMast = aIsRelay ? 5.0 : 2.0;
        const bMast = bIsRelay ? 5.0 : 2.0;
        const maxRangeKm = aIsRelay || bIsRelay ? 12.0 : 4.5;

        const distanceKm = calculateMarsDistanceKm(a.position, b.position);
        const los = LineOfSightEngine.calculateLineOfSight(a.position, b.position, aMast, bMast);

        let status: "CONNECTED" | "DEGRADED" | "LOST" = "CONNECTED";
        let bandwidth = 128; // kbps
        let reliability = 0.95;

        if (!los.lineOfSight) {
          status = "LOST";
          bandwidth = 0;
          reliability = 0.0;
        } else if (distanceKm > maxRangeKm) {
          status = "DEGRADED";
          bandwidth = 32;
          reliability = 0.65;
        }

        links.push({
          sourceAgentId: a.id,
          sourceCallsign: a.callsign,
          targetAgentId: b.id,
          targetCallsign: b.callsign,
          linkType: a.id === "agent-rover-03" || b.id === "agent-rover-03" ? "ROVER_RELAY" : "DIRECT",
          distanceKm: Number(distanceKm.toFixed(2)),
          lineOfSight: los.lineOfSight,
          estimatedLatencyMs: Math.round(distanceKm * 0.0033 + 5), // Speed of light in vacuum + packetization
          bandwidthKbps: bandwidth,
          reliability: Number(reliability.toFixed(2)),
          status,
          notes: los.status,
        });
      }
    }

    // 2. Orbiter relay links (dynamically calculated from OrbitalVisibilityEngine)
    let jezeroOrbitalVis: OrbitalVisibilityWindow | undefined = undefined;

    if (orbiter) {
      agents.forEach((agent) => {
        if (agent.type === "ORBITER") return;

        const vis = OrbitalVisibilityEngine.calculateVisibility(agent.position, simTimeMinutes);
        if (!jezeroOrbitalVis) jezeroOrbitalVis = vis;

        const isPassActive = vis.state === "PASS_ACTIVE" || vis.state === "PASS_ENDING";
        let linkStatus: "CONNECTED" | "DEGRADED" | "LOST" = "LOST";

        if (isPassActive) {
          linkStatus = vis.visibilityQuality === "EXCELLENT" || vis.visibilityQuality === "GOOD" ? "CONNECTED" : "DEGRADED";
        }

        links.push({
          sourceAgentId: agent.id,
          sourceCallsign: agent.callsign,
          targetAgentId: orbiter.id,
          targetCallsign: orbiter.callsign,
          linkType: "ORBITER_RELAY",
          distanceKm: vis.slantRangeKm,
          lineOfSight: isPassActive,
          estimatedLatencyMs: 12,
          bandwidthKbps: vis.bandwidthKbps,
          reliability: isPassActive ? 0.98 : 0.0,
          status: linkStatus,
          notes: `Electra UHF Proximity Link (Elev ${vis.currentElevationDeg}°, state ${vis.state})`,
        });
      });
    }

    // Check connectivity for each agent
    agents.forEach((agent) => {
      const activeLink = links.find(
        (l) => (l.sourceAgentId === agent.id || l.targetAgentId === agent.id) && l.status === "CONNECTED"
      );
      if (!activeLink) {
        unconnectedAgents.push(agent.callsign);
      }
    });

    const missionControlReachable = links.some(
      (l) => l.targetCallsign === "ORBITER-01" && l.status === "CONNECTED"
    );

    return {
      timestamp: new Date().toISOString(),
      links,
      missionControlReachable,
      activeRelayCount: relayRover ? 1 : 0,
      unconnectedAgents,
      orbitalVisibility: jezeroOrbitalVis,
    };
  }
}
