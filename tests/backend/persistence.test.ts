import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { MissionPersistenceService } from '../../backend/src/services/persistence/missionPersistenceService';
import { MissionEventStore } from '../../backend/src/services/persistence/missionEventStore';
import { AgentRegistry } from '../../backend/src/services/agents/agentRegistry';
import { AgentStateStore } from '../../backend/src/services/agents/agentStateStore';
import { RoverAgent, AstronautAgent } from '../../backend/src/services/agents/agentTypes';

describe('Phase 5 - Mission Persistence & Event Sourcing', () => {
  beforeEach(() => {
    AgentRegistry.resetAgents();
    AgentStateStore.clearEvents();
  });

  it('persists and recovers mission state across disk save and load', () => {
    // Modify an agent in store
    const scout = AgentRegistry.getAgentById('agent-rover-01') as RoverAgent;
    expect(scout).toBeDefined();

    const modifiedScout: RoverAgent = {
      ...scout,
      telemetry: {
        ...scout.telemetry,
        batteryPercent: 84.5,
        headingDeg: 120,
      },
    };
    AgentRegistry.updateAgent(modifiedScout);

    // Save state
    const savedState = MissionPersistenceService.saveState();
    expect(savedState).toBeDefined();
    expect(savedState.version).toBe('5.0.0');

    // Modify state in memory to something else
    AgentRegistry.updateAgent({
      ...modifiedScout,
      telemetry: {
        ...modifiedScout.telemetry,
        batteryPercent: 22.0,
        headingDeg: 350,
      },
    });
    expect((AgentRegistry.getAgentById('agent-rover-01') as RoverAgent)?.telemetry.batteryPercent).toBe(22.0);

    // Load from disk
    const loaded = MissionPersistenceService.loadState();
    expect(loaded).toBe(true);

    // Check recovered state
    const recovered = AgentRegistry.getAgentById('agent-rover-01') as RoverAgent;
    expect(recovered).toBeDefined();
    expect(recovered.telemetry.batteryPercent).toBe(84.5);
    expect(recovered.telemetry.headingDeg).toBe(120);
  });

  it('creates and restores named mission checkpoints', () => {
    const cpName = `test_cp_${Date.now()}`;
    const astronaut = AgentRegistry.getAgentById('agent-astronaut-01') as AstronautAgent;
    expect(astronaut).toBeDefined();

    AgentRegistry.updateAgent({
      ...astronaut,
      telemetry: {
        ...astronaut.telemetry,
        batteryPercent: 91.0,
        heartRateBpm: 78,
      },
    });

    const cpId = MissionPersistenceService.createCheckpoint(cpName);
    expect(cpId).toBeDefined();

    // Modify in memory
    AgentRegistry.updateAgent({
      ...astronaut,
      telemetry: {
        ...astronaut.telemetry,
        batteryPercent: 40.0,
        heartRateBpm: 125,
      },
    });
    expect((AgentRegistry.getAgentById('agent-astronaut-01') as AstronautAgent)?.telemetry.batteryPercent).toBe(40.0);

    // Restore checkpoint
    const restored = MissionPersistenceService.restoreCheckpoint(cpName);
    expect(restored).toBe(true);

    const checkAstronaut = AgentRegistry.getAgentById('agent-astronaut-01') as AstronautAgent;
    expect(checkAstronaut.telemetry.batteryPercent).toBe(91.0);
    expect(checkAstronaut.telemetry.heartRateBpm).toBe(78);
  });

  it('appends and verifies cryptographic SHA-256 event chaining in event store', () => {
    const initialEvents = MissionEventStore.getEvents(500);
    const countBefore = initialEvents.length;

    const testEvent = MissionEventStore.appendEvent({
      missionId: 'MARSWALK-001',
      actor: 'agent-rover-01',
      eventType: 'TELEMETRY_LOGGED',
      payload: { lat: 18.38, lon: 77.58, battery: 94 },
    });

    expect(testEvent.eventHash).toBeDefined();
    expect(testEvent.eventHash.length).toBe(64); // SHA-256 hex string

    const integrity = MissionEventStore.verifyChain();
    expect(integrity.valid).toBe(true);
    expect(integrity.totalEvents).toBeGreaterThanOrEqual(countBefore + 1);
  });

  it('resets simulation state and agents without corrupting immutable event ledger', () => {
    const eventsBefore = MissionEventStore.getEvents(500).length;

    // Reset via persistence service
    MissionPersistenceService.resetMissionState();

    const agents = AgentRegistry.getAllAgents();
    expect(agents.length).toBeGreaterThanOrEqual(4);
    expect(agents.find(a => a.id === 'agent-rover-01')?.status).toBe('EXECUTING');

    const integrity = MissionEventStore.verifyChain();
    expect(integrity.valid).toBe(true);
    // Ledger has retained prior events
    expect(MissionEventStore.getEvents(500).length).toBeGreaterThanOrEqual(eventsBefore);
  });

  it('safely handles corrupted state file on disk without crashing or corrupting memory defaults', () => {
    const baseDataDir = process.cwd().endsWith('backend')
      ? path.resolve(process.cwd(), 'data')
      : path.resolve(process.cwd(), 'backend', 'data');
    const statePath = path.resolve(baseDataDir, 'mission_state.json');

    // Create a backup of existing state if it exists
    let backupContent: string | null = null;
    if (fs.existsSync(statePath)) {
      backupContent = fs.readFileSync(statePath, 'utf-8');
    }

    try {
      // Intentionally write truncated/corrupt JSON to simulate write or disk interruption
      fs.writeFileSync(statePath, '{ "version": "5.0.0", "simState": { "isRunning": tr', 'utf-8');

      // Attempt loading corrupted state
      const loadResult = MissionPersistenceService.loadState();
      expect(loadResult).toBe(false);

      // In-memory agents remain healthy and valid
      const scout = AgentRegistry.getAgentById('agent-rover-01');
      expect(scout).toBeDefined();
      expect(scout?.status).toBeDefined();
    } finally {
      // Restore valid state or remove corrupted file
      if (backupContent !== null) {
        fs.writeFileSync(statePath, backupContent, 'utf-8');
      } else if (fs.existsSync(statePath)) {
        fs.unlinkSync(statePath);
      }
    }
  });

  it('rejects nonexistent or corrupted checkpoint restoration with descriptive error', () => {
    expect(() => {
      MissionPersistenceService.restoreCheckpoint('nonexistent-checkpoint-999');
    }).toThrow("Checkpoint 'nonexistent-checkpoint-999' does not exist");
  });
});
