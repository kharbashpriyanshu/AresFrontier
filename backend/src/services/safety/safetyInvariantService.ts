import { RoverAgent } from "../agents/agentTypes.js";
import { RouteCandidate, SensorObservation, CommunicationPacket } from "../../types/index.js";
import { auditChainService } from "../security/auditChainService.js";

export interface InvariantCheckResult {
  passed: boolean;
  invariantId: "S1" | "S2" | "S3" | "S4" | "S5" | "S6" | "S7" | "S8";
  description: string;
  violationReason?: string;
}

export class SafetyInvariantService {
  /**
   * S1: Never command a rover below its minimum battery reserve (20%).
   */
  public static verifyS1_BatteryReserve(rover: RoverAgent, projectedBatteryPercent: number): InvariantCheckResult {
    const passed = projectedBatteryPercent >= 20.0;
    return {
      passed,
      invariantId: "S1",
      description: "Never command a rover below its minimum battery reserve (20%)",
      violationReason: passed
        ? undefined
        : `Battery reserve breach: Projected battery ${projectedBatteryPercent}% is below minimum safe return reserve 20%`,
    };
  }

  /**
   * S2: Never execute a route classified as unsafe.
   */
  public static verifyS2_RouteSafety(candidate: RouteCandidate): InvariantCheckResult {
    const passed = candidate.safetyScore >= 40 && (candidate.riskAdjustedScore ?? 50) >= 30;
    return {
      passed,
      invariantId: "S2",
      description: "Never execute a route classified as unsafe",
      violationReason: passed
        ? undefined
        : `Unsafe route: Safety score ${candidate.safetyScore} < 40 or risk-adjusted score ${candidate.riskAdjustedScore} < 30 exceeds safety envelope`,
    };
  }

  /**
   * S3: Never execute a human-only action without required authorization.
   */
  public static verifyS3_HumanAuthorization(userRole: string, requiredRole: string = "MISSION_COMMAND"): InvariantCheckResult {
    const passed = userRole === requiredRole;
    return {
      passed,
      invariantId: "S3",
      description: "Never execute a human-only action without required authorization",
      violationReason: passed
        ? undefined
        : `Authorization breach: Current role '${userRole}' lacks required authority '${requiredRole}'`,
    };
  }

  /**
   * S4: Never discard mission events.
   */
  public static verifyS4_NoEventDiscard(currentEventCount: number, previousEventCount: number): InvariantCheckResult {
    const passed = currentEventCount >= previousEventCount;
    return {
      passed,
      invariantId: "S4",
      description: "Never discard mission events",
      violationReason: passed
        ? undefined
        : `Event count reduced from ${previousEventCount} to ${currentEventCount}. Potential event loss.`,
    };
  }

  /**
   * S5: Never transmit telemetry through a link marked LOST.
   */
  public static verifyS5_NoLostLinkTransmission(linkStatus: "CONNECTED" | "DEGRADED" | "LOST", packet: CommunicationPacket): InvariantCheckResult {
    const passed = linkStatus !== "LOST";
    return {
      passed,
      invariantId: "S5",
      description: "Never transmit telemetry through a link marked LOST",
      violationReason: passed
        ? undefined
        : `Transmission rejected: Cannot route packet ${packet.packetId} across LOST communication link`,
    };
  }

  /**
   * S6: Never treat simulated observations as LIVE observations.
   */
  public static verifyS6_NoSimulatedAsLive(observation: SensorObservation): InvariantCheckResult {
    const isSimulated = observation.provenance.dataMode === "SIMULATED" || observation.processingMethod === "SIMULATED";
    const claimsLive = observation.provenance.dataMode === "LIVE";
    const passed = !(isSimulated && claimsLive);
    return {
      passed,
      invariantId: "S6",
      description: "Never treat simulated observations as LIVE observations",
      violationReason: passed
        ? undefined
        : `Provenance fraud: Synthetic observation ${observation.observationId} falsely claims LIVE status`,
    };
  }

  /**
   * S7: Never overwrite an existing audit event.
   */
  public static verifyS7_NoAuditOverwrite(): InvariantCheckResult {
    const chainVerification = auditChainService.verifyChain();
    return {
      passed: chainVerification.isValid,
      invariantId: "S7",
      description: "Never overwrite an existing audit event",
      violationReason: chainVerification.isValid ? undefined : `Audit chain broken: ${chainVerification.message}`,
    };
  }

  /**
   * S8: Never allow stale approval tokens to authorize new mission state.
   */
  public static verifyS8_NoStaleTokens(tokenAgeMs: number, maxTtlMs: number = 300000): InvariantCheckResult {
    const passed = tokenAgeMs <= maxTtlMs;
    return {
      passed,
      invariantId: "S8",
      description: "Never allow stale approval tokens to authorize new mission state",
      violationReason: passed ? undefined : `Stale approval token: Token age ${Math.round(tokenAgeMs / 1000)}s exceeds TTL ${maxTtlMs / 1000}s`,
    };
  }
}
