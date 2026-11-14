import { PlanetaryAgent } from "../agents/agentTypes.js";
import { CommunicationEngine, CommunicationLink } from "./communicationEngine.js";

export interface RelayRoute {
  sourceAgentId: string;
  sourceCallsign: string;
  destination: "MISSION_CONTROL" | "ASTRONAUT_BASE";
  hops: string[];
  totalLatencyMs: number;
  bottleneckBandwidthKbps: number;
  overallReliability: number;
  isViable: boolean;
  recommendation: string;
}

export class RelayPlanner {
  /**
   * Plans the highest-reliability communication relay path for a surface agent.
   */
  public static planRelayRoute(agentId: string, agents: PlanetaryAgent[]): RelayRoute {
    const topology = CommunicationEngine.evaluateNetwork(agents);
    const agent = agents.find((a) => a.id === agentId);
    const callsign = agent ? agent.callsign : agentId;

    if (!agent) {
      return {
        sourceAgentId: agentId,
        sourceCallsign: callsign,
        destination: "MISSION_CONTROL",
        hops: [],
        totalLatencyMs: 999999,
        bottleneckBandwidthKbps: 0,
        overallReliability: 0,
        isViable: false,
        recommendation: "Agent not registered in communication topology",
      };
    }

    // Direct link to orbiter
    const orbiterLink = topology.links.find(
      (l) => l.sourceAgentId === agentId && l.targetCallsign === "ORBITER-01" && l.status === "CONNECTED"
    );

    if (orbiterLink) {
      return {
        sourceAgentId: agentId,
        sourceCallsign: callsign,
        destination: "MISSION_CONTROL",
        hops: [callsign, "ORBITER-01", "MISSION_CONTROL"],
        totalLatencyMs: orbiterLink.estimatedLatencyMs + 840000, // Surface-to-orbiter + 14 min Earth delay
        bottleneckBandwidthKbps: orbiterLink.bandwidthKbps,
        overallReliability: orbiterLink.reliability,
        isViable: true,
        recommendation: "Direct Electra UHF link to MRO-Relay orbiter is active",
      };
    }

    // Two-hop link via ROVER-03 RELAY
    const relayLink = topology.links.find(
      (l) =>
        (l.sourceAgentId === agentId && l.targetCallsign === "ROVER-03 RELAY" && l.status === "CONNECTED") ||
        (l.targetAgentId === agentId && l.sourceCallsign === "ROVER-03 RELAY" && l.status === "CONNECTED")
    );

    if (relayLink) {
      return {
        sourceAgentId: agentId,
        sourceCallsign: callsign,
        destination: "MISSION_CONTROL",
        hops: [callsign, "ROVER-03 RELAY", "ORBITER-01", "MISSION_CONTROL"],
        totalLatencyMs: relayLink.estimatedLatencyMs + 12 + 840000,
        bottleneckBandwidthKbps: Math.min(relayLink.bandwidthKbps, 2048),
        overallReliability: Number((relayLink.reliability * 0.95).toFixed(2)),
        isViable: true,
        recommendation: "Two-hop tactical relay routed through elevated ROVER-03 RELAY mast",
      };
    }

    // Fallback: No viable link
    return {
      sourceAgentId: agentId,
      sourceCallsign: callsign,
      destination: "MISSION_CONTROL",
      hops: [],
      totalLatencyMs: 0,
      bottleneckBandwidthKbps: 0,
      overallReliability: 0.0,
      isViable: false,
      recommendation: "Comms blackout: Relocate agent to higher elevation or deploy mobile relay",
    };
  }
}
