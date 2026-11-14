import { describe, it, expect, beforeEach } from "vitest";
import { CommandSecurityService } from "../../backend/src/services/security/commandSecurityService.js";
import { AgentRegistry } from "../../backend/src/services/agents/agentRegistry.js";
import { MissionCommandEnvelope } from "../../backend/src/types/index.js";

describe("Phase 5: Server-Side Security, RBAC & Replay Protection", () => {
  beforeEach(() => {
    AgentRegistry.resetAgents();
    CommandSecurityService.resetSecurityState();
  });

  it("should accept valid commands issued by authorized MISSION_COMMAND role", () => {
    const envelope: MissionCommandEnvelope = {
      commandId: "cmd-valid-001",
      agentId: "agent-rover-01",
      command: "PAUSE",
      issuedAt: Date.now(),
      expiresAt: Date.now() + 60000,
      nonce: "nonce-valid-001",
      issuer: "Commander Vance",
      role: "MISSION_COMMAND",
    };

    const user = { userId: "usr-cmdr", role: "MISSION_COMMAND" as const, callsign: "Commander" };
    const res = CommandSecurityService.validateCommandEnvelope(envelope, user);

    expect(res.valid).toBe(true);
  });

  it("should reject commands when caller role lacks permission", () => {
    const envelope: MissionCommandEnvelope = {
      commandId: "cmd-unauth-002",
      agentId: "agent-rover-01",
      command: "PAUSE",
      issuedAt: Date.now(),
      expiresAt: Date.now() + 60000,
      nonce: "nonce-unauth-002",
      issuer: "Public Guest",
      role: "VIEWER",
    };

    const user = { userId: "usr-guest", role: "VIEWER" as const, callsign: "Viewer-01" };
    const res = CommandSecurityService.validateCommandEnvelope(envelope, user);

    expect(res.valid).toBe(false);
    expect(res.code).toBe("FORBIDDEN");
  });

  it("should reject expired commands", () => {
    const envelope: MissionCommandEnvelope = {
      commandId: "cmd-expired-003",
      agentId: "agent-rover-01",
      command: "PAUSE",
      issuedAt: Date.now() - 120000,
      expiresAt: Date.now() - 5000, // Expired 5 seconds ago
      nonce: "nonce-exp-003",
      issuer: "Commander Vance",
      role: "MISSION_COMMAND",
    };

    const user = { userId: "usr-cmdr", role: "MISSION_COMMAND" as const, callsign: "Commander" };
    const res = CommandSecurityService.validateCommandEnvelope(envelope, user);

    expect(res.valid).toBe(false);
    expect(res.code).toBe("COMMAND_EXPIRED");
  });

  it("should reject replayed commands with identical commandId or nonce", () => {
    const envelope: MissionCommandEnvelope = {
      commandId: "cmd-replay-004",
      agentId: "agent-rover-01",
      command: "PAUSE",
      issuedAt: Date.now(),
      expiresAt: Date.now() + 60000,
      nonce: "nonce-unique-004",
      issuer: "Commander Vance",
      role: "MISSION_COMMAND",
    };

    const user = { userId: "usr-cmdr", role: "MISSION_COMMAND" as const, callsign: "Commander" };

    // 1st execution
    const firstRes = CommandSecurityService.validateCommandEnvelope(envelope, user);
    expect(firstRes.valid).toBe(true);

    // 2nd execution (Duplicate commandId)
    const secondRes = CommandSecurityService.validateCommandEnvelope(envelope, user);
    expect(secondRes.valid).toBe(false);
    expect(secondRes.code).toBe("COMMAND_REPLAYED");
  });

  it("should reject resuming an agent that is in EMERGENCY status without reset", () => {
    const scout = AgentRegistry.getAgentById("agent-rover-01")!;
    scout.status = "EMERGENCY";
    AgentRegistry.updateAgent(scout);

    const envelope: MissionCommandEnvelope = {
      commandId: "cmd-bad-transition-005",
      agentId: "agent-rover-01",
      command: "RESUME",
      issuedAt: Date.now(),
      expiresAt: Date.now() + 60000,
      nonce: "nonce-trans-005",
      issuer: "Commander Vance",
      role: "MISSION_COMMAND",
    };

    const user = { userId: "usr-cmdr", role: "MISSION_COMMAND" as const, callsign: "Commander" };
    const res = CommandSecurityService.validateCommandEnvelope(envelope, user);

    expect(res.valid).toBe(false);
    expect(res.code).toBe("INVALID_STATE_TRANSITION");
  });

  it("should persist replay protection state to disk and block replay across simulated backend restart", () => {
    const envelope: MissionCommandEnvelope = {
      commandId: "cmd-restart-test-006",
      agentId: "agent-rover-01",
      command: "PAUSE",
      issuedAt: Date.now(),
      expiresAt: Date.now() + 60000,
      nonce: "nonce-restart-006",
      issuer: "Flight Director",
      role: "MISSION_COMMAND",
    };

    const user = { userId: "usr-cmdr", role: "MISSION_COMMAND" as const, callsign: "Commander" };

    // 1. Initial valid execution
    const firstRes = CommandSecurityService.validateCommandEnvelope(envelope, user);
    expect(firstRes.valid).toBe(true);

    // 2. Simulate backend restart: reset memory caches WITHOUT purging the disk file
    CommandSecurityService.resetSecurityState(false);

    // 3. Attempt re-execution of the identical command
    const replayedRes = CommandSecurityService.validateCommandEnvelope(envelope, user);
    expect(replayedRes.valid).toBe(false);
    expect(["COMMAND_REPLAYED", "NONCE_REPLAYED"]).toContain(replayedRes.code);
  });
});
