import { describe, it, expect, beforeEach } from 'vitest';
import { MissionReplayEngine } from '../../backend/src/services/replay/missionReplayEngine';
import { AgentRegistry } from '../../backend/src/services/agents/agentRegistry';

describe('Phase 6: Digital Twin & Deterministic Mission Replay Engine', () => {
  beforeEach(() => {
    AgentRegistry.resetAgents();
    MissionReplayEngine.resetReplay();
  });

  it('initializes and steps deterministic replay forward and backward without mutating live stores', () => {
    const liveScoutBefore = AgentRegistry.getAgentById('agent-rover-01');
    const liveBatteryBefore = liveScoutBefore?.telemetry.batteryPercent;

    // Start replay
    const state0 = MissionReplayEngine.startReplay('MARSWALK-001');
    expect(state0.status).toBe('PLAYING');
    expect(state0.totalEvents).toBeGreaterThanOrEqual(5);

    // Step forward
    const state1 = MissionReplayEngine.stepReplay('FORWARD');
    expect(state1.currentEventIndex).toBe(1);
    expect(state1.currentEvent).toBeDefined();

    // Step forward to step 4 (Hazard & Pause)
    MissionReplayEngine.stepReplay('FORWARD');
    MissionReplayEngine.stepReplay('FORWARD');
    const state4 = MissionReplayEngine.stepReplay('FORWARD');
    expect(state4.currentEventIndex).toBe(4);

    // Step backward
    const stateBack = MissionReplayEngine.stepReplay('BACKWARD');
    expect(stateBack.currentEventIndex).toBe(3);

    // Live agent store in AgentRegistry remains completely unmutated
    const liveScoutAfter = AgentRegistry.getAgentById('agent-rover-01');
    expect(liveScoutAfter?.telemetry.batteryPercent).toBe(liveBatteryBefore);
  });

  it('seeks to specific simulation times and rebuilds world state deterministically', () => {
    MissionReplayEngine.startReplay('MARSWALK-001');

    // Seek to 600s (10 min mark)
    const state = MissionReplayEngine.seekReplay(600);
    expect(state.currentSimTimeSeconds).toBeGreaterThanOrEqual(480);
    expect(state.agents.length).toBeGreaterThanOrEqual(4);

    // Seek back to genesis (0)
    const stateGenesis = MissionReplayEngine.seekReplay(0);
    expect(stateGenesis.currentEventIndex).toBe(0);
  });

  it('pauses, resumes, and resets playback cleanly', () => {
    MissionReplayEngine.startReplay('MARSWALK-001');
    const paused = MissionReplayEngine.pauseReplay();
    expect(paused.status).toBe('PAUSED');

    const resumed = MissionReplayEngine.resumeReplay();
    expect(resumed.status).toBe('PLAYING');

    const reset = MissionReplayEngine.resetReplay();
    expect(reset.currentEventIndex).toBe(0);
    expect(reset.status).toBe('IDLE');
  });

  it('filters event stream by agent, eventType, and simulation time range', () => {
    MissionReplayEngine.startReplay('MARSWALK-001');

    const scoutEvents = MissionReplayEngine.filterEvents({ agentId: 'agent-rover-01' });
    expect(scoutEvents.length).toBeGreaterThanOrEqual(1);

    const hazardEvents = MissionReplayEngine.filterEvents({ eventType: 'HAZARD_DETECTED' });
    expect(hazardEvents.length).toBeGreaterThanOrEqual(1);
    expect(hazardEvents[0].eventType).toBe('HAZARD_DETECTED');
  });
});
