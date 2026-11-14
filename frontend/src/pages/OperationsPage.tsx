import React, { useEffect, useState, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { api } from "../services/api.js";
import {
  PlanetaryAgent,
  NetworkTopology,
  TimelineEvent,
  ScienceQueueItem,
  OperationEvent,
  ReplanProposal,
  SimulationState,
  OperationsCopilotResponse,
  SensorObservation,
  OrbitalVisibilityWindow,
  CommunicationPacket,
} from "../types/index.js";
import {
  Radio,
  Play,
  Pause,
  RotateCcw,
  FastForward,
  AlertTriangle,
  CheckCircle,
  Shield,
  Wifi,
  Sparkles,
  Bot,
  User,
  Satellite,
  Compass,
  Clock,
  Layers,
  Activity,
  Lock,
  Server,
  Zap,
  Award,
  X,
  Send,
} from "lucide-react";

export const OperationsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const autoDemo = searchParams.get("demo") === "marswalk-001";
  const hasTriggeredDemoRef = useRef<boolean>(false);

  // State
  const [agents, setAgents] = useState<PlanetaryAgent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("agent-rover-01");
  const [network, setNetwork] = useState<NetworkTopology | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [scienceQueue, setScienceQueue] = useState<ScienceQueueItem[]>([]);
  const [events, setEvents] = useState<OperationEvent[]>([]);
  const [observations, setObservations] = useState<SensorObservation[]>([]);
  const [commQueue, setCommQueue] = useState<CommunicationPacket[]>([]);
  const [orbitalWindow, setOrbitalWindow] = useState<OrbitalVisibilityWindow | null>(null);
  const [activeScenario, setActiveScenario] = useState<string>("MARSWALK-001");
  const [securityStatus, setSecurityStatus] = useState<{ role: string; valid: boolean }>({
    role: "MISSION_COMMAND",
    valid: true,
  });

  const [simState, setSimState] = useState<SimulationState>({
    isRunning: false,
    simulationTimeMinutes: 48,
    timeScale: 1.0,
    scenarioSeed: 20261107,
  });
  const [activeReplan, setActiveReplan] = useState<ReplanProposal | null>(null);

  // Copilot state
  const [copilotQuery, setCopilotQuery] = useState<string>("Send Scout to investigate the steep region.");
  const [copilotResponse, setCopilotResponse] = useState<OperationsCopilotResponse | null>(null);
  const [isCopilotLoading, setIsCopilotLoading] = useState<boolean>(false);

  // Loading & Notification
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [notification, setNotification] = useState<string | null>(null);

  // WS5 + WS6 Operational State Extensions
  const [isTaskModalOpen, setIsTaskModalOpen] = useState<boolean>(false);
  const [targetReassignAgentId, setTargetReassignAgentId] = useState<string>("ROVER-01 SCOUT");
  const [reassignReason, setReassignReason] = useState<string>("Optimizing task allocation based on agent mobility & instrument capability.");
  const [isReassigning, setIsReassigning] = useState<boolean>(false);

  // Digital Twin state
  const [digitalTwinSnapshot, setDigitalTwinSnapshot] = useState<any | null>(null);
  const [inconsistencyReport, setInconsistencyReport] = useState<any | null>(null);
  const [isSnapshotting, setIsSnapshotting] = useState<boolean>(false);
  const [isCheckingConsistency, setIsCheckingConsistency] = useState<boolean>(false);

  // Monte Carlo state
  const [mcRuns, setMcRuns] = useState<number>(100);
  const [mcSeed, setMcSeed] = useState<number>(20261107);
  const [mcResult, setMcResult] = useState<any | null>(null);
  const [isMcLoading, setIsMcLoading] = useState<boolean>(false);

  const fetchState = async () => {
    try {
      const stateRes = await api.getOperationsState();
      setAgents(stateRes.agents);
      setNetwork(stateRes.network);
      setTimeline(stateRes.timeline);
      setScienceQueue(stateRes.scienceQueue);
      setEvents(stateRes.events);
      setSimState(stateRes.simState);

      if (stateRes.network?.orbitalVisibility) {
        setOrbitalWindow(stateRes.network.orbitalVisibility);
      }
      if ((stateRes as any).observations) {
        setObservations((stateRes as any).observations);
      }
      if ((stateRes as any).commQueue) {
        setCommQueue((stateRes as any).commQueue);
      }
      const fetchedTasks = await api.getOperationsTasks().catch(() => []);
      setOpsTasks(fetchedTasks);

      if (stateRes.replanProposals && stateRes.replanProposals.length > 0) {
        setActiveReplan(stateRes.replanProposals[0]);
      }

      const permRes = await api.getSecurityPermissions().catch(() => ({ role: "MISSION_COMMAND", permissions: {} }));
      setSecurityStatus({ role: permRes.role, valid: true });
    } catch (err) {
      console.error("Error loading operations state", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchState();
  }, []);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 5000);
  };

  const handleAskCopilot = async (queryText?: string) => {
    const text = queryText || copilotQuery;
    if (!text.trim()) return;
    setIsCopilotLoading(true);
    try {
      const res = await api.copilotOperationsQuery(text);
      setCopilotResponse(res);
    } catch (err: any) {
      showNotification(`Copilot query failed: ${err.message}`);
    } finally {
      setIsCopilotLoading(false);
    }
  };

  // Flagship Demo: Scout Hazard Detection & Replanning
  const handleTriggerDemo = async () => {
    setIsLoading(true);
    try {
      setActiveScenario("MARSWALK-001");
      const res = await api.triggerDemoHazardRecon();
      setActiveReplan(res.replanProposal);
      await fetchState();
      showNotification("Flagship Demo MARSWALK-001: ROVER-01 laser altimeter & HazCam detected 22.4° scarp. Autonomous safety pause engaged.");
      handleAskCopilot("Send Scout to investigate the steep region.");
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-trigger demo if URL has query
  useEffect(() => {
    if (autoDemo && !isLoading && !hasTriggeredDemoRef.current) {
      hasTriggeredDemoRef.current = true;
      handleTriggerDemo();
    }
  }, [autoDemo, isLoading]);

  // Simulation Controls
  const handleToggleSim = async () => {
    if (simState.isRunning) {
      const updated = await api.pauseSimulation();
      setSimState(updated);
      showNotification("Simulation clock paused.");
    } else {
      const updated = await api.startSimulation(simState.timeScale);
      setSimState(updated);
      showNotification(`Simulation clock started (${simState.timeScale}x rate).`);
    }
  };

  const handleAdvanceSim = async (minutes: number = 15) => {
    await api.advanceSimulation(minutes);
    await fetchState();
    showNotification(`Simulation advanced +${minutes} minutes.`);
  };

  const handleResetSim = async () => {
    const updated = await api.resetSimulation();
    setSimState(updated);
    setActiveReplan(null);
    await fetchState();
    showNotification("Simulation clock reset to 00:30.");
  };

  const handleReassignTask = async (taskId: string) => {
    setIsReassigning(true);
    try {
      await api.reassignAgentTask(taskId, targetReassignAgentId, reassignReason);
      showNotification(`Task successfully reassigned to ${targetReassignAgentId}.`);
      await fetchState();
      setIsTaskModalOpen(false);
    } catch (err: any) {
      showNotification(`Task reassignment failed: ${err.message}`);
    } finally {
      setIsReassigning(false);
    }
  };

  const handleCaptureSnapshot = async () => {
    setIsSnapshotting(true);
    try {
      const snap = await api.createDigitalTwinSnapshot("OPERATOR_CHECKPOINT");
      setDigitalTwinSnapshot(snap);
      showNotification(`Captured Digital Twin Snapshot: ${snap.stateHash?.slice(0, 10)}... (SHA-256)`);
    } catch (err: any) {
      showNotification(`Snapshot error: ${err.message}`);
    } finally {
      setIsSnapshotting(false);
    }
  };

  const handleCheckConsistency = async () => {
    setIsCheckingConsistency(true);
    try {
      const rep = await api.getDigitalTwinInconsistencies();
      setInconsistencyReport(rep);
      if (rep.isConsistent) {
        showNotification("State Invariant: Digital Twin is 100% consistent with canonical truth.");
      } else {
        showNotification(`State Alert: ${rep.discrepancies.length} discrepancies detected.`);
      }
    } catch (err: any) {
      showNotification(`Consistency audit failed: ${err.message}`);
    } finally {
      setIsCheckingConsistency(false);
    }
  };

  const handleRunMonteCarlo = async () => {
    setIsMcLoading(true);
    try {
      const mc = await api.runMonteCarlo(mcRuns, mcSeed);
      setMcResult(mc);
      showNotification(`Calculated ${mcRuns}-run Monte Carlo distribution (P50: ${mc.durationDistributionMinutes?.p50}m).`);
    } catch (err: any) {
      showNotification(`Monte Carlo run failed: ${err.message}`);
    } finally {
      setIsMcLoading(false);
    }
  };

  // Phase 5 Scenario: Communication Blackout
  const handleTriggerBlackoutScenario = async () => {
    try {
      setActiveScenario("COMM-BLACKOUT-001");
      await api.executeScenarioBlackout();
      await fetchState();
      showNotification("COMM-BLACKOUT-001: MRO pass expired. Telemetry buffered. Science queued until next orbital pass.");
      handleAskCopilot("Why did communication fail?");
    } catch (err: any) {
      showNotification(`Scenario failed: ${err.message}`);
    }
  };

  // Phase 5 Scenario: Battery Critical
  const handleTriggerBatteryScenario = async () => {
    try {
      setActiveScenario("EMERGENCY-001");
      await api.executeScenarioEmergency("BATTERY_CRITICAL");
      await fetchState();
      showNotification("EMERGENCY-001: ROVER-02 Battery Critical (<10%). Autonomous safe return engaged. Astronaut corridor given priority.");
      handleAskCopilot("Which rover should inspect the delta?");
    } catch (err: any) {
      showNotification(`Scenario failed: ${err.message}`);
    }
  };

  // Phase 5 Scenario: Security Replay Protection
  const handleTriggerSecurityScenario = async () => {
    try {
      setActiveScenario("SECURITY-001");
      const testNonce = "nonce-sample-1234";
      const envelope = {
        commandId: "cmd-test-replay-01",
        agentId: "agent-rover-01",
        command: "PAUSE",
        issuedAt: Date.now(),
        expiresAt: Date.now() + 60000,
        nonce: testNonce,
        issuer: "Flight Director",
      };

      await api.submitSecureCommand(envelope);
      showNotification("SECURITY-001: Initial command executed and signed into cryptographic audit chain.");

      try {
        await api.submitSecureCommand(envelope);
      } catch (replayErr: any) {
        showNotification("SECURITY-001: Replay attack blocked! Duplicate commandId & nonce rejected by server.");
      }
      await fetchState();
    } catch (err: any) {
      showNotification(`Security test completed: ${err.message}`);
    }
  };

  // Approve Replan
  const handleApproveReplan = async () => {
    if (!activeReplan) return;
    try {
      const res = await api.approveReplan(activeReplan.replanId, "Flight Director (Mission Command Console)");
      setActiveReplan(res);
      await fetchState();
      showNotification("Replan approved by MISSION_COMMAND. Scout rover resuming along valley detour.");
    } catch (err: any) {
      showNotification(`Approval failed: ${err.message}`);
    }
  };

  // Command an agent
  const handleAgentCommand = async (command: "PAUSE" | "RESUME" | "RETURN_TO_BASE") => {
    if (!selectedAgentId) return;
    await api.executeAgentCommand(selectedAgentId, command);
    await fetchState();
    showNotification(`Command '${command}' transmitted to agent.`);
  };

  // Recovery Batch 3: Task Lifecycle, Agent Status, Telemetry & Comms
  const [opsTasks, setOpsTasks] = useState<any[]>([]);
  const [isAssignOpen, setIsAssignOpen] = useState<boolean>(false);
  const [newTaskName, setNewTaskName] = useState<string>("");
  const [newTaskType, setNewTaskType] = useState<string>("VERIFY_ROUTE");
  const [newTaskPriority, setNewTaskPriority] = useState<"CRITICAL" | "HIGH" | "MEDIUM" | "LOW">("HIGH");
  const [newTaskDepId, setNewTaskDepId] = useState<string>("");
  const [taskFeedback, setTaskFeedback] = useState<string | null>(null);
  const [commPacketType, setCommPacketType] = useState<"TELEMETRY" | "HAZARD_ALERT" | "SCIENCE_DATA">("TELEMETRY");
  const [commPacketPriority, setCommPacketPriority] = useState<"CRITICAL" | "HIGH" | "MEDIUM" | "BULK">("HIGH");

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgent || !newTaskName.trim()) return;
    setTaskFeedback(null);
    try {
      await api.createOperationsTask({
        agentId: selectedAgent.id,
        name: newTaskName.trim(),
        taskType: newTaskType,
        priority: newTaskPriority,
        targetCoordinate: {
          latitude: Number((selectedAgent.position.latitude + 0.005).toFixed(4)),
          longitude: Number((selectedAgent.position.longitude + 0.005).toFixed(4)),
        },
        dependencies: newTaskDepId ? [newTaskDepId] : undefined,
      });
      setNewTaskName("");
      setNewTaskDepId("");
      setIsAssignOpen(false);
      await fetchState();
      showNotification(`Task assigned to ${selectedAgent.callsign}.`);
    } catch (err: any) {
      setTaskFeedback(err.message || "Failed to assign task");
    }
  };

  const handleTransitionTask = async (taskId: string, action: "START" | "PAUSE" | "RESUME" | "COMPLETE" | "CANCEL") => {
    setTaskFeedback(null);
    try {
      await api.transitionOperationsTask(taskId, action);
      await fetchState();
      showNotification(`Task ${action} executed.`);
    } catch (err: any) {
      setTaskFeedback(err.message || `Task ${action} rejected`);
    }
  };

  const handleAgentStatusChange = async (nextStatus: string) => {
    if (!selectedAgent) return;
    try {
      const res = await api.transitionAgentStatus(selectedAgent.id, nextStatus, `Operator status transition to ${nextStatus}`);
      await fetchState();
      if (res.reassignedToAgent) {
        showNotification(`${selectedAgent.callsign} marked ${nextStatus}. Active task auto-reassigned to ${res.reassignedToAgent.callsign}.`);
      } else if (res.reassignedTask) {
        showNotification(`${selectedAgent.callsign} marked ${nextStatus}. Task marked BLOCKED (no capable replacement).`);
      } else {
        showNotification(`${selectedAgent.callsign} status updated to ${nextStatus}.`);
      }
    } catch (err: any) {
      showNotification(`Status update failed: ${err.message}`);
    }
  };

  const handleSimulateTelemetryStep = async (deltaPercent: number) => {
    if (!selectedAgent) return;
    const nextBatt = Math.max(0, Math.min(100, Number((selectedAgent.telemetry.batteryPercent + deltaPercent).toFixed(1))));
    try {
      const res = await api.updateAgentTelemetry(selectedAgent.id, { batteryPercent: nextBatt });
      await fetchState();
      if (res.safetyWarnings?.length > 0) {
        showNotification(res.safetyWarnings[0]);
      } else {
        showNotification(`Simulated telemetry updated for ${selectedAgent.callsign}: ${nextBatt}% battery (SIMULATED).`);
      }
    } catch (err: any) {
      showNotification(`Telemetry update failed: ${err.message}`);
    }
  };

  const handleEnqueuePacket = async () => {
    const sourceId = selectedAgent?.id || "agent-rover-01";
    try {
      const res = await api.enqueueCommPacket({
        sourceAgentId: sourceId,
        priority: commPacketPriority,
        type: commPacketType,
        payloadSizeKb: commPacketType === "SCIENCE_DATA" ? 1200 : 24,
        storeAndForward: true,
      });
      await fetchState();
      showNotification(`Packet ${res.packet.packetId} enqueued (${res.packet.status}).`);
    } catch (err: any) {
      showNotification(`Enqueue failed: ${err.message}`);
    }
  };

  const handleFlushQueue = async () => {
    try {
      const res = await api.flushCommQueue(true);
      await fetchState();
      showNotification(`Queue processed: ${res.transmittedCount} delivered, ${res.bufferedCount} buffered.`);
    } catch (err: any) {
      showNotification(`Flush failed: ${err.message}`);
    }
  };

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) || agents[0];

  if (isLoading && agents.length === 0) {
    return (
      <div className="h-[calc(100vh-3.5rem)] bg-atlas-bg flex flex-col items-center justify-center space-y-4 font-mono text-xs text-atlas-muted">
        <div className="w-8 h-8 border-2 border-atlas-accent border-t-transparent animate-spin" />
        <div className="tracking-widest uppercase font-semibold text-atlas-text">
          Initializing Planetary Simulation Bus...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-atlas-bg text-atlas-text p-4 md:p-6 font-mono text-xs selection:bg-atlas-accent selection:text-white flex flex-col space-y-4 transition-colors">
      {/* Top Banner / Notification */}
      {notification && (
        <div className="p-3 bg-atlas-surface border border-atlas-teal text-atlas-teal flex items-center justify-between shadow-xl">
          <div className="flex items-center space-x-2">
            <Radio className="w-4 h-4 text-atlas-teal shrink-0 animate-pulse" />
            <span className="font-sans text-xs">{notification}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-atlas-teal hover:text-atlas-text ml-4">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Flagship Replan Alert Banner if Active */}
      {activeReplan && activeReplan.status === "PROPOSED" && (
        <div className="p-4 bg-atlas-surface border-2 border-atlas-amber text-atlas-text shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-atlas-amber font-bold uppercase tracking-wider text-xs">
              <AlertTriangle className="w-4 h-4" />
              <span>Sensor-Corroborated Replan Pending Mission Command Approval</span>
            </div>
            <div className="text-sm font-bold text-atlas-text font-display">
              {activeReplan.trigger.hazardDescription || activeReplan.trigger.reason}
            </div>
            <div className="text-[11px] text-atlas-muted font-sans">
              Proposed Detour: <b className="text-atlas-text">Safest Valley Corridor</b> | Safety Score:{" "}
              <b className="text-atlas-teal">+{activeReplan.comparison.safetyScoreDiff} pts</b> | Dist Diff:{" "}
              <b className="text-atlas-text">{activeReplan.comparison.distanceDiffKm} km</b>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={handleApproveReplan}
              className="px-4 py-2 bg-atlas-teal hover:bg-atlas-teal/90 text-white font-bold text-xs flex items-center space-x-1.5 transition-all shadow-md"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Approve Replan (Flight Director Gate)</span>
            </button>
          </div>
        </div>
      )}

      {/* Header & Simulation Control Console */}
      <div className="p-4 bg-atlas-surface border border-atlas-border flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center space-x-3 flex-wrap gap-2">
          <div className="flex items-center space-x-2 text-atlas-accent font-bold text-sm">
            <Radio className="w-4 h-4 text-atlas-teal animate-pulse" />
            <span className="font-display">Planetary Operations Command Console</span>
          </div>

          <span className="px-2.5 py-0.5 bg-atlas-elevated border border-atlas-border text-atlas-muted text-[11px]">
            Scenario: <b className="text-atlas-text">{activeScenario}</b>
          </span>

          <span className="px-2 py-0.5 bg-atlas-elevated border border-atlas-border text-atlas-teal text-[10px] font-bold">
            Agents: {agents.length} Active
          </span>

          <span className="px-2 py-0.5 bg-atlas-elevated border border-atlas-border text-atlas-blue text-[10px] font-bold flex items-center space-x-1">
            <Lock className="w-3 h-3" />
            <span>Auth: {securityStatus.role}</span>
          </span>
        </div>

        {/* Simulation Controls */}
        <div className="flex items-center space-x-2 flex-wrap gap-1">
          <div className="flex items-center space-x-1.5 bg-atlas-elevated px-2.5 py-1 border border-atlas-border text-[11px]">
            <Clock className="w-3.5 h-3.5 text-atlas-blue" />
            <span className="text-atlas-muted">MET:</span>
            <span className="text-atlas-text font-bold font-mono">
              {Math.floor(simState.simulationTimeMinutes / 60)
                .toString()
                .padStart(2, "0")}
              :{(simState.simulationTimeMinutes % 60).toString().padStart(2, "0")}:00
            </span>
          </div>

          <button
            onClick={handleToggleSim}
            className={`px-3 py-1 font-bold border text-[11px] flex items-center space-x-1 transition-all ${
              simState.isRunning
                ? "bg-atlas-amber text-black border-atlas-amber"
                : "bg-atlas-elevated hover:bg-atlas-surface text-atlas-teal border-atlas-border"
            }`}
          >
            {simState.isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{simState.isRunning ? "Pause" : "Resume"}</span>
          </button>

          <button
            onClick={() => handleAdvanceSim(15)}
            className="px-2.5 py-1 bg-atlas-elevated hover:bg-atlas-surface text-atlas-text border border-atlas-border text-[11px] flex items-center space-x-1 transition-colors"
            title="Step simulation forward 15 minutes"
          >
            <FastForward className="w-3.5 h-3.5 text-atlas-blue" />
            <span>+15m</span>
          </button>

          <button
            onClick={handleResetSim}
            className="px-2 py-1 bg-atlas-elevated hover:bg-atlas-surface text-atlas-muted hover:text-atlas-text border border-atlas-border transition-colors"
            title="Reset simulation clock"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Provenance & Truthfulness Strip */}
      <div className="flex flex-wrap items-center gap-2 text-[10px] text-atlas-muted bg-atlas-surface px-3.5 py-2 border border-atlas-border shadow-sm">
        <span className="text-atlas-muted font-bold uppercase tracking-wider flex items-center space-x-1">
          <Server className="w-3 h-3 text-atlas-blue" />
          <span>Provenance:</span>
        </span>
        <span className="bg-atlas-elevated px-2 py-0.5 text-atlas-amber border border-atlas-border">Data Mode: Benchmark</span>
        <span className="bg-atlas-elevated px-2 py-0.5 text-atlas-blue border border-atlas-border">Observations: Simulated (Noise Model)</span>
        <span className="bg-atlas-elevated px-2 py-0.5 text-atlas-teal border border-atlas-border">Terrain: Benchmark / Synthetic Model</span>
        <span className="bg-atlas-elevated px-2 py-0.5 text-atlas-violet border border-atlas-border">Orbit: 112m Keplerian Approx</span>
        <span className="bg-atlas-elevated px-2 py-0.5 text-atlas-red border border-atlas-border">RBAC: Server Enforced</span>
      </div>

      {/* Deterministic Scenario Execution Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-atlas-surface p-3 border border-atlas-border text-[11px]">
        <div className="flex items-center space-x-1.5 text-atlas-muted font-bold uppercase tracking-wider text-[10px]">
          <Zap className="w-3.5 h-3.5 text-atlas-accent" />
          <span>Deterministic Scenarios:</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={handleTriggerDemo}
            className="px-2.5 py-1 bg-atlas-elevated hover:bg-atlas-surface text-atlas-amber border border-atlas-border font-bold text-[10px] transition-colors"
          >
            Marswalk-001 (Flagship Recon)
          </button>
          <button
            onClick={handleTriggerBlackoutScenario}
            className="px-2.5 py-1 bg-atlas-elevated hover:bg-atlas-surface text-atlas-violet border border-atlas-border font-bold text-[10px] transition-colors"
          >
            Comm-Blackout-001 (Orbital Loss)
          </button>
          <button
            onClick={handleTriggerBatteryScenario}
            className="px-2.5 py-1 bg-atlas-elevated hover:bg-atlas-surface text-atlas-red border border-atlas-border font-bold text-[10px] transition-colors"
          >
            Emergency-001 (Battery Critical)
          </button>
          <button
            onClick={handleTriggerSecurityScenario}
            className="px-2.5 py-1 bg-atlas-elevated hover:bg-atlas-surface text-atlas-blue border border-atlas-border font-bold text-[10px] transition-colors"
          >
            Security-001 (Replay Defense)
          </button>
          <Link
            to="/replay"
            className="px-2.5 py-1 bg-atlas-elevated hover:bg-atlas-surface text-atlas-accent border border-atlas-border font-bold text-[10px] flex items-center space-x-1 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Mission Replay</span>
          </Link>
          <Link
            to="/demo"
            className="px-2.5 py-1 bg-atlas-elevated hover:bg-atlas-surface text-atlas-violet border border-atlas-border font-bold text-[10px] flex items-center space-x-1 transition-colors"
          >
            <Award className="w-3 h-3" />
            <span>Judging Demo</span>
          </Link>
        </div>
      </div>

      {/* Main Grid: Left Map + Comms + Timeline, Right Agent Sidebar + Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1">
        {/* Left Column (2 Cols wide on desktop) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Surface Map Viewport */}
          <div className="p-4 bg-atlas-surface border border-atlas-border shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-atlas-border pb-2">
              <div className="flex items-center space-x-2 text-atlas-text font-bold font-display">
                <Compass className="w-4 h-4 text-atlas-blue" />
                <span>Jezero Crater Surface Tactical Map</span>
              </div>
              <div className="flex items-center space-x-3 text-[10px] text-atlas-muted">
                <span>Center: 18.4447°N, 77.4508°E</span>
                <span>Datum: Areoid 3396.2 km</span>
              </div>
            </div>

            {/* Tactical Grid Visualization */}
            <div className="h-72 bg-atlas-bg border border-atlas-border relative overflow-hidden flex items-center justify-center">
              <div className="absolute inset-0 bg-[radial-gradient(#29384b_1px,transparent_1px)] [background-size:16px_16px] opacity-40" />

              {/* Jezero Delta Rim Contour Line */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                <path
                  d="M 50 180 Q 150 120 280 140 T 500 200"
                  fill="none"
                  stroke="var(--atlas-accent)"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                  opacity="0.6"
                />
                <text x="70" y="170" fill="var(--atlas-accent)" fontSize="10" fontFamily="Inter">
                  Jezero Delta Front Scarp (22.4° gradient hazard)
                </text>
              </svg>

              {/* Render Agents on Canvas */}
              <div className="relative w-full h-full p-4">
                {agents.map((ag) => {
                  const xPct = Math.min(90, Math.max(10, ((ag.position.longitude - 77.4) / 0.08) * 100));
                  const yPct = Math.min(90, Math.max(10, 100 - ((ag.position.latitude - 18.4) / 0.08) * 100));
                  const isSelected = ag.id === selectedAgentId;

                  return (
                    <div
                      key={ag.id}
                      onClick={() => setSelectedAgentId(ag.id)}
                      style={{ left: `${xPct}%`, top: `${yPct}%` }}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all ${
                        isSelected ? "scale-125 z-30" : "hover:scale-110 z-10"
                      }`}
                    >
                      <div
                        className={`w-7 h-7 flex items-center justify-center shadow-lg border-2 ${
                          ag.status === "EMERGENCY"
                            ? "bg-atlas-surface border-atlas-red animate-pulse"
                            : ag.status === "PAUSED"
                            ? "bg-atlas-surface border-atlas-amber"
                            : isSelected
                            ? "bg-atlas-accent border-white"
                            : "bg-atlas-surface border-atlas-blue"
                        }`}
                      >
                        {ag.type === "ASTRONAUT" ? (
                          <User className="w-3.5 h-3.5 text-atlas-text" />
                        ) : ag.type === "ORBITER" ? (
                          <Satellite className="w-3.5 h-3.5 text-atlas-text" />
                        ) : (
                          <Bot className="w-3.5 h-3.5 text-atlas-text" />
                        )}
                      </div>
                      <div className="absolute top-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-atlas-surface px-1.5 py-0.5 text-[9px] border border-atlas-border text-atlas-text font-bold">
                        {ag.callsign}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Two-Column Mid-Row: Orbiter Status & Sensor Observations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Orbiter Pass Status Card */}
            <div className="p-4 bg-atlas-surface border border-atlas-border shadow-xl space-y-2.5">
              <div className="flex items-center justify-between border-b border-atlas-border pb-2">
                <div className="flex items-center space-x-2 text-atlas-text font-bold font-display">
                  <Satellite className="w-4 h-4 text-atlas-violet" />
                  <span>Orbital Relay Pass Monitor</span>
                </div>
                <span
                  className={`px-2 py-0.5 text-[9px] font-bold border ${
                    orbitalWindow?.state === "PASS_ACTIVE"
                      ? "bg-atlas-elevated text-atlas-teal border-atlas-teal animate-pulse"
                      : orbitalWindow?.state === "PASS_APPROACHING"
                      ? "bg-atlas-elevated text-atlas-amber border-atlas-amber"
                      : "bg-atlas-elevated text-atlas-muted border-atlas-border"
                  }`}
                >
                  {orbitalWindow?.state || "PASS ACTIVE"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="bg-atlas-elevated p-2.5 border border-atlas-border">
                  <div className="text-atlas-muted uppercase">Elevation Angle</div>
                  <div className="text-sm font-bold text-atlas-text mt-0.5">{orbitalWindow?.currentElevationDeg || 37.4}°</div>
                  <div className="text-[9px] text-atlas-muted mt-0.5">Mask threshold: &ge;15.0°</div>
                </div>

                <div className="bg-atlas-elevated p-2.5 border border-atlas-border">
                  <div className="text-atlas-muted uppercase">Throughput Bandwidth</div>
                  <div className="text-sm font-bold text-atlas-violet mt-0.5">{orbitalWindow?.bandwidthKbps || 2048} kbps</div>
                  <div className="text-[9px] text-atlas-muted mt-0.5">Slant Range: {orbitalWindow?.slantRangeKm || 385} km</div>
                </div>
              </div>

              <div className="text-[10px] text-atlas-muted flex items-center justify-between bg-atlas-elevated p-2 border border-atlas-border">
                <span>Pass Remaining: <b className="text-atlas-text">{orbitalWindow?.remainingSeconds ? `${Math.round(orbitalWindow.remainingSeconds / 60)}m ${orbitalWindow.remainingSeconds % 60}s` : "08m 42s"}</b></span>
                <span>Next Window: <b className="text-atlas-violet">{orbitalWindow?.nextPassInSeconds ? `${Math.round(orbitalWindow.nextPassInSeconds / 60)}m` : "112m Cycle"}</b></span>
              </div>
            </div>

            {/* Sensor Observation Panel */}
            <div className="p-4 bg-atlas-surface border border-atlas-border shadow-xl space-y-2.5">
              <div className="flex items-center justify-between border-b border-atlas-border pb-2">
                <div className="flex items-center space-x-2 text-atlas-text font-bold font-display">
                  <Activity className="w-4 h-4 text-atlas-blue" />
                  <span>Onboard Sensor Observations</span>
                </div>
                <span className="text-[9px] bg-atlas-elevated text-atlas-teal px-2 py-0.5 border border-atlas-border font-bold">
                  Quality: Nominal ({observations.length} Samples)
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="bg-atlas-elevated p-2.5 border border-atlas-border">
                  <div className="text-atlas-muted uppercase">Laser Altimeter</div>
                  <div className="text-sm font-bold text-atlas-blue mt-0.5">-2534.2 m &plusmn; 0.15m</div>
                  <div className="text-[9px] text-atlas-muted mt-0.5">Slope: 21.8° &plusmn; 1.2°</div>
                </div>

                <div className="bg-atlas-elevated p-2.5 border border-atlas-border">
                  <div className="text-atlas-muted uppercase">Stereo HazCam</div>
                  <div className="text-sm font-bold text-atlas-amber mt-0.5">Obstacle: 87%</div>
                  <div className="text-[9px] text-atlas-muted mt-0.5">Confidence: 0.94 (Corroborated)</div>
                </div>
              </div>

              <div className="text-[10px] text-atlas-muted bg-atlas-elevated p-2 border border-atlas-border truncate">
                Raman: Mineral Match <b className="text-atlas-text">Carbonate 0.88</b> | Bio Signature: <b className="text-atlas-teal">None (Clean)</b>
              </div>
            </div>
          </div>

          {/* Communication Priority Queue */}
          <div className="p-4 bg-atlas-surface border border-atlas-border shadow-xl space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-atlas-border pb-2">
              <div className="flex items-center space-x-2 text-atlas-text font-bold font-display">
                <Wifi className="w-4 h-4 text-atlas-teal" />
                <span>Tactical Communication Packet Queue</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-atlas-muted font-mono">
                  {commQueue.filter((p) => p.status === "BUFFERED" || p.status === "QUEUED").length} Pending / {commQueue.length} Total
                </span>
                <button
                  onClick={handleFlushQueue}
                  className="px-2 py-0.5 bg-atlas-teal hover:bg-atlas-teal/90 text-white font-bold text-[10px] rounded transition-colors"
                >
                  Deliver / Flush Queue
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 bg-atlas-elevated/50 p-2 border border-atlas-border text-[10px]">
              <select
                value={commPacketType}
                onChange={(e) => setCommPacketType(e.target.value as any)}
                className="bg-atlas-elevated border border-atlas-border text-atlas-text px-1.5 py-1 rounded"
              >
                <option value="TELEMETRY">TELEMETRY</option>
                <option value="HAZARD_ALERT">HAZARD_ALERT</option>
                <option value="SCIENCE_DATA">SCIENCE_DATA</option>
              </select>
              <select
                value={commPacketPriority}
                onChange={(e) => setCommPacketPriority(e.target.value as any)}
                className="bg-atlas-elevated border border-atlas-border text-atlas-text px-1.5 py-1 rounded"
              >
                <option value="CRITICAL">CRITICAL</option>
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="BULK">BULK</option>
              </select>
              <button
                onClick={handleEnqueuePacket}
                className="px-2.5 py-1 bg-atlas-accent hover:bg-atlas-accent/90 text-white font-bold rounded transition-colors"
              >
                Send Packet
              </button>
            </div>

            <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
              {commQueue.map((pkt) => (
                <div key={pkt.packetId} className="p-2 bg-atlas-elevated border border-atlas-border flex items-center justify-between text-[10px]">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-1.5 py-0.2 font-bold uppercase border ${
                        pkt.priority === "CRITICAL"
                          ? "bg-atlas-surface text-atlas-red border-atlas-red"
                          : "bg-atlas-surface text-atlas-muted border-atlas-border"
                      }`}
                    >
                      {pkt.priority}
                    </span>
                    <span className="font-bold text-atlas-text">{pkt.type}</span>
                    <span className="text-atlas-muted">({pkt.payloadSizeKb} KB)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span
                      className={`font-bold ${
                        pkt.status === "DELIVERED"
                          ? "text-atlas-teal"
                          : pkt.status === "TRANSMITTING"
                          ? "text-atlas-blue animate-pulse"
                          : "text-atlas-amber"
                      }`}
                    >
                      {pkt.status}
                    </span>
                    <span className="text-atlas-muted">{pkt.sourceAgentId}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mission Timeline & Operational Events Stream */}
          <div className="p-4 bg-atlas-surface border border-atlas-border shadow-xl space-y-2">
            <div className="flex items-center justify-between border-b border-atlas-border pb-2">
              <div className="flex items-center space-x-2 text-atlas-text font-bold font-display">
                <Clock className="w-4 h-4 text-atlas-blue" />
                <span>Mission Timeline & Event Audit Stream</span>
              </div>
              <span className="text-[10px] text-atlas-muted">
                Network: {network?.links.filter((l) => l.status === "CONNECTED").length || 0} active links
              </span>
            </div>

            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {events.slice(0, 8).map((ev) => (
                <div key={ev.id} className="p-2 bg-atlas-elevated border border-atlas-border flex items-center justify-between text-[10px]">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-atlas-accent">{ev.timestamp.substring(11, 19)}</span>
                    <span className="font-bold text-atlas-text">[{ev.eventType}]</span>
                    <span className="text-atlas-muted truncate max-w-xs">{ev.message}</span>
                  </div>
                  <span className="text-[9px] text-atlas-muted font-mono">{ev.agentId}</span>
                </div>
              ))}
              {timeline.slice(0, 2).map((tm) => (
                <div key={tm.id} className="text-[9px] text-atlas-muted italic">
                  Scheduled: {tm.timeLabel} - {tm.title} ({tm.status})
                </div>
              ))}
            </div>
          </div>

          {/* Digital Twin Synchronization & Inconsistency Auditor */}
          <div className="p-4 bg-atlas-surface border border-atlas-border shadow-xl space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-atlas-border pb-2">
              <div className="flex items-center space-x-2 text-atlas-text font-bold font-display">
                <Server className="w-4 h-4 text-atlas-teal" />
                <span>Digital Twin State Synchronization & Inconsistency Auditor</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-atlas-elevated text-atlas-teal border border-atlas-border font-bold">
                Canonical Mirror
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-atlas-elevated/40 border border-atlas-border rounded">
              <div>
                <span className="text-[10px] text-atlas-muted uppercase block">Cryptographic State Hash</span>
                <span className="text-xs font-bold text-atlas-text">
                  {digitalTwinSnapshot ? `${digitalTwinSnapshot.stateHash?.slice(0, 24)}...` : "Active SHA-256 Event Chain"}
                </span>
                <span className="text-[10px] text-atlas-muted block mt-0.5">
                  Synchronized with canonical fleet, routes, hazards, resources & comms
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCaptureSnapshot}
                  disabled={isSnapshotting}
                  className="px-3 py-1.5 bg-atlas-elevated hover:bg-atlas-elevated/80 border border-atlas-border text-atlas-text rounded text-xs font-bold transition-colors"
                >
                  {isSnapshotting ? "Snapshotting..." : "Capture Snapshot"}
                </button>
                <button
                  onClick={handleCheckConsistency}
                  disabled={isCheckingConsistency}
                  className="px-3 py-1.5 bg-atlas-accent hover:bg-atlas-accent/90 disabled:opacity-50 text-white rounded text-xs font-bold transition-colors"
                >
                  {isCheckingConsistency ? "Auditing..." : "Audit State Consistency"}
                </button>
              </div>
            </div>

            {inconsistencyReport && (
              <div
                className={`p-3 rounded border text-xs ${
                  inconsistencyReport.isConsistent
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    : "bg-red-500/10 border-red-500/30 text-red-300"
                }`}
              >
                <div className="font-bold flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" />
                  <span>
                    {inconsistencyReport.isConsistent
                      ? "Zero Discrepancies Detected. Digital Twin matches ground truth 1:1."
                      : `State Alert: ${inconsistencyReport.discrepancies.length} Discrepancies Detected.`}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Stochastic Monte Carlo Uncertainty Explorer */}
          <div className="p-4 bg-atlas-surface border border-atlas-border shadow-xl space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-atlas-border pb-2">
              <div className="flex items-center space-x-2 text-atlas-text font-bold font-display">
                <Activity className="w-4 h-4 text-atlas-accent" />
                <span>Stochastic Monte Carlo Uncertainty Explorer</span>
              </div>
              <span className="text-[10px] text-atlas-muted">
                Deterministic LCG with Box-Muller Transforms
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-atlas-elevated/40 border border-atlas-border rounded">
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-[10px] text-atlas-muted uppercase block">Run Count</span>
                  <input
                    type="number"
                    min={50}
                    max={500}
                    step={50}
                    value={mcRuns}
                    onChange={(e) => setMcRuns(Number(e.target.value))}
                    className="w-20 bg-atlas-elevated border border-atlas-border text-atlas-text text-xs p-1 rounded font-bold"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-atlas-muted uppercase block">PRNG Seed</span>
                  <input
                    type="number"
                    value={mcSeed}
                    onChange={(e) => setMcSeed(Number(e.target.value))}
                    className="w-28 bg-atlas-elevated border border-atlas-border text-atlas-text text-xs p-1 rounded font-bold"
                  />
                </div>
              </div>

              <button
                onClick={handleRunMonteCarlo}
                disabled={isMcLoading}
                className="px-4 py-2 bg-atlas-accent hover:bg-atlas-accent/90 disabled:opacity-50 text-white rounded text-xs font-bold transition-all shadow"
              >
                {isMcLoading ? "Computing 100 Runs..." : "Run Monte Carlo Analysis"}
              </button>
            </div>

            {mcResult && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <div className="p-2.5 bg-atlas-elevated border border-atlas-border rounded">
                  <span className="text-[9px] text-atlas-muted uppercase block">Success Rate</span>
                  <span className="text-base font-bold text-emerald-400">
                    {mcResult.successProbabilityPercent}%
                  </span>
                </div>
                <div className="p-2.5 bg-atlas-elevated border border-atlas-border rounded">
                  <span className="text-[9px] text-atlas-muted uppercase block">Duration P50</span>
                  <span className="text-base font-bold text-atlas-text">
                    {mcResult.durationDistributionMinutes?.p50}m
                  </span>
                  <span className="text-[9px] text-atlas-muted block">
                    P10: {mcResult.durationDistributionMinutes?.p10}m | P90: {mcResult.durationDistributionMinutes?.p90}m
                  </span>
                </div>
                <div className="p-2.5 bg-atlas-elevated border border-atlas-border rounded">
                  <span className="text-[9px] text-atlas-muted uppercase block">95% Confidence</span>
                  <span className="text-xs font-bold text-atlas-teal mt-1 block">
                    [{mcResult.durationDistributionMinutes?.confidenceInterval95?.[0]} - {mcResult.durationDistributionMinutes?.confidenceInterval95?.[1]}]m
                  </span>
                </div>
                <div className="p-2.5 bg-atlas-elevated border border-atlas-border rounded">
                  <span className="text-[9px] text-atlas-muted uppercase block">Battery P50</span>
                  <span className="text-base font-bold text-atlas-text">
                    {mcResult.batteryReserveDistribution?.p50}%
                  </span>
                  <span className="text-[9px] text-atlas-muted block">
                    P10: {mcResult.batteryReserveDistribution?.p10}%
                  </span>
                </div>
              </div>
            )}

            <div className="text-[10px] text-atlas-muted pt-1 border-t border-atlas-border flex items-center justify-between">
              <span>Classification: SIMULATED / MONTE CARLO</span>
              <span className="text-atlas-teal">Models terrain roughness, energy discharge, and comms variance</span>
            </div>
          </div>
        </div>

        {/* Right Column: Agent Roster + Telemetry + Science Queue + Copilot */}
        <div className="space-y-4">
          {/* Agent Status Selector List */}
          <div className="p-4 bg-atlas-surface border border-atlas-border shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-atlas-border pb-2">
              <div className="flex items-center space-x-2 text-atlas-text font-bold font-display">
                <Shield className="w-4 h-4 text-atlas-blue" />
                <span>Planetary Agent Roster</span>
              </div>
              <span className="text-[10px] text-atlas-muted">{agents.length} Deployed</span>
            </div>

            <div className="space-y-2">
              {agents.map((ag) => {
                const isSelected = ag.id === selectedAgentId;
                return (
                  <div
                    key={ag.id}
                    onClick={() => setSelectedAgentId(ag.id)}
                    className={`p-3 border cursor-pointer transition-all ${
                      isSelected
                        ? "bg-atlas-elevated border-atlas-accent shadow-md"
                        : "bg-atlas-elevated/60 border-atlas-border hover:border-atlas-border-light"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {ag.type === "ASTRONAUT" ? (
                          <User className="w-4 h-4 text-atlas-teal" />
                        ) : ag.type === "ORBITER" ? (
                          <Satellite className="w-4 h-4 text-atlas-violet" />
                        ) : (
                          <Bot className="w-4 h-4 text-atlas-amber" />
                        )}
                        <span className="font-bold text-atlas-text text-xs">{ag.callsign}</span>
                      </div>
                      <span
                        className={`px-2 py-0.5 text-[9px] font-bold uppercase border ${
                          ag.status === "EXECUTING"
                            ? "bg-atlas-surface text-atlas-teal border-atlas-teal"
                            : ag.status === "PAUSED"
                            ? "bg-atlas-surface text-atlas-amber border-atlas-amber"
                            : ag.status === "EMERGENCY"
                            ? "bg-atlas-surface text-atlas-red border-atlas-red"
                            : "bg-atlas-surface text-atlas-muted border-atlas-border"
                        }`}
                      >
                        {ag.status}
                      </span>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-atlas-muted">
                      <div>Battery: <b className="text-atlas-text">{ag.telemetry.batteryPercent}%</b></div>
                      <div>Speed: <b className="text-atlas-text">{ag.telemetry.speedKph} km/h</b></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Teleoperation Commands & Structured Capabilities for Selected Agent */}
          {selectedAgent && (
            <div className="p-4 bg-atlas-surface border border-atlas-border shadow-xl space-y-3">
              <div className="flex items-center justify-between border-b border-atlas-border pb-2">
                <div>
                  <span className="font-bold text-atlas-text font-display block">Teleoperations: {selectedAgent.callsign}</span>
                  <span className="text-[9px] text-atlas-muted">
                    Telemetry: <b className="text-atlas-amber">SIMULATED</b> | Updated: {new Date(selectedAgent.telemetry.lastHeartbeat).toLocaleTimeString()}
                  </span>
                </div>
                <span className="text-[10px] text-atlas-muted">Role: {selectedAgent.type}</span>
              </div>

              {/* Agent Status & Simulated Telemetry Controls */}
              <div className="p-2 bg-atlas-elevated border border-atlas-border space-y-2 text-[10px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-atlas-muted uppercase font-bold">Operational Status:</span>
                  <select
                    aria-label="Agent operational status"
                    value={selectedAgent.status}
                    onChange={(e) => handleAgentStatusChange(e.target.value)}
                    className="bg-atlas-surface border border-atlas-border text-atlas-text px-2 py-0.5 rounded font-bold"
                  >
                    <option value="IDLE">IDLE</option>
                    <option value="PLANNING">PLANNING</option>
                    <option value="EXECUTING">EXECUTING</option>
                    <option value="PAUSED">PAUSED</option>
                    <option value="RETURNING">RETURNING</option>
                    <option value="UNAVAILABLE">UNAVAILABLE (Auto-Reassign)</option>
                    <option value="COMMS_LOST">COMMS_LOST</option>
                    <option value="EMERGENCY">EMERGENCY</option>
                  </select>
                </div>
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-atlas-border">
                  <span className="text-atlas-muted">Simulated Telemetry:</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleSimulateTelemetryStep(-5)}
                      className="px-2 py-0.5 bg-atlas-surface hover:bg-atlas-bg border border-atlas-border text-atlas-amber font-bold rounded"
                    >
                      -5% Batt
                    </button>
                    <button
                      onClick={() => handleSimulateTelemetryStep(10)}
                      className="px-2 py-0.5 bg-atlas-surface hover:bg-atlas-bg border border-atlas-border text-atlas-teal font-bold rounded"
                    >
                      +10% Batt
                    </button>
                  </div>
                </div>
              </div>

              {selectedAgent.structuredCapabilities && (
                <div className="p-2 bg-atlas-elevated border border-atlas-border text-[9px] font-mono space-y-1">
                  <div className="text-atlas-muted uppercase tracking-wider font-bold">Structured Capabilities:</div>
                  <div className="grid grid-cols-2 gap-1 text-atlas-text">
                    <div>Max Slope: <b className="text-atlas-teal">{selectedAgent.structuredCapabilities.mobility.maxSlopeDeg}°</b></div>
                    <div>Speed: <b className="text-atlas-text">{selectedAgent.structuredCapabilities.mobility.speedKph} km/h</b></div>
                    <div>Drill: <b className={selectedAgent.structuredCapabilities.hasDrill ? "text-atlas-teal" : "text-atlas-muted"}>{selectedAgent.structuredCapabilities.hasDrill ? "YES" : "NO"}</b></div>
                    <div>Sample Tubes: <b className="text-atlas-blue">{selectedAgent.structuredCapabilities.sampleTubesRemaining}/{selectedAgent.structuredCapabilities.sampleTubeCapacity}</b></div>
                    <div>Relay Mast: <b className={selectedAgent.structuredCapabilities.communicationRelay.isRelay ? "text-atlas-amber" : "text-atlas-muted"}>{selectedAgent.structuredCapabilities.communicationRelay.isRelay ? `${selectedAgent.structuredCapabilities.communicationRelay.relayRangeKm}km` : "NO"}</b></div>
                    <div>Endurance: <b className="text-atlas-text">{selectedAgent.structuredCapabilities.enduranceMinutes} min</b></div>
                  </div>
                </div>
              )}

              {/* Active Assigned Task & Lifecycle Controls */}
              {taskFeedback && (
                <div className="p-2 bg-red-500/10 border border-red-500/40 text-red-300 text-[10px] rounded">
                  {taskFeedback}
                </div>
              )}

              {selectedAgent.currentTask ? (
                <div className="p-2.5 bg-atlas-elevated border border-atlas-border rounded text-[10px] font-mono space-y-1.5">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-atlas-text">{selectedAgent.currentTask.name}</span>
                    <div className="flex items-center gap-1">
                      <span className="px-1.5 py-0.2 rounded bg-atlas-surface border border-atlas-border text-atlas-teal font-bold">
                        {(selectedAgent.currentTask as any).status || "IN_PROGRESS"}
                      </span>
                      <span className="px-1.5 py-0.2 rounded bg-atlas-accent/20 text-atlas-accent font-bold">
                        {selectedAgent.currentTask.priority}
                      </span>
                    </div>
                  </div>
                  <div className="text-atlas-muted text-[9px]">
                    Est: {selectedAgent.currentTask.estimatedDurationMin}m | Target: ({selectedAgent.currentTask.target.coordinate.latitude.toFixed(3)}, {selectedAgent.currentTask.target.coordinate.longitude.toFixed(3)})
                  </div>
                  {selectedAgent.currentTask.dependencies && selectedAgent.currentTask.dependencies.length > 0 && (
                    <div className="text-[9px] text-amber-400">
                      Dependencies: {selectedAgent.currentTask.dependencies.join(", ")}
                    </div>
                  )}

                  {/* Task Lifecycle Transitions */}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {((selectedAgent.currentTask as any).status === "PENDING" || (selectedAgent.currentTask as any).status === "BLOCKED") && (
                      <button
                        onClick={() => handleTransitionTask(selectedAgent.currentTask!.id, "START")}
                        className="px-2 py-0.5 bg-atlas-teal text-white font-bold rounded text-[9px]"
                      >
                        Start Task
                      </button>
                    )}
                    {(selectedAgent.currentTask as any).status === "IN_PROGRESS" && (
                      <button
                        onClick={() => handleTransitionTask(selectedAgent.currentTask!.id, "PAUSE")}
                        className="px-2 py-0.5 bg-atlas-amber text-black font-bold rounded text-[9px]"
                      >
                        Pause Task
                      </button>
                    )}
                    {(selectedAgent.currentTask as any).status === "PAUSED" && (
                      <button
                        onClick={() => handleTransitionTask(selectedAgent.currentTask!.id, "RESUME")}
                        className="px-2 py-0.5 bg-atlas-teal text-white font-bold rounded text-[9px]"
                      >
                        Resume Task
                      </button>
                    )}
                    {((selectedAgent.currentTask as any).status === "IN_PROGRESS" || (selectedAgent.currentTask as any).status === "PAUSED") && (
                      <button
                        onClick={() => handleTransitionTask(selectedAgent.currentTask!.id, "COMPLETE")}
                        className="px-2 py-0.5 bg-emerald-600 text-white font-bold rounded text-[9px]"
                      >
                        Complete Task
                      </button>
                    )}
                    <button
                      onClick={() => handleTransitionTask(selectedAgent.currentTask!.id, "CANCEL")}
                      className="px-2 py-0.5 bg-atlas-surface border border-atlas-border text-atlas-muted hover:text-atlas-red font-bold rounded text-[9px]"
                    >
                      Cancel
                    </button>
                  </div>

                  <button
                    onClick={() => setIsTaskModalOpen(!isTaskModalOpen)}
                    className="w-full py-1 bg-atlas-elevated hover:bg-atlas-accent hover:text-white border border-atlas-border text-atlas-text font-bold text-[10px] rounded transition-colors"
                  >
                    {isTaskModalOpen ? "Close Reassignment" : "Reassign Task To Agent"}
                  </button>

                  {/* Reassignment Dropdown Panel */}
                  {isTaskModalOpen && (
                    <div className="p-2 bg-atlas-surface border border-atlas-border rounded space-y-2 mt-2">
                      <label className="text-[9px] text-atlas-muted uppercase block">Select Target Agent:</label>
                      <select
                        value={targetReassignAgentId}
                        onChange={(e) => setTargetReassignAgentId(e.target.value)}
                        className="w-full bg-atlas-elevated border border-atlas-border text-atlas-text text-[10px] p-1 rounded font-mono"
                      >
                        {agents.filter((a) => a.id !== selectedAgent.id).map((a) => (
                          <option key={a.id} value={a.callsign}>
                            {a.callsign} ({a.type} - Battery {a.telemetry.batteryPercent}%)
                          </option>
                        ))}
                      </select>

                      <label className="text-[9px] text-atlas-muted uppercase block">Operational Rationale:</label>
                      <input
                        type="text"
                        value={reassignReason}
                        onChange={(e) => setReassignReason(e.target.value)}
                        className="w-full bg-atlas-elevated border border-atlas-border text-atlas-text text-[10px] p-1 rounded font-mono"
                      />

                      <button
                        onClick={() => handleReassignTask(selectedAgent.currentTask!.id)}
                        disabled={isReassigning}
                        className="w-full py-1 bg-atlas-accent hover:bg-atlas-accent/90 disabled:opacity-50 text-white font-bold text-[10px] rounded"
                      >
                        {isReassigning ? "Executing Reassignment..." : "Confirm & Commit Reassignment"}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-2 bg-atlas-elevated border border-atlas-border rounded text-[10px] font-mono text-atlas-muted text-center space-y-2">
                  <div>No active task assigned. Agent standing by.</div>
                </div>
              )}

              {/* Assign New Task Drawer */}
              <div className="space-y-2">
                <button
                  onClick={() => setIsAssignOpen((v) => !v)}
                  className="w-full py-1.5 bg-atlas-elevated hover:bg-atlas-surface border border-atlas-border text-atlas-accent font-bold text-[10px] rounded transition-colors"
                >
                  {isAssignOpen ? "Close New Task Form" : "+ Assign New Task to Agent"}
                </button>
                {isAssignOpen && (
                  <form onSubmit={handleCreateTask} className="p-2.5 bg-atlas-elevated border border-atlas-border rounded space-y-2 text-[10px]">
                    <input
                      type="text"
                      required
                      placeholder="Task name (e.g. Core Sample Kodiak Rim)"
                      value={newTaskName}
                      onChange={(e) => setNewTaskName(e.target.value)}
                      className="w-full bg-atlas-surface border border-atlas-border text-atlas-text p-1.5 rounded"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={newTaskType}
                        onChange={(e) => setNewTaskType(e.target.value)}
                        className="bg-atlas-surface border border-atlas-border text-atlas-text p-1 rounded"
                      >
                        <option value="VERIFY_ROUTE">VERIFY_ROUTE</option>
                        <option value="SURVEY_TERRAIN">SURVEY_TERRAIN (Reqs TERRAIN_RECON)</option>
                        <option value="COLLECT_SCIENCE">COLLECT_SCIENCE (Reqs SPECTROMETER)</option>
                        <option value="RELAY_SIGNAL">RELAY_SIGNAL (Reqs COMM_RELAY)</option>
                        <option value="INSPECT_HAZARD">INSPECT_HAZARD</option>
                      </select>
                      <select
                        value={newTaskPriority}
                        onChange={(e) => setNewTaskPriority(e.target.value as any)}
                        className="bg-atlas-surface border border-atlas-border text-atlas-text p-1 rounded"
                      >
                        <option value="CRITICAL">CRITICAL</option>
                        <option value="HIGH">HIGH</option>
                        <option value="MEDIUM">MEDIUM</option>
                        <option value="LOW">LOW</option>
                      </select>
                    </div>
                    {opsTasks.length > 0 && (
                      <select
                        value={newTaskDepId}
                        onChange={(e) => setNewTaskDepId(e.target.value)}
                        className="w-full bg-atlas-surface border border-atlas-border text-atlas-text p-1 rounded"
                      >
                        <option value="">No Prerequisite Dependency</option>
                        {opsTasks.map((t) => (
                          <option key={t.id} value={t.id}>
                            Depends on: {t.name} ({t.status})
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      type="submit"
                      className="w-full py-1.5 bg-atlas-accent hover:bg-atlas-accent/90 text-white font-bold rounded"
                    >
                      Assign Task (Validate Capabilities & S1-S8)
                    </button>
                  </form>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => handleAgentCommand("PAUSE")}
                  className="p-2 bg-atlas-elevated hover:bg-atlas-surface text-atlas-amber border border-atlas-border font-bold text-[10px] transition-colors"
                >
                  Pause
                </button>
                <button
                  onClick={() => handleAgentCommand("RESUME")}
                  className="p-2 bg-atlas-elevated hover:bg-atlas-surface text-atlas-teal border border-atlas-border font-bold text-[10px] transition-colors"
                >
                  Resume
                </button>
                <button
                  onClick={() => handleAgentCommand("RETURN_TO_BASE")}
                  className="p-2 bg-atlas-elevated hover:bg-atlas-surface text-atlas-blue border border-atlas-border font-bold text-[10px] transition-colors"
                >
                  RTB
                </button>
              </div>
            </div>
          )}

          {/* Shared Science Queue */}
          <div className="p-4 bg-atlas-surface border border-atlas-border shadow-xl space-y-2">
            <div className="flex items-center justify-between border-b border-atlas-border pb-2">
              <div className="flex items-center space-x-2 text-atlas-text font-bold font-display">
                <Layers className="w-4 h-4 text-atlas-accent" />
                <span>Shared Science Queue</span>
              </div>
              <span className="text-[10px] text-atlas-muted">{scienceQueue.length} Targets</span>
            </div>

            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {scienceQueue.map((item) => (
                <div key={item.id} className="p-2 bg-atlas-elevated border border-atlas-border space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-atlas-text text-xs">{item.targetName}</span>
                    <span
                      className={`px-1.5 py-0.5 text-[8px] font-bold uppercase border ${
                        item.status === "COMPLETED"
                          ? "bg-atlas-surface text-atlas-teal border-atlas-teal"
                          : item.status === "ASSIGNED"
                          ? "bg-atlas-surface text-atlas-blue border-atlas-blue"
                          : "bg-atlas-surface text-atlas-muted border-atlas-border"
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <div className="text-[10px] text-atlas-muted">
                    Agent: <b className="text-atlas-text">{item.recommendedAgentCallsign}</b> | {item.requiredInstrument}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Operations Copilot Terminal */}
          <div className="p-4 bg-atlas-surface border border-atlas-border shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-atlas-border pb-2">
              <div className="flex items-center space-x-2 text-atlas-text font-bold font-display">
                <Sparkles className="w-4 h-4 text-atlas-blue" />
                <span>Operations Copilot</span>
              </div>
              <span className="text-[10px] text-atlas-teal font-mono">Assisted Reasoning</span>
            </div>

            <div className="flex space-x-2">
              <input
                type="text"
                value={copilotQuery}
                onChange={(e) => setCopilotQuery(e.target.value)}
                placeholder="Ask tactical copilot..."
                className="flex-1 bg-atlas-elevated border border-atlas-border p-2 text-xs text-atlas-text focus:outline-none focus:border-atlas-accent font-sans"
              />
              <button
                onClick={() => handleAskCopilot()}
                disabled={isCopilotLoading}
                className="px-3 bg-atlas-accent hover:bg-atlas-accent-dark text-white font-bold transition-colors disabled:opacity-40"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>

            {copilotResponse && (
              <div className="p-3 bg-atlas-elevated border border-atlas-border space-y-2 text-xs font-sans">
                <div className="text-atlas-text leading-relaxed">
                  {copilotResponse.assessment}
                </div>
                <div className="text-[11px] text-atlas-teal font-bold pt-1 border-t border-atlas-border">
                  Recommendation: {copilotResponse.recommendation}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
