import crypto from "crypto";

/**
 * Deterministic ID Generator for Planetary Simulation & Digital Twin Replay.
 * Replaces non-deterministic Date.now() + Math.random() for reproducible simulation runs.
 */
export class DeterministicIdGenerator {
  private static sequenceCounters: Map<string, number> = new Map();

  /**
   * Generates a deterministic hex or slug ID based on simulation parameters.
   */
  public static generateId(params: {
    prefix: string;
    missionId: string;
    simulationSeed?: string;
    simulationTimeSeconds?: number;
    agentId?: string;
    entityType?: string;
    sequenceNumber?: number;
  }): string {
    const seed = params.simulationSeed || "MARSWALK-SEED-2026";
    const simTime = params.simulationTimeSeconds !== undefined ? Math.round(params.simulationTimeSeconds) : 0;
    const agent = params.agentId || "GLOBAL";
    const type = params.entityType || "GEN";

    const seqKey = `${params.missionId}:${type}:${agent}`;
    let seq = params.sequenceNumber;
    if (seq === undefined) {
      seq = (this.sequenceCounters.get(seqKey) || 0) + 1;
      this.sequenceCounters.set(seqKey, seq);
    }

    const payload = `${seed}|${params.missionId}|${simTime}|${agent}|${type}|${seq}`;
    const hash = crypto.createHash("sha256").update(payload).digest("hex").substring(0, 8);

    return `${params.prefix}-${params.missionId.toLowerCase()}-${type.toLowerCase()}-${seq}-${hash}`;
  }

  /**
   * Resets internal sequence counters (used during simulation reset or test runs).
   */
  public static reset(): void {
    this.sequenceCounters.clear();
  }
}
