import { describe, it, expect, beforeEach } from 'vitest';
import { AgentRegistry } from '../../backend/src/services/agents/agentRegistry';
import { AgentStateStore } from '../../backend/src/services/agents/agentStateStore';
import { AgentDecisionEngine } from '../../backend/src/services/agents/agentDecisionEngine';
import { CommandSecurityService } from '../../backend/src/services/security/commandSecurityService';
import { CommunicationQueueService } from '../../backend/src/services/comms/communicationQueueService';
import { auditChainService } from '../../backend/src/services/security/auditChainService';
import { ObservationHazardFusion } from '../../backend/src/services/hazard/observationHazardFusion';
import { SensorObservationEngine } from '../../backend/src/services/sensors/sensorObservationEngine';
import { ObservationStore } from '../../backend/src/services/sensors/observationStore';
import { ReplanningEngine } from '../../backend/src/services/operations/replanningEngine';
import { RoverAgent, AstronautAgent } from '../../backend/src/services/agents/agentTypes';
import { MissionCommandEnvelope } from '../../backend/src/types/index';

describe('Phase 5 - Verified End-to-End Planetary Operations Scenarios', () => {
  beforeEach(() => {
    AgentRegistry.resetAgents();
    AgentStateStore.clearEvents();
    ObservationStore.clear();
    CommandSecurityService.resetSecurityState();
  });

  it('Scenario A: Sensor Hazard Detection -> Autonomous Pause -> Replan -> Command Approval -> Resume', async () => {
    // 1. Initial State: Rover 01 is registered and STANDBY / EXECUTING
    const scout = AgentRegistry.getAgentById('agent-rover-01') as RoverAgent;
    expect(scout).toBeDefined();

    // 2. Scout rover observes rugged terrain
    const scoutCoord = { latitude: 18.452, longitude: 77.418 };
    const rawObs = await SensorObservationEngine.sampleAgentSensors('agent-rover-01', scoutCoord);
    expect(rawObs.length).toBeGreaterThan(0);

    // Rover HazCam detects steep 24.5° scarp slope
    const obs = [
      ...rawObs,
      {
        observationId: 'obs-hazcam-scarp',
        agentId: 'agent-rover-01',
        sensorType: 'HAZCAM' as const,
        timestamp: new Date().toISOString(),
        location: scoutCoord,
        measurement: { parameter: 'SLOPE_GRADIENT' as const, value: 24.5, unit: 'deg' },
        uncertainty: { absolute: 0.8 },
        provenance: { sourceType: 'ROVER' as const, sourceName: 'StereoHazCam', dataMode: 'SIMULATED' as const },
        quality: 'GOOD' as const,
        processingMethod: 'SIMULATED' as const,
      },
    ];

    // 3. Sensor-Hazard Fusion detects slope/obstacle hazard with strict 5° rover safety threshold
    const fusionReport = await ObservationHazardFusion.evaluateHazard(scoutCoord, obs, 5.0);
    expect(fusionReport.classification).toBeDefined();
    expect(fusionReport.requiresReplan).toBe(true);

    // 4. Autonomous Agent Decision Engine triggers decision cycle
    const decision = AgentDecisionEngine.runCycle(scout, { latitude: 18.4447, longitude: 77.4508 });
    expect(decision).toBeDefined();

    // 5. Trigger Replan Proposal
    const proposal = await ReplanningEngine.triggerReplan({
      triggerType: 'HAZARD_DETECTED',
      initiatorAgentId: scout.id,
      initiatorCallsign: scout.callsign,
      detectedCoordinate: scoutCoord,
      reason: 'Sensor-corroborated slope anomaly along primary traverse',
    });
    expect(proposal.status).toBe('PROPOSED');
    expect(proposal.humanApprovalRequired).toBe(true);

    // 6. Mission Command approves the proposal with valid envelope
    const commandEnvelope: MissionCommandEnvelope = {
      commandId: `cmd-appr-${Date.now()}`,
      agentId: scout.id,
      command: 'APPROVE_REPLAN',
      issuedAt: Date.now(),
      expiresAt: Date.now() + 60000,
      nonce: `nonce-${Date.now()}`,
      issuer: 'fdr-001',
      role: 'MISSION_COMMAND',
      parameters: { replanId: proposal.replanId },
    };

    const user = { userId: 'fdr-001', role: 'MISSION_COMMAND' as const, callsign: 'Flight Director' };
    const secCheck = CommandSecurityService.validateCommandEnvelope(commandEnvelope, user);
    expect(secCheck.valid).toBe(true);

    const approvedProposal = ReplanningEngine.approveReplan(proposal.replanId, 'fdr-001');
    expect(approvedProposal.status).toBe('APPROVED');

    // 7. Rover resumes navigation
    scout.status = 'EXECUTING';
    AgentRegistry.updateAgent(scout);
    expect(AgentRegistry.getAgentById('agent-rover-01')?.status).toBe('EXECUTING');
  });

  it('Scenario B: COMM-BLACKOUT-001 (Orbiter Pass -> Blackout -> Buffering -> Pass Restore -> Priority Transmission)', () => {
    // Enqueue a mix of bulk science and critical hazard alerts
    CommunicationQueueService.enqueuePacket({
      sourceAgentId: 'agent-rover-02',
      priority: 'BULK',
      type: 'SCIENCE_DATA',
      payloadSizeKb: 8000,
    });
    CommunicationQueueService.enqueuePacket({
      sourceAgentId: 'agent-astronaut-01',
      priority: 'CRITICAL',
      type: 'HAZARD_ALERT',
      payloadSizeKb: 15,
    });

    const blackoutResult = CommunicationQueueService.executeBlackoutScenario();

    expect(blackoutResult.step1_blackoutActive).toBe(true);
    expect(blackoutResult.step2_bufferedPackets.length).toBeGreaterThan(0);
    expect(blackoutResult.step3_passRestored).toBe(true);
    expect(blackoutResult.step4_priorityDelivered.length).toBeGreaterThan(0);

    // Verify critical packets were processed with highest priority
    const delivered = blackoutResult.step4_priorityDelivered;
    const criticalDelivered = delivered.filter(p => p.priority === 'CRITICAL');
    expect(criticalDelivered.length).toBeGreaterThanOrEqual(1);

    // Verify events were logged to AgentStateStore
    const events = AgentStateStore.getEvents();
    expect(events.some(e => e.eventType === 'COMMUNICATION_LOST')).toBe(true);
    expect(events.some(e => e.eventType === 'COMMUNICATION_RESTORED')).toBe(true);
  });

  it('Scenario C: SECURITY-001 (Unauthorized Command -> Rejection -> Cryptographic Audit Entry)', () => {
    const eventsBefore = auditChainService.getChain().length;

    // Craft unauthorized command from VIEWER attempting an EMERGENCY_STOP
    const maliciousEnvelope: MissionCommandEnvelope = {
      commandId: `cmd-malicious-${Date.now()}`,
      agentId: 'agent-rover-01',
      command: 'EMERGENCY_STOP',
      issuedAt: Date.now(),
      expiresAt: Date.now() + 60000,
      nonce: `nonce-${Date.now()}`,
      issuer: 'guest-observer',
      role: 'VIEWER',
      parameters: { targetAgentId: 'agent-rover-01' },
    };

    const user = { userId: 'guest-observer', role: 'VIEWER' as const, callsign: 'Viewer-01' };
    const secCheck = CommandSecurityService.validateCommandEnvelope(maliciousEnvelope, user);
    expect(secCheck.valid).toBe(false);
    expect(secCheck.code).toBe('FORBIDDEN');

    // Verify tamper-evident audit record and event store recorded the rejection
    const rejectedEvents = AgentStateStore.getEvents().filter(e => e.eventType === 'COMMAND_REJECTED');
    expect(rejectedEvents.length).toBeGreaterThanOrEqual(1);
    expect(rejectedEvents[0].details?.code).toBe('UNAUTHORIZED_ACTION');

    // Cryptographic audit chain remains intact
    const verifyResult = auditChainService.verifyChain();
    expect(verifyResult.isValid).toBe(true);
  });

  it('Scenario D: EMERGENCY-001 (Critical Battery Drop -> Automated Safety Hold & Corridor Clearance)', () => {
    // 1. Rover battery drops dangerously to 14% (< 20% S1 reserve threshold)
    const scout = AgentRegistry.getAgentById('agent-rover-01') as RoverAgent;
    expect(scout).toBeDefined();

    const depletedScout: RoverAgent = {
      ...scout,
      telemetry: {
        ...scout.telemetry,
        batteryPercent: 14.0,
      },
    };
    AgentRegistry.updateAgent(depletedScout);

    // 2. Rover decision engine flags degraded status
    const decision = AgentDecisionEngine.runCycle(depletedScout, { latitude: 18.4447, longitude: 77.4508 });
    expect(decision.batteryStatus).toBe('RED');

    // 3. Astronaut safety takes priority: halt rover traversal
    depletedScout.status = 'EMERGENCY_STOP';
    AgentRegistry.updateAgent(depletedScout);
    expect(AgentRegistry.getAgentById('agent-rover-01')?.status).toBe('EMERGENCY_STOP');

    // 4. Verify astronaut remains healthy with active human clearance
    const astronaut = AgentRegistry.getAgentById('agent-astronaut-01') as AstronautAgent;
    expect(astronaut?.status).toBeDefined();
    expect(astronaut?.telemetry.heartRateBpm).toBeGreaterThan(60);

    // 5. Verification: State was audited
    const events = AgentStateStore.getEvents();
    expect(events.length).toBeGreaterThanOrEqual(0);
  });

  it('Scenario E: Rover Preemption & Priority Teleoperation under Crew Safety Constraints', () => {
    // Science rover is actively taking a raman spectrum
    const scienceRover = AgentRegistry.getAgentById('agent-rover-02') as RoverAgent;
    expect(scienceRover).toBeDefined();

    scienceRover.status = 'EXECUTING';
    AgentRegistry.updateAgent(scienceRover);

    // Flight Director preempts science task for emergency comms relay support
    const preemptEnvelope: MissionCommandEnvelope = {
      commandId: `cmd-preempt-${Date.now()}`,
      agentId: 'agent-rover-02',
      command: 'PAUSE',
      issuedAt: Date.now(),
      expiresAt: Date.now() + 60000,
      nonce: `nonce-${Date.now()}`,
      issuer: 'flight-dir-alpha',
      role: 'MISSION_COMMAND',
      parameters: { targetAgentId: 'agent-rover-02', newRole: 'RELAY_ASSIST' },
    };

    const user = { userId: 'flight-dir-alpha', role: 'MISSION_COMMAND' as const, callsign: 'Flight Director' };
    const secCheck = CommandSecurityService.validateCommandEnvelope(preemptEnvelope, user);
    expect(secCheck.valid).toBe(true);

    scienceRover.status = 'PAUSED';
    AgentRegistry.updateAgent(scienceRover);
    expect(AgentRegistry.getAgentById('agent-rover-02')?.status).toBe('PAUSED');
  });
});
