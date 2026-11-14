import { describe, it, expect, beforeEach } from "vitest";
import { auditChainService, AuditChainService } from "../../backend/src/services/security/auditChainService.js";
import { signMissionToken, verifyMissionToken } from "../../backend/src/middleware/securityMiddleware.js";

describe("Cybersecurity Phase 3 — JWT, RBAC & Hash Chain", () => {
  it("generates and verifies cryptographic HMAC-SHA256 JWT tokens", () => {
    const token = signMissionToken({
      userId: "astro-eva-01",
      role: "ASTRONAUT",
      callsign: "Ares-Lead",
    });

    expect(token).toBeDefined();
    expect(token.split(".").length).toBe(3);

    const decoded = verifyMissionToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.userId).toBe("astro-eva-01");
    expect(decoded?.role).toBe("ASTRONAUT");

    // Invalid signature rejection
    const tampered = token.slice(0, -4) + "XXXX";
    expect(verifyMissionToken(tampered)).toBeNull();
  });

  it("appends blocks to persistent hash chain and verifies cryptographic integrity", () => {
    const block1 = auditChainService.appendEvent({
      userId: "commander-smith",
      role: "MISSION_COMMAND",
      action: "CREATE_ROUTE",
      missionPlanId: "plan-test-01",
      details: { route: "Jezero Delta Path" },
    });

    const block2 = auditChainService.appendEvent({
      userId: "science-officer-jones",
      role: "SCIENCE_OFFICER",
      action: "MODIFY_PRIORITIES",
      missionPlanId: "plan-test-01",
      details: { priority: "Clay Stratigraphy" },
    });

    expect(block2.previousHash).toBe(block1.integrityHash);

    const verification = auditChainService.verifyChain();
    expect(verification.isValid).toBe(true);
    expect(verification.chainLength).toBeGreaterThanOrEqual(2);
  });

  it("registers mission plan versioning and enforces locking", () => {
    const planId = `plan-version-test-${Date.now()}`;

    const v1 = auditChainService.registerPlanVersion({
      planId,
      routeId: "route-v1",
      status: "APPROVED",
      recommendedProfile: "balanced",
      riskAdjustedScore: 88,
      userId: "commander-smith",
      role: "MISSION_COMMAND",
    });
    expect(v1.version).toBe(1);
    expect(v1.status).toBe("APPROVED");

    const v1Locked = auditChainService.registerPlanVersion({
      planId,
      routeId: "route-v1",
      status: "LOCKED",
      recommendedProfile: "balanced",
      riskAdjustedScore: 88,
      userId: "commander-smith",
      role: "MISSION_COMMAND",
    });
    expect(v1Locked.version).toBe(1);
    expect(v1Locked.status).toBe("LOCKED");

    // Attempting modification on locked plan forks to v2
    const v2 = auditChainService.registerPlanVersion({
      planId,
      routeId: "route-v2",
      status: "DRAFT",
      recommendedProfile: "safest",
      riskAdjustedScore: 91,
      userId: "commander-smith",
      role: "MISSION_COMMAND",
    });
    expect(v2.version).toBe(2);
    expect(v2.status).toBe("DRAFT");
  });
});
