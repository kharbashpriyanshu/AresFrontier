import { describe, it, expect, beforeEach } from 'vitest';
import { WhatIfSimulationEngine } from '../../backend/src/services/simulation/whatIfSimulationEngine';
import { MonteCarloEngine } from '../../backend/src/services/simulation/monteCarloEngine';
import { FailureInjectionEngine } from '../../backend/src/services/simulation/failureInjectionEngine';
import { AgentRegistry } from '../../backend/src/services/agents/agentRegistry';
import { MissionEventStore } from '../../backend/src/services/persistence/missionEventStore';
import { auditChainService } from '../../backend/src/services/security/auditChainService';

describe('Phase 6 & 7: What-If Simulation, Monte Carlo & Failure Injection', () => {
  beforeEach(() => {
    AgentRegistry.resetAgents();
  });

  it('runs what-if simulation comparing baseline detour vs hazard ignore without mutating live baseline', () => {
    const agentsBefore = JSON.stringify(AgentRegistry.getAllAgents());
    const eventCountBefore = MissionEventStore.getEvents(500).length;
    const auditCountBefore = auditChainService.getChain().length;

    const result = WhatIfSimulationEngine.runWhatIfSimulation({
      baselineMissionId: 'MARSWALK-001',
      decisionOverride: 'IGNORE_HAZARD',
      forkSimTimeMinutes: 18,
      rationale: 'Hypothetical trade-off test ignoring scarp warning to save distance',
    });

    expect(result.simulationId).toBeDefined();
    expect(result.baseline.outcome).toBe('SUCCESS');
    expect(result.alternative.outcome).toBe('DEGRADED');

    // 1. Alternative state is quantitatively different from baseline
    expect(result.alternative.safetyScore).not.toBe(result.baseline.safetyScore);
    expect(result.comparison.distanceDeltaKm).toBeLessThan(0); // 6.9 vs 8.4 = -1.5 km
    expect(result.comparison.safetyDelta).toBeLessThan(-30);    // 51 vs 92 = -41
    expect(result.comparison.hazardsEncountered).toBeGreaterThan(result.baseline.hazardsEncountered);
    expect(result.verdict).toContain('CRITICAL SAFETY FINDING');

    // 2. Baseline in-memory agent state remains completely unmodified
    const agentsAfter = JSON.stringify(AgentRegistry.getAllAgents());
    expect(agentsAfter).toBe(agentsBefore);

    // 3. Operational event store is not polluted with synthetic what-if events
    const eventCountAfter = MissionEventStore.getEvents(500).length;
    expect(eventCountAfter).toBe(eventCountBefore);

    // 4. Operational audit chain is preserved without synthetic block injection
    const auditCountAfter = auditChainService.getChain().length;
    expect(auditCountAfter).toBe(auditCountBefore);
  });

  it('runs reproducible seeded Monte Carlo analysis with bounded statistical distributions', () => {
    const mc1 = MonteCarloEngine.runAnalysis({ runCount: 100, seed: 20261107 });
    const mc2 = MonteCarloEngine.runAnalysis({ runCount: 100, seed: 20261107 });

    // Deterministic reproducibility given identical seed
    expect(mc1.successProbabilityPercent).toBe(mc2.successProbabilityPercent);
    expect(mc1.batteryReserveDistribution.p10).toBe(mc2.batteryReserveDistribution.p10);
    expect(mc1.batteryReserveDistribution.p50).toBe(mc2.batteryReserveDistribution.p50);
    expect(mc1.durationDistributionMinutes.mean).toBe(mc2.durationDistributionMinutes.mean);
    expect(mc1.classification).toBe('SIMULATED / MONTE CARLO');
    expect(mc1.successProbabilityPercent).toBeGreaterThanOrEqual(85.0);
  });

  it('injects sensor failure and triggers automated mitigation response', () => {
    const res = FailureInjectionEngine.injectFailure({
      failureType: 'SENSOR_DEGRADED',
      targetAgentId: 'agent-rover-01',
    });

    expect(res.failureType).toBe('SENSOR_DEGRADED');
    expect(res.updatedState).toBe('PAUSED');
    expect(res.mitigationRecommendation).toContain('MOLA laser altimetry differential');
    expect(res.auditBlockHash).toBeDefined();
  });

  it('injects critical battery drain and enforces emergency stop', () => {
    const res = FailureInjectionEngine.injectFailure({
      failureType: 'BATTERY_DRAIN',
      targetAgentId: 'agent-rover-01',
    });

    expect(res.failureType).toBe('BATTERY_DRAIN');
    expect(res.updatedState).toBe('EMERGENCY');
    expect(res.systemActionTaken).toContain('Safety Invariant S1 triggered');
  });
});
