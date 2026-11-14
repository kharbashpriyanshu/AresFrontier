import { describe, it, expect } from 'vitest';
import { SafetyInvariantService } from '../../backend/src/services/safety/safetyInvariantService';
import { RoverAgent } from '../../backend/src/services/agents/agentTypes';
import { RouteCandidate, SensorObservation, CommunicationPacket } from '../../backend/src/types/index';

describe('Phase 5 - Planetary Operations Safety Invariants (S1 - S8)', () => {
  const dummyRover: RoverAgent = {
    id: 'ROVER-01',
    name: 'Ares Scout Rover',
    type: 'SCOUT',
    status: 'NOMINAL',
    telemetry: {
      batteryPct: 85,
      currentHeadingDeg: 90,
      currentSpeedMps: 0.15,
      operationalStatus: 'NOMINAL',
      subsystemHealth: { power: 100, mobility: 100, communications: 100, payload: 100, thermal: 100 },
      lastHeartbeatIso: new Date().toISOString(),
    },
    capabilities: ['NAVIGATION', 'HAZARD_DETECTION'],
    assignedZone: 'DELTA_CREST',
  };

  it('enforces S1: Never command a rover below minimum battery reserve (20%)', () => {
    const valid = SafetyInvariantService.verifyS1_BatteryReserve(dummyRover, 28.5);
    expect(valid.passed).toBe(true);
    expect(valid.invariantId).toBe('S1');

    const invalid = SafetyInvariantService.verifyS1_BatteryReserve(dummyRover, 18.0);
    expect(invalid.passed).toBe(false);
    expect(invalid.violationReason).toContain('Battery reserve breach');
  });

  it('enforces S2: Never execute a route classified as unsafe', () => {
    const safeCandidate: RouteCandidate = {
      candidateId: 'safe-01',
      name: 'Safe Traverse',
      waypoints: [],
      distanceM: 500,
      elevationGainM: 10,
      maxSlopeDeg: 8,
      safetyScore: 85,
      energyCostWh: 40,
      estimatedDurationMinutes: 30,
      riskAdjustedScore: 78,
      hazardExposureScore: 12,
    };
    expect(SafetyInvariantService.verifyS2_RouteSafety(safeCandidate).passed).toBe(true);

    const dangerousCandidate: RouteCandidate = {
      ...safeCandidate,
      candidateId: 'danger-01',
      safetyScore: 25,
      riskAdjustedScore: 18,
    };
    const check = SafetyInvariantService.verifyS2_RouteSafety(dangerousCandidate);
    expect(check.passed).toBe(false);
    expect(check.violationReason).toContain('Unsafe route');
  });

  it('enforces S3: Never execute human-only action without MISSION_COMMAND authorization', () => {
    const authorized = SafetyInvariantService.verifyS3_HumanAuthorization('MISSION_COMMAND');
    expect(authorized.passed).toBe(true);

    const unauthorized = SafetyInvariantService.verifyS3_HumanAuthorization('VIEWER');
    expect(unauthorized.passed).toBe(false);
    expect(unauthorized.violationReason).toContain("Current role 'VIEWER' lacks required authority 'MISSION_COMMAND'");
  });

  it('enforces S4: Never discard mission events', () => {
    expect(SafetyInvariantService.verifyS4_NoEventDiscard(15, 12).passed).toBe(true);
    expect(SafetyInvariantService.verifyS4_NoEventDiscard(15, 15).passed).toBe(true);

    const violated = SafetyInvariantService.verifyS4_NoEventDiscard(10, 15);
    expect(violated.passed).toBe(false);
    expect(violated.violationReason).toContain('Event count reduced from 15 to 10');
  });

  it('enforces S5: Never transmit telemetry through a link marked LOST', () => {
    const packet: CommunicationPacket = {
      packetId: 'pkt-001',
      sourceAgentId: 'ROVER-01',
      target: 'EARTH_MCC',
      packetType: 'TELEMETRY',
      payload: {},
      priority: 'CRITICAL',
      timestamp: Date.now(),
      status: 'QUEUED',
    };

    expect(SafetyInvariantService.verifyS5_NoLostLinkTransmission('CONNECTED', packet).passed).toBe(true);
    expect(SafetyInvariantService.verifyS5_NoLostLinkTransmission('DEGRADED', packet).passed).toBe(true);

    const lostCheck = SafetyInvariantService.verifyS5_NoLostLinkTransmission('LOST', packet);
    expect(lostCheck.passed).toBe(false);
    expect(lostCheck.violationReason).toContain('Cannot route packet pkt-001 across LOST communication link');
  });

  it('enforces S6: Never treat simulated observations as LIVE observations', () => {
    const genuineSimulated: SensorObservation = {
      observationId: 'obs-001',
      agentId: 'ROVER-01',
      sensorType: 'LASER_ALTIMETER',
      timestampIso: new Date().toISOString(),
      metSeconds: 1200,
      provenance: {
        dataset: 'MOLA_MEGDR',
        instrument: 'MOLA',
        spatialResolutionM: 10,
        verticalAccuracyM: 1.5,
        uncertaintyEstimate: 0.05,
        citationUrl: 'https://pds-geosciences.wustl.edu',
        lastVerifiedIso: new Date().toISOString(),
        dataMode: 'SIMULATED',
      },
      rawMeasurement: { rangeM: 14.5 },
      processedValue: { elevationM: -2500 },
      confidence: 0.95,
      processingMethod: 'SIMULATED',
    };
    expect(SafetyInvariantService.verifyS6_NoSimulatedAsLive(genuineSimulated).passed).toBe(true);

    // Provocation: simulated processing claiming LIVE provenance
    const fraudulentObservation: SensorObservation = {
      ...genuineSimulated,
      provenance: {
        ...genuineSimulated.provenance,
        dataMode: 'LIVE',
      },
    };
    const s6Check = SafetyInvariantService.verifyS6_NoSimulatedAsLive(fraudulentObservation);
    expect(s6Check.passed).toBe(false);
    expect(s6Check.violationReason).toContain('Provenance fraud');
  });

  it('enforces S7: Never overwrite an existing audit event (chain validation)', () => {
    const s7Check = SafetyInvariantService.verifyS7_NoAuditOverwrite();
    expect(s7Check.passed).toBe(true);
    expect(s7Check.invariantId).toBe('S7');
  });

  it('enforces S8: Never allow stale approval tokens to authorize new mission state', () => {
    const freshTokenAgeMs = 120 * 1000; // 2 minutes (TTL is 300s = 5m)
    expect(SafetyInvariantService.verifyS8_NoStaleTokens(freshTokenAgeMs).passed).toBe(true);

    const staleTokenAgeMs = 350 * 1000; // ~6 minutes
    const s8Check = SafetyInvariantService.verifyS8_NoStaleTokens(staleTokenAgeMs);
    expect(s8Check.passed).toBe(false);
    expect(s8Check.violationReason).toContain('Stale approval token: Token age 350s exceeds TTL 300s');
  });
});
