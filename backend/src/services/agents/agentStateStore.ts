import { PlanetaryAgent } from "./agentTypes.js";
import { AgentRegistry } from "./agentRegistry.js";

export type AgentStateListener = (agent: PlanetaryAgent) => void;

export interface OperationEvent {
  id: string;
  timestamp: string;
  agentId: string;
  eventType:
    | "AGENT_REGISTERED"
    | "TASK_ASSIGNED"
    | "TASK_STARTED"
    | "TASK_COMPLETED"
    | "HAZARD_DETECTED"
    | "COMMUNICATION_DEGRADED"
    | "COMMUNICATION_LOST"
    | "COMMUNICATION_RESTORED"
    | "COMMAND_ISSUED"
    | "COMMAND_REJECTED"
    | "REPLAN_TRIGGERED"
    | "REPLAN_PROPOSED"
    | "REPLAN_APPROVED"
    | "EMERGENCY_DECLARED"
    | "SCIENCE_OBSERVATION_RECORDED"
    | "AGENT_RETURNING"
    | "AGENT_RECOVERED"
    | "MISSION_COMPLETED";
  severity: "INFO" | "WARNING" | "CRITICAL";
  message: string;
  details?: Record<string, unknown>;
}

export class AgentStateStore {
  private static events: OperationEvent[] = [];
  private static listeners: Set<AgentStateListener> = new Set();

  public static getAgents(): PlanetaryAgent[] {
    return AgentRegistry.getAllAgents();
  }

  public static getAgent(id: string): PlanetaryAgent | undefined {
    return AgentRegistry.getAgentById(id);
  }

  public static updateAgentState(agent: PlanetaryAgent, event?: Omit<OperationEvent, "id" | "timestamp">): void {
    AgentRegistry.updateAgent(agent);

    if (event) {
      const recordedEvent: OperationEvent = {
        id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        timestamp: new Date().toISOString(),
        ...event,
      };
      this.events.unshift(recordedEvent);
      if (this.events.length > 500) {
        this.events.pop();
      }
    }

    this.listeners.forEach((listener) => {
      try {
        listener(agent);
      } catch (err) {
        console.error("Agent listener error", err);
      }
    });
  }

  public static getEvents(limit: number = 50): OperationEvent[] {
    return this.events.slice(0, limit);
  }

  public static recordEvent(event: Omit<OperationEvent, "id" | "timestamp">): OperationEvent {
    const recordedEvent: OperationEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...event,
    };
    this.events.unshift(recordedEvent);
    return recordedEvent;
  }

  public static subscribe(listener: AgentStateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public static reset(): void {
    this.events = [];
    AgentRegistry.resetAgents();
  }

  public static clearEvents(): void {
    this.events = [];
  }
}
