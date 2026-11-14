import { describe, it, expect, beforeEach } from 'vitest';
import { MissionValidationEngine } from '../../backend/src/services/validation/missionValidationEngine';
import { CommandSecurityService } from '../../backend/src/services/security/commandSecurityService';
import { DecisionLineageService } from '../../backend/src/services/intelligence/decisionLineageService';
import { MissionAnalyticsService } from '../../backend/src/services/intelligence/missionAnalyticsService';
import { AgentRegistry } from '../../backend/src/services/agents/agentRegistry';
import { MissionCommandEnvelope } from '../../backend/src/types/index';

describe('Phase 6: Safety Validation, Persistent Replay Defense & Decision Lineage', () => {
  beforeEach(() => {
    AgentRegistry.resetAgents();
    CommandSecurityService.resetSecurityState(true);
  });

  it('validates mission against S1-S8 and computes transparent health score', () => {
    const val = MissionValidationEngine.validateMission('MARSWALK-001');

    expect(val.overallStatus).toBe('VALID');
    expect(val.failedInvariantsCount).toBe(0);
    expect(val.invariants.length).toBe(8);

    // Verify all S1-S8 invariants pass
    expect(val.invariants.every((i) => i.status === 'PASS')).toBe(true);

    // Verify transparent health score components
    expect(val.health.safetyScore).toBeGreaterThanOrEqual(90);
    expect(val.health.batteryMarginScore).toBeGreaterThanOrEqual(70);
    expect(val.health.communicationReliabilityScore).toBeGreaterThanOrEqual(80);
    expect(val.health.overallScore).toBeGreaterThanOrEqual(80);
    expect(val.health.verdict).toMatch(/OPTIMAL|NOMINAL/);
  });

  it('rejects commands with TTL exceeding 300 seconds (Invariant S8 Hardening)', () => {
    const now = Date.now();
    const excessiveTtlEnvelope: MissionCommandEnvelope = {
      commandId: 'cmd-excessive-ttl-01',
      agentId: 'agent-rover-01',
      command: 'PAUSE',
      issuedAt: now,
      expiresAt: now + 3600000, // 1 hour (exceeds 300s limit)
      nonce: 'nonce-ttl-01',
      issuer: 'Commander Vance',
      role: 'MISSION_COMMAND',
    };

    const user = { userId: 'cmdr-01', role: 'MISSION_COMMAND' as const, callsign: 'Commander' };
    const res = CommandSecurityService.validateCommandEnvelope(excessiveTtlEnvelope, user);

    expect(res.valid).toBe(false);
    expect(res.code).toBe('TTL_EXCEEDED');
    expect(res.reason).toContain('exceeds maximum allowed 300 seconds');
  });

  it('rejects stale commands issued in the past beyond the freshness window', () => {
    const now = Date.now();
    const staleEnvelope: MissionCommandEnvelope = {
      commandId: 'cmd-stale-01',
      agentId: 'agent-rover-01',
      command: 'PAUSE',
      issuedAt: now - 350000, // ~6 minutes ago (> 300s limit)
      expiresAt: now - 320000, // 30s TTL (within 300s envelope limit), but issued 350s ago
      nonce: 'nonce-stale-01',
      issuer: 'Commander Vance',
      role: 'MISSION_COMMAND',
    };

    const user = { userId: 'cmdr-01', role: 'MISSION_COMMAND' as const, callsign: 'Commander' };
    const res = CommandSecurityService.validateCommandEnvelope(staleEnvelope, user);

    expect(res.valid).toBe(false);
    expect(res.code).toBe('COMMAND_STALE');
  });

  it('blocks command replay even after memory reset if persisted on disk', () => {
    const now = Date.now();
    const envelope: MissionCommandEnvelope = {
      commandId: 'cmd-persist-replay-01',
      agentId: 'agent-rover-01',
      command: 'PAUSE',
      issuedAt: now,
      expiresAt: now + 60000,
      nonce: 'nonce-persist-01',
      issuer: 'Commander Vance',
      role: 'MISSION_COMMAND',
    };

    const user = { userId: 'cmdr-01', role: 'MISSION_COMMAND' as const, callsign: 'Commander' };

    // 1st execution: allowed and persisted to disk
    const res1 = CommandSecurityService.validateCommandEnvelope(envelope, user);
    expect(res1.valid).toBe(true);

    // Simulate backend restart by resetting in-memory state WITHOUT purging disk (purgeDisk = false)
    CommandSecurityService.resetSecurityState(false);

    // 2nd execution after restart: must be rejected from persistent disk ledger!
    const res2 = CommandSecurityService.validateCommandEnvelope(envelope, user);
    expect(res2.valid).toBe(false);
    expect(res2.code).toBe('COMMAND_REPLAYED');
  });

  it('generates complete step-by-step decision lineage graph for judging explainability', () => {
    const lineage = DecisionLineageService.getDecisionLineage('evt-detour-01');

    expect(lineage.nodes.length).toBeGreaterThanOrEqual(6);
    expect(lineage.nodes[0].stage).toBe('SENSOR_OBSERVATION');
    expect(lineage.nodes[1].stage).toBe('HAZARD_CLASSIFICATION');
    expect(lineage.nodes[2].stage).toBe('SAFETY_INVARIANT_GATE');
    expect(lineage.nodes[3].stage).toBe('ROUTE_CANDIDATE_SYNTHESIS');
    expect(lineage.nodes[5].stage).toBe('HUMAN_COMMAND_APPROVAL');
    expect(lineage.summaryConclusion).toContain('supported by physical sensor evidence');
  });

  it('aggregates comprehensive mission analytics across operations, comms, science and safety', () => {
    const analytics = MissionAnalyticsService.getAnalytics('MARSWALK-001');

    expect(analytics.operations.totalDistanceTraversedKm).toBeGreaterThan(0);
    expect(analytics.communication.packetsTransmittedCount).toBeGreaterThan(0);
    expect(analytics.science.cumulativeScienceYield).toBeGreaterThan(80);
    expect(analytics.safety.auditIntegrityStatus).toBe('100% VERIFIED');
  });
});
