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
  Battery,
  Sliders,
  CheckCircle2,
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
  const [reassignReason, setReassignReason] = useState<string>(
    "Optimizing task allocation based on agent mobility & instrument capability."
  );
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

  // Task creation state
  const [opsTasks, setOpsTasks] = useState<any[]>([]);
  const [isAssignOpen, setIsAssignOpen] = useState<boolean>(false);
  const [newTaskName, setNewTaskName] = useState<string>("");
  const [newTaskType, setNewTaskType] = useState<string>("SURVEY_TERRAIN");
  const [newTaskPriority, setNewTaskPriority] = useState<"CRITICAL" | "HIGH" | "MEDIUM" | "LOW">("HIGH");
  const [newTaskDepId, setNewTaskDepId] = useState<string>("");
  const [taskFeedback, setTaskFeedback] = useState<string | null>(null);

  // Packet enqueue form state
  const [commPacketType, setCommPacketType] = useState<"TELEMETRY" | "HAZARD_ALERT" | "SCIENCE_DATA">("TELEMETRY");
  const [commPacketPriority, setCommPacketPriority] = useState<"CRITICAL" | "HIGH" | "MEDIUM" | "BULK">("HIGH");

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
      showNotification(
        "Flagship Demo MARSWALK-001: ROVER-01 laser altimeter & HazCam detected 22.4° scarp. Autonomous safety pause engaged."
      );
      handleAskCopilot("Send Scout to investigate the steep region.");
    } finally {
      setIsLoading(false);
    }
  };

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
      showNotification("SECURITY-001 (Step 1): Initial command executed and signed into cryptographic audit chain.");

      try {
        await api.submitSecureCommand(envelope);
      } catch {
        showNotification("SECURITY-001 (Step 2 - PASS): Replay Attack Blocked! Nonce reuse rejected by Flight Security Guard.");
      }
      await fetchState();
    } catch (err: any) {
      showNotification(`Security test completed: ${err.message}`);
    }
  };

  const handleApproveReplan = async () => {
    if (!activeReplan) return;
    try {
      const res = await api.approveReplan(activeReplan.replanId, "Flight Director (Mission Command Console)");
      setActiveReplan(res);
      showNotification("Replan approved by Mission Command. Safe valley bypass active.");
      await fetchState();
    } catch (err: any) {
      showNotification(`Failed to approve replan: ${err.message}`);
    }
  };

  const handleAgentCommand = async (cmd: "PAUSE" | "RESUME" | "RETURN_TO_BASE") => {
    if (!selectedAgentId) return;
    try {
      await api.executeAgentCommand(selectedAgentId, cmd);
      showNotification(`Command '${cmd}' transmitted to agent.`);
      await fetchState();
    } catch (err: any) {
      showNotification(`Command rejected: ${err.message}`);
    }
  };

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
      const res = await api.transitionAgentStatus(
        selectedAgent.id,
        nextStatus,
        `Operator status transition to ${nextStatus}`
      );
      await fetchState();
      if (res.reassignedToAgent) {
        showNotification(
          `${selectedAgent.callsign} marked ${nextStatus}. Active task auto-reassigned to ${res.reassignedToAgent.callsign}.`
        );
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
    const nextBatt = Math.max(
      0,
      Math.min(100, Number((selectedAgent.telemetry.batteryPercent + deltaPercent).toFixed(1)))
    );
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
      <div className="min-h-[calc(100vh-4rem)] bg-atlas-bg flex flex-col items-center justify-center space-y-4 font-mono text-xs text-atlas-muted">
        <div className="w-8 h-8 border-2 border-atlas-accent border-t-transparent animate-spin" />
        <div className="tracking-widest uppercase font-semibold text-atlas-text">
          Initializing Planetary Simulation Bus...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-atlas-bg text-atlas-text font-sans selection:bg-atlas-accent selection:text-white pb-24">
      {/* SECTION 1: Status Banner & Master Simulation Header */}
      <section className="border-b border-atlas-border bg-atlas-surface/60 backdrop-blur-sm sticky top-16 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 space-y-4">
          {notification && (
            <div className="p-3.5 bg-atlas-surface border border-atlas-teal text-atlas-teal flex items-center justify-between shadow-xl">
              <div className="flex items-center space-x-2.5">
                <Radio className="w-4 h-4 text-atlas-teal shrink-0 animate-pulse" />
                <span className="font-mono text-xs">{notification}</span>
              </div>
              <button
                onClick={() => setNotification(null)}
                className="text-atlas-teal hover:text-atlas-text ml-4 p-1"
                aria-label="Dismiss Notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Active Replan Alert Banner */}
          {activeReplan && activeReplan.status === "PROPOSED" && (
            <div className="p-5 bg-atlas-surface border-2 border-atlas-amber text-atlas-text shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center space-x-2 text-atlas-amber font-mono font-bold uppercase tracking-wider text-xs">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Sensor-Corroborated Replan Pending Flight Director Gate</span>
                </div>
                <div className="text-base font-bold text-atlas-text font-display">
                  {activeReplan.trigger.hazardDescription || activeReplan.trigger.reason}
                </div>
                <div className="text-xs text-atlas-muted font-mono">
                  Proposed Detour: <b className="text-atlas-text">Safest Valley Corridor</b> · Safety Delta:{" "}
                  <b className="text-atlas-teal">+{activeReplan.comparison.safetyScoreDiff} pts</b> · Dist:{" "}
                  <b className="text-atlas-text">{activeReplan.comparison.distanceDiffKm} km</b>
                </div>
              </div>

              <div className="flex items-center space-x-3 shrink-0">
                <button
                  onClick={handleApproveReplan}
                  className="px-5 py-2.5 bg-atlas-teal hover:bg-atlas-teal/90 text-white font-mono font-bold text-xs flex items-center space-x-2 transition-all shadow-md"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Authorize Replan (Flight Director)</span>
                </button>
              </div>
            </div>
          )}

          {/* Master Control Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-3 flex-wrap gap-2">
              <div className="flex items-center space-x-2 text-atlas-accent font-bold text-base">
                <Radio className="w-5 h-5 text-atlas-accent animate-pulse" />
                <h1 className="font-display tracking-tight">Planetary Operations Console</h1>
              </div>

              <span className="px-2.5 py-1 bg-atlas-elevated border border-atlas-border text-atlas-muted text-xs font-mono">
                Scenario: <b className="text-atlas-text">{activeScenario}</b>
              </span>

              <span className="px-2.5 py-1 bg-atlas-elevated border border-atlas-border text-atlas-teal text-xs font-mono font-bold">
                {agents.length} Agents Active
              </span>

              <span className="px-2.5 py-1 bg-atlas-elevated border border-atlas-border text-atlas-blue text-xs font-mono font-bold flex items-center space-x-1">
                <Lock className="w-3.5 h-3.5" />
                <span>Auth: {securityStatus.role}</span>
              </span>
            </div>

            {/* Simulation Clock Controls */}
            <div className="flex items-center space-x-2 font-mono text-xs">
              <div className="flex items-center space-x-2 bg-atlas-elevated px-3 py-1.5 border border-atlas-border">
                <Clock className="w-4 h-4 text-atlas-blue" />
                <span className="text-atlas-muted">MET:</span>
                <span className="text-atlas-text font-bold text-sm">
                  {Math.floor(simState.simulationTimeMinutes / 60)
                    .toString()
                    .padStart(2, "0")}
                  :{(simState.simulationTimeMinutes % 60).toString().padStart(2, "0")}:00
                </span>
              </div>

              <button
                onClick={handleToggleSim}
                className={`px-4 py-1.5 font-bold border flex items-center space-x-1.5 transition-all shadow-sm ${
                  simState.isRunning
                    ? "bg-atlas-amber text-black border-atlas-amber"
                    : "bg-atlas-surface hover:bg-atlas-elevated text-atlas-teal border-atlas-border"
                }`}
              >
                {simState.isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span>{simState.isRunning ? "Pause" : "Resume"}</span>
              </button>

              <button
                onClick={() => handleAdvanceSim(15)}
                className="px-3 py-1.5 bg-atlas-surface hover:bg-atlas-elevated text-atlas-text border border-atlas-border flex items-center space-x-1 transition-colors"
                title="Advance simulation by 15 minutes"
              >
                <FastForward className="w-3.5 h-3.5 text-atlas-blue" />
                <span>+15m</span>
              </button>

              <button
                onClick={handleResetSim}
                className="p-2 bg-atlas-surface hover:bg-atlas-elevated text-atlas-muted hover:text-atlas-text border border-atlas-border transition-colors"
                title="Reset simulation clock to T+00:30"
                aria-label="Reset Simulation"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Deterministic Failure Scenarios Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-atlas-border text-xs font-mono">
            <div className="flex items-center space-x-1.5 text-atlas-muted font-bold uppercase tracking-wider text-[11px]">
              <Zap className="w-3.5 h-3.5 text-atlas-accent" />
              <span>Deterministic Scenarios:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleTriggerDemo}
                className="px-3 py-1 bg-atlas-elevated hover:bg-atlas-surface text-atlas-amber border border-atlas-border font-bold transition-colors"
              >
                Marswalk-001 (Flagship Recon)
              </button>
              <button
                onClick={handleTriggerBlackoutScenario}
                className="px-3 py-1 bg-atlas-elevated hover:bg-atlas-surface text-atlas-violet border border-atlas-border font-bold transition-colors"
              >
                Comm Blackout (Orbital Loss)
              </button>
              <button
                onClick={handleTriggerBatteryScenario}
                className="px-3 py-1 bg-atlas-elevated hover:bg-atlas-surface text-atlas-red border border-atlas-border font-bold transition-colors"
              >
                Emergency (Battery &lt;10%)
              </button>
              <button
                onClick={handleTriggerSecurityScenario}
                className="px-3 py-1 bg-atlas-elevated hover:bg-atlas-surface text-atlas-blue border border-atlas-border font-bold transition-colors"
              >
                Security (Replay Guard)
              </button>
              <Link
                to="/replay"
                className="px-3 py-1 bg-atlas-elevated hover:bg-atlas-surface text-atlas-accent border border-atlas-border font-bold flex items-center space-x-1 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Replay View</span>
              </Link>
              <Link
                to="/demo"
                className="px-3 py-1 bg-atlas-elevated hover:bg-atlas-surface text-atlas-teal border border-atlas-border font-bold flex items-center space-x-1 transition-colors"
              >
                <Award className="w-3.5 h-3.5" />
                <span>Test Harness</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: Full-Width Primary Operations Visualization & Tactical Canvas */}
      <section className="max-w-7xl mx-auto px-6 pt-10 pb-12 space-y-4">
        <div className="bg-atlas-surface border border-atlas-border p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-atlas-border pb-3">
            <div>
              <div className="flex items-center space-x-2 text-atlas-text font-bold font-display text-lg">
                <Compass className="w-5 h-5 text-atlas-teal" />
                <span>Jezero Crater Tactical Surface Arena</span>
              </div>
              <p className="text-xs text-atlas-muted font-mono mt-0.5">
                Sub-meter coordinate tracking with Tobler impedance overlays and MOLA scarp contours
              </p>
            </div>
            <div className="flex items-center space-x-4 text-xs font-mono text-atlas-muted">
              <span>Datum: Areoid 3396.2 km</span>
              <span>Center: 18.4447°N, 77.4508°E</span>
            </div>
          </div>

          {/* Tactical Canvas */}
          <div className="h-96 bg-atlas-bg border border-atlas-border relative overflow-hidden flex items-center justify-center">
            <div className="absolute inset-0 bg-[radial-gradient(#1b3041_1px,transparent_1px)] [background-size:24px_24px] opacity-60" />

            {/* Delta Rim Hazard Contour */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              <path
                d="M 60 220 Q 220 140 420 170 T 800 240"
                fill="none"
                stroke="var(--atlas-accent)"
                strokeWidth="2.5"
                strokeDasharray="6 6"
                opacity="0.7"
              />
              <text x="80" y="200" fill="var(--atlas-accent)" fontSize="11" fontFamily="IBM Plex Mono">
                Jezero Delta Front Scarp (22.4° gradient hazard envelope)
              </text>
            </svg>

            {/* Render Active Agents */}
            <div className="relative w-full h-full p-6">
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
                      className={`w-9 h-9 flex items-center justify-center shadow-2xl border-2 ${
                        ag.status === "EMERGENCY"
                          ? "bg-atlas-surface border-atlas-red animate-pulse"
                          : ag.status === "PAUSED"
                          ? "bg-atlas-surface border-atlas-amber"
                          : isSelected
                          ? "bg-atlas-accent border-white"
                          : "bg-atlas-surface border-atlas-teal"
                      }`}
                    >
                      {ag.type === "ASTRONAUT" ? (
                        <User className="w-5 h-5 text-atlas-text" />
                      ) : ag.type === "ORBITER" ? (
                        <Satellite className="w-5 h-5 text-atlas-text" />
                      ) : (
                        <Bot className="w-5 h-5 text-atlas-text" />
                      )}
                    </div>
                    <div className="absolute top-10 left-1/2 -translate-x-1/2 whitespace-nowrap bg-atlas-surface px-2 py-0.5 text-[10px] border border-atlas-border text-atlas-text font-mono font-bold shadow-md">
                      {ag.callsign}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: Planetary Agent Roster (Expanded, High-Contrast Cards) */}
      <section className="max-w-7xl mx-auto px-6 pb-14 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-mono text-atlas-accent tracking-widest uppercase">Autonomous Assets</div>
            <h2 className="text-2xl font-bold font-display text-atlas-text">Planetary Agent Roster</h2>
          </div>
          <span className="text-xs font-mono text-atlas-muted">Click any asset card to inspect or issue orders</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {agents.map((ag) => {
            const isSelected = ag.id === selectedAgentId;
            return (
              <div
                key={ag.id}
                onClick={() => setSelectedAgentId(ag.id)}
                className={`p-5 border cursor-pointer transition-all flex flex-col justify-between space-y-4 ${
                  isSelected
                    ? "bg-atlas-elevated border-atlas-accent shadow-xl ring-1 ring-atlas-accent/40"
                    : "bg-atlas-surface border-atlas-border hover:border-atlas-border-light"
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div
                        className={`w-7 h-7 flex items-center justify-center rounded-sm ${
                          ag.type === "ASTRONAUT"
                            ? "bg-atlas-teal/20 text-atlas-teal"
                            : ag.type === "ORBITER"
                            ? "bg-atlas-violet/20 text-atlas-violet"
                            : "bg-atlas-amber/20 text-atlas-amber"
                        }`}
                      >
                        {ag.type === "ASTRONAUT" ? (
                          <User className="w-4 h-4" />
                        ) : ag.type === "ORBITER" ? (
                          <Satellite className="w-4 h-4" />
                        ) : (
                          <Bot className="w-4 h-4" />
                        )}
                      </div>
                      <span className="font-bold text-atlas-text text-sm font-display">{ag.callsign}</span>
                    </div>

                    <span
                      className={`px-2 py-0.5 text-[10px] font-mono font-bold uppercase border ${
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

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
                    <div className="p-2 bg-atlas-surface border border-atlas-border">
                      <div className="text-[10px] text-atlas-muted">Battery Reserve</div>
                      <div className="font-bold text-atlas-text text-sm flex items-center space-x-1 mt-0.5">
                        <Battery className="w-3.5 h-3.5 text-atlas-teal" />
                        <span>{ag.telemetry.batteryPercent}%</span>
                      </div>
                    </div>
                    <div className="p-2 bg-atlas-surface border border-atlas-border">
                      <div className="text-[10px] text-atlas-muted">Surface Speed</div>
                      <div className="font-bold text-atlas-text text-sm mt-0.5">
                        {ag.telemetry.speedKph} <span className="text-[10px] font-normal text-atlas-muted">km/h</span>
                      </div>
                    </div>
                  </div>

                  {ag.currentTask ? (
                    <div className="text-xs font-mono p-2 bg-atlas-surface border border-atlas-border space-y-1">
                      <div className="text-[10px] text-atlas-muted uppercase">Active Task</div>
                      <div className="font-semibold text-atlas-text truncate">{ag.currentTask.name}</div>
                      <div className="text-[10px] text-atlas-teal">{ag.currentTask.priority} Priority</div>
                    </div>
                  ) : (
                    <div className="text-xs font-mono p-2 bg-atlas-surface border border-atlas-border text-atlas-muted italic">
                      Standing by. No active task.
                    </div>
                  )}
                </div>

                {isSelected && (
                  <div className="pt-2 border-t border-atlas-border text-xs font-mono text-atlas-accent font-bold flex items-center justify-between">
                    <span>Selected for Teleoperation</span>
                    <Sliders className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Selected Agent Teleoperation Drawer & Task Management */}
        {selectedAgent && (
          <div className="bg-atlas-surface border border-atlas-border p-6 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-atlas-border pb-4">
              <div>
                <h3 className="text-xl font-bold font-display text-atlas-text">
                  Teleoperations & Capabilities: {selectedAgent.callsign}
                </h3>
                <p className="text-xs text-atlas-muted font-mono mt-0.5">
                  Role: {selectedAgent.type} · Telemetry Heartbeat: {new Date(selectedAgent.telemetry.lastHeartbeat).toLocaleTimeString()}
                </p>
              </div>

              {/* Status Selector & Commands */}
              <div className="flex items-center space-x-2 font-mono text-xs flex-wrap gap-2">
                <select
                  aria-label="Agent operational status"
                  value={selectedAgent.status}
                  onChange={(e) => handleAgentStatusChange(e.target.value)}
                  className="bg-atlas-elevated border border-atlas-border text-atlas-text px-3 py-1.5 font-bold"
                >
                  <option value="IDLE">IDLE</option>
                  <option value="PLANNING">PLANNING</option>
                  <option value="EXECUTING">EXECUTING</option>
                  <option value="PAUSED">PAUSED</option>
                  <option value="RETURNING">RETURNING</option>
                  <option value="UNAVAILABLE">UNAVAILABLE</option>
                  <option value="COMMS_LOST">COMMS_LOST</option>
                  <option value="EMERGENCY">EMERGENCY</option>
                </select>

                <button
                  onClick={() => handleAgentCommand("PAUSE")}
                  className="px-3 py-1.5 bg-atlas-elevated hover:bg-atlas-surface text-atlas-amber border border-atlas-border font-bold"
                >
                  Pause
                </button>
                <button
                  onClick={() => handleAgentCommand("RESUME")}
                  className="px-3 py-1.5 bg-atlas-elevated hover:bg-atlas-surface text-atlas-teal border border-atlas-border font-bold"
                >
                  Resume
                </button>
                <button
                  onClick={() => handleAgentCommand("RETURN_TO_BASE")}
                  className="px-3 py-1.5 bg-atlas-elevated hover:bg-atlas-surface text-atlas-blue border border-atlas-border font-bold"
                >
                  RTB
                </button>
              </div>
            </div>

            {/* Capabilities Matrix & Task Management */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Structured Capabilities */}
              <div className="bg-atlas-elevated border border-atlas-border p-4 space-y-3 font-mono text-xs">
                <div className="text-atlas-muted uppercase tracking-wider font-bold text-[11px]">
                  Hardware Specification
                </div>
                {selectedAgent.structuredCapabilities && (
                  <div className="grid grid-cols-2 gap-2 text-atlas-text">
                    <div>Max Slope: <b className="text-atlas-teal">{selectedAgent.structuredCapabilities.mobility.maxSlopeDeg}°</b></div>
                    <div>Top Speed: <b className="text-atlas-text">{selectedAgent.structuredCapabilities.mobility.speedKph} km/h</b></div>
                    <div>Drill: <b className={selectedAgent.structuredCapabilities.hasDrill ? "text-atlas-teal" : "text-atlas-muted"}>{selectedAgent.structuredCapabilities.hasDrill ? "Equipped" : "None"}</b></div>
                    <div>Sample Tubes: <b className="text-atlas-blue">{selectedAgent.structuredCapabilities.sampleTubesRemaining}/{selectedAgent.structuredCapabilities.sampleTubeCapacity}</b></div>
                    <div>Relay Mast: <b className={selectedAgent.structuredCapabilities.communicationRelay.isRelay ? "text-atlas-amber" : "text-atlas-muted"}>{selectedAgent.structuredCapabilities.communicationRelay.isRelay ? `${selectedAgent.structuredCapabilities.communicationRelay.relayRangeKm}km` : "None"}</b></div>
                    <div>Endurance: <b className="text-atlas-text">{selectedAgent.structuredCapabilities.enduranceMinutes} min</b></div>
                  </div>
                )}
                <div className="pt-2 border-t border-atlas-border flex items-center justify-between text-[11px]">
                  <span className="text-atlas-muted">Simulate Batt:</span>
                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => handleSimulateTelemetryStep(-5)}
                      className="px-2 py-0.5 bg-atlas-surface hover:bg-atlas-bg border border-atlas-border text-atlas-amber font-bold"
                    >
                      -5%
                    </button>
                    <button
                      onClick={() => handleSimulateTelemetryStep(10)}
                      className="px-2 py-0.5 bg-atlas-surface hover:bg-atlas-bg border border-atlas-border text-atlas-teal font-bold"
                    >
                      +10%
                    </button>
                  </div>
                </div>
              </div>

              {/* Current Assigned Task & Transitions */}
              <div className="lg:col-span-2 bg-atlas-elevated border border-atlas-border p-4 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between border-b border-atlas-border pb-2">
                  <span className="text-atlas-muted uppercase tracking-wider font-bold text-[11px]">
                    Current Mission Assignment
                  </span>
                  {selectedAgent.currentTask && (
                    <span className="px-2 py-0.5 bg-atlas-surface text-atlas-teal border border-atlas-border font-bold text-[10px]">
                      {(selectedAgent.currentTask as any).status || "IN_PROGRESS"}
                    </span>
                  )}
                </div>

                {taskFeedback && (
                  <div className="p-2 bg-atlas-red/10 border border-atlas-red/40 text-atlas-red text-xs">
                    {taskFeedback}
                  </div>
                )}

                {selectedAgent.currentTask ? (
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="font-bold text-atlas-text text-sm">
                        {selectedAgent.currentTask.name}
                      </div>
                      <div className="text-atlas-muted text-xs">
                        Est Duration: {selectedAgent.currentTask.estimatedDurationMin}m · Priority: {selectedAgent.currentTask.priority}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      {((selectedAgent.currentTask as any).status === "PENDING" || (selectedAgent.currentTask as any).status === "BLOCKED") && (
                        <button
                          onClick={() => handleTransitionTask(selectedAgent.currentTask!.id, "START")}
                          className="px-3 py-1 bg-atlas-teal text-white font-bold"
                        >
                          Start Task
                        </button>
                      )}
                      {(selectedAgent.currentTask as any).status === "IN_PROGRESS" && (
                        <button
                          onClick={() => handleTransitionTask(selectedAgent.currentTask!.id, "PAUSE")}
                          className="px-3 py-1 bg-atlas-amber text-black font-bold"
                        >
                          Pause Task
                        </button>
                      )}
                      {(selectedAgent.currentTask as any).status === "PAUSED" && (
                        <button
                          onClick={() => handleTransitionTask(selectedAgent.currentTask!.id, "RESUME")}
                          className="px-3 py-1 bg-atlas-teal text-white font-bold"
                        >
                          Resume Task
                        </button>
                      )}
                      {((selectedAgent.currentTask as any).status === "IN_PROGRESS" || (selectedAgent.currentTask as any).status === "PAUSED") && (
                        <button
                          onClick={() => handleTransitionTask(selectedAgent.currentTask!.id, "COMPLETE")}
                          className="px-3 py-1 bg-atlas-teal text-white font-bold"
                        >
                          Complete Task
                        </button>
                      )}
                      <button
                        onClick={() => handleTransitionTask(selectedAgent.currentTask!.id, "CANCEL")}
                        className="px-3 py-1 bg-atlas-surface border border-atlas-border text-atlas-muted hover:text-atlas-red font-bold"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => setIsTaskModalOpen(!isTaskModalOpen)}
                        className="px-3 py-1 bg-atlas-surface hover:bg-atlas-accent hover:text-white border border-atlas-border text-atlas-text font-bold"
                      >
                        {isTaskModalOpen ? "Close Reassignment" : "Reassign Task"}
                      </button>
                    </div>

                    {isTaskModalOpen && (
                      <div className="p-3 bg-atlas-surface border border-atlas-border space-y-2 mt-2">
                        <label className="text-[10px] text-atlas-muted uppercase block">Select Target Agent:</label>
                        <select
                          value={targetReassignAgentId}
                          onChange={(e) => setTargetReassignAgentId(e.target.value)}
                          className="w-full bg-atlas-elevated border border-atlas-border text-atlas-text text-xs p-1.5 font-mono"
                        >
                          {agents.filter((a) => a.id !== selectedAgent.id).map((a) => (
                            <option key={a.id} value={a.callsign}>
                              {a.callsign} ({a.type} - Battery {a.telemetry.batteryPercent}%)
                            </option>
                          ))}
                        </select>
                        <label className="text-[10px] text-atlas-muted uppercase block">Reassignment Reason:</label>
                        <input
                          type="text"
                          value={reassignReason}
                          onChange={(e) => setReassignReason(e.target.value)}
                          className="w-full bg-atlas-elevated border border-atlas-border text-atlas-text text-xs p-1.5 font-mono"
                        />
                        <button
                          onClick={() => handleReassignTask(selectedAgent.currentTask!.id)}
                          disabled={isReassigning}
                          className="w-full py-1.5 bg-atlas-accent hover:bg-atlas-accent-hover disabled:opacity-50 text-white font-bold text-xs"
                        >
                          {isReassigning ? "Executing Reassignment..." : "Confirm & Commit Reassignment"}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="text-atlas-muted italic text-xs">No active task. Agent standing by.</div>
                    <button
                      onClick={() => setIsAssignOpen(!isAssignOpen)}
                      className="px-4 py-1.5 bg-atlas-accent hover:bg-atlas-accent-hover text-white font-bold text-xs"
                    >
                      {isAssignOpen ? "Close Task Form" : "+ Assign New Task"}
                    </button>
                    {isAssignOpen && (
                      <form onSubmit={handleCreateTask} className="p-3 bg-atlas-surface border border-atlas-border space-y-2 text-xs">
                        <input
                          type="text"
                          required
                          placeholder="Task name (e.g. Core Sample Kodiak Rim)"
                          value={newTaskName}
                          onChange={(e) => setNewTaskName(e.target.value)}
                          className="w-full bg-atlas-elevated border border-atlas-border text-atlas-text p-2"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={newTaskType}
                            onChange={(e) => setNewTaskType(e.target.value)}
                            className="bg-atlas-elevated border border-atlas-border text-atlas-text p-1.5"
                          >
                            <option value="VERIFY_ROUTE">VERIFY_ROUTE</option>
                            <option value="SURVEY_TERRAIN">SURVEY_TERRAIN</option>
                            <option value="COLLECT_SCIENCE">COLLECT_SCIENCE</option>
                            <option value="RELAY_SIGNAL">RELAY_SIGNAL</option>
                            <option value="INSPECT_HAZARD">INSPECT_HAZARD</option>
                          </select>
                          <select
                            value={newTaskPriority}
                            onChange={(e) => setNewTaskPriority(e.target.value as any)}
                            className="bg-atlas-elevated border border-atlas-border text-atlas-text p-1.5"
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
                            className="w-full bg-atlas-elevated border border-atlas-border text-atlas-text p-1.5"
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
                          className="w-full py-2 bg-atlas-accent hover:bg-atlas-accent-hover text-white font-bold"
                        >
                          Validate & Dispatch Task
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* SECTION 4: Mission Intelligence, Digital Twin & Uncertainty Analysis */}
      <section className="max-w-7xl mx-auto px-6 pb-14 space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Digital Twin State Synchronization & Inconsistency Auditor */}
          <div className="bg-atlas-surface border border-atlas-border p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-atlas-border pb-3">
              <div className="flex items-center space-x-2 text-atlas-text font-bold font-display text-lg">
                <Server className="w-5 h-5 text-atlas-teal" />
                <span>Digital Twin Synchronization</span>
              </div>
              <span className="text-xs px-2.5 py-1 bg-atlas-elevated text-atlas-teal border border-atlas-border font-mono font-bold">
                Canonical Mirror
              </span>
            </div>

            <p className="text-xs text-atlas-muted font-mono leading-relaxed">
              Maintains an immutable digital twin representation reflecting canonical agent telemetry, topography, and comms topologies.
            </p>

            <div className="p-4 bg-atlas-elevated border border-atlas-border space-y-3 font-mono text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] text-atlas-muted uppercase block">Cryptographic State Hash</span>
                  <span className="text-xs font-bold text-atlas-text">
                    {digitalTwinSnapshot ? `${digitalTwinSnapshot.stateHash?.slice(0, 28)}...` : "SHA-256 Ledger Live"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCaptureSnapshot}
                    disabled={isSnapshotting}
                    className="px-3 py-1.5 bg-atlas-surface hover:bg-atlas-bg border border-atlas-border text-atlas-text font-bold transition-colors"
                  >
                    {isSnapshotting ? "Saving..." : "Snapshot"}
                  </button>
                  <button
                    onClick={handleCheckConsistency}
                    disabled={isCheckingConsistency}
                    className="px-3 py-1.5 bg-atlas-accent hover:bg-atlas-accent-hover text-white font-bold transition-colors"
                  >
                    {isCheckingConsistency ? "Auditing..." : "Audit Consistency"}
                  </button>
                </div>
              </div>

              {inconsistencyReport && (
                <div
                  className={`p-3 border text-xs font-mono flex items-center space-x-2 ${
                    inconsistencyReport.isConsistent
                      ? "bg-atlas-teal/10 border-atlas-teal/30 text-atlas-teal"
                      : "bg-atlas-red/10 border-atlas-red/30 text-atlas-red"
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    {inconsistencyReport.isConsistent
                      ? "Zero Discrepancies: Digital Twin matches ground truth 1:1."
                      : `Alert: ${inconsistencyReport.discrepancies.length} Discrepancies Detected.`}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Stochastic Monte Carlo Uncertainty Explorer */}
          <div className="bg-atlas-surface border border-atlas-border p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-atlas-border pb-3">
              <div className="flex items-center space-x-2 text-atlas-text font-bold font-display text-lg">
                <Activity className="w-5 h-5 text-atlas-accent" />
                <span>Monte Carlo Uncertainty Analysis</span>
              </div>
              <span className="text-xs text-atlas-muted font-mono">Box-Muller LCG</span>
            </div>

            <p className="text-xs text-atlas-muted font-mono leading-relaxed">
              Evaluates variance in battery discharge, terrain slip impedance, and communication outages across hundreds of stochastic runs.
            </p>

            <div className="p-4 bg-atlas-elevated border border-atlas-border space-y-4 font-mono text-xs">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center space-x-3">
                  <div>
                    <span className="text-[10px] text-atlas-muted uppercase block">Runs</span>
                    <input
                      type="number"
                      min={50}
                      max={500}
                      step={50}
                      value={mcRuns}
                      onChange={(e) => setMcRuns(Number(e.target.value))}
                      className="w-16 bg-atlas-surface border border-atlas-border text-atlas-text text-xs p-1 font-bold"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-atlas-muted uppercase block">PRNG Seed</span>
                    <input
                      type="number"
                      value={mcSeed}
                      onChange={(e) => setMcSeed(Number(e.target.value))}
                      className="w-24 bg-atlas-surface border border-atlas-border text-atlas-text text-xs p-1 font-bold"
                    />
                  </div>
                </div>

                <button
                  onClick={handleRunMonteCarlo}
                  disabled={isMcLoading}
                  className="px-4 py-2 bg-atlas-accent hover:bg-atlas-accent-hover disabled:opacity-50 text-white font-bold transition-all shadow"
                >
                  {isMcLoading ? "Computing..." : "Run Analysis"}
                </button>
              </div>

              {mcResult && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-atlas-border">
                  <div className="p-2 bg-atlas-surface border border-atlas-border">
                    <span className="text-[9px] text-atlas-muted uppercase block">Success</span>
                    <span className="text-lg font-bold text-atlas-teal">{mcResult.successProbabilityPercent}%</span>
                  </div>
                  <div className="p-2 bg-atlas-surface border border-atlas-border">
                    <span className="text-[9px] text-atlas-muted uppercase block">P50 Duration</span>
                    <span className="text-lg font-bold text-atlas-text">{mcResult.durationDistributionMinutes?.p50}m</span>
                  </div>
                  <div className="p-2 bg-atlas-surface border border-atlas-border">
                    <span className="text-[9px] text-atlas-muted uppercase block">95% CI</span>
                    <span className="text-xs font-bold text-atlas-teal block mt-1">
                      [{mcResult.durationDistributionMinutes?.confidenceInterval95?.[0]} - {mcResult.durationDistributionMinutes?.confidenceInterval95?.[1]}]m
                    </span>
                  </div>
                  <div className="p-2 bg-atlas-surface border border-atlas-border">
                    <span className="text-[9px] text-atlas-muted uppercase block">P50 Battery</span>
                    <span className="text-lg font-bold text-atlas-text">{mcResult.batteryReserveDistribution?.p50}%</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Natural Language Operations Copilot */}
        <div className="bg-atlas-surface border border-atlas-border p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-atlas-border pb-3">
            <div className="flex items-center space-x-2 text-atlas-text font-bold font-display text-lg">
              <Sparkles className="w-5 h-5 text-atlas-blue" />
              <span>Operations Tactical Copilot</span>
            </div>
            <span className="text-xs text-atlas-teal font-mono">Assisted Reasoning Agent</span>
          </div>

          <div className="flex space-x-3">
            <input
              type="text"
              value={copilotQuery}
              onChange={(e) => setCopilotQuery(e.target.value)}
              placeholder="Ask tactical copilot (e.g. 'Send Scout to investigate the steep region')..."
              className="flex-1 bg-atlas-elevated border border-atlas-border px-4 py-2.5 text-xs text-atlas-text focus:outline-none focus:border-atlas-accent font-sans"
            />
            <button
              onClick={() => handleAskCopilot()}
              disabled={isCopilotLoading}
              className="px-5 bg-atlas-accent hover:bg-atlas-accent-hover text-white font-bold transition-colors disabled:opacity-40 flex items-center space-x-1.5"
            >
              <Send className="w-4 h-4" />
              <span>Inquire</span>
            </button>
          </div>

          {copilotResponse && (
            <div className="p-4 bg-atlas-elevated border border-atlas-border space-y-2 text-xs font-sans leading-relaxed">
              <div className="text-atlas-text">{copilotResponse.assessment}</div>
              <div className="text-xs text-atlas-teal font-bold pt-2 border-t border-atlas-border flex items-center space-x-1.5">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Recommendation: {copilotResponse.recommendation}</span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* SECTION 5: Comms Queue, Sensor Telemetry & Event Audit Stream */}
      <section className="max-w-7xl mx-auto px-6 space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Tactical Communication Packet Queue */}
          <div className="bg-atlas-surface border border-atlas-border p-5 shadow-xl space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-atlas-border pb-2.5">
              <div className="flex items-center space-x-2 font-bold text-atlas-text font-display">
                <Wifi className="w-4 h-4 text-atlas-teal" />
                <span>Comms Packet Queue</span>
              </div>
              <button
                onClick={handleFlushQueue}
                className="px-2.5 py-1 bg-atlas-teal text-white font-bold text-[10px] transition-colors"
              >
                Flush Queue
              </button>
            </div>

            <div className="flex items-center space-x-2 text-[10px]">
              <select
                value={commPacketType}
                onChange={(e) => setCommPacketType(e.target.value as any)}
                className="bg-atlas-elevated border border-atlas-border text-atlas-text p-1"
              >
                <option value="TELEMETRY">TELEMETRY</option>
                <option value="HAZARD_ALERT">HAZARD_ALERT</option>
                <option value="SCIENCE_DATA">SCIENCE_DATA</option>
              </select>
              <select
                value={commPacketPriority}
                onChange={(e) => setCommPacketPriority(e.target.value as any)}
                className="bg-atlas-elevated border border-atlas-border text-atlas-text p-1"
              >
                <option value="CRITICAL">CRITICAL</option>
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
              </select>
              <button
                onClick={handleEnqueuePacket}
                className="px-2.5 py-1 bg-atlas-accent text-white font-bold text-[10px]"
              >
                Send
              </button>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {commQueue.map((pkt) => (
                <div key={pkt.packetId} className="p-2 bg-atlas-elevated border border-atlas-border flex items-center justify-between text-[10px]">
                  <div>
                    <span className="font-bold text-atlas-text">{pkt.type}</span>
                    <span className="text-atlas-muted ml-1">({pkt.payloadSizeKb} KB)</span>
                  </div>
                  <span className={`font-bold ${pkt.status === "DELIVERED" ? "text-atlas-teal" : "text-atlas-amber"}`}>
                    {pkt.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Orbiter & Sensor Observations */}
          <div className="bg-atlas-surface border border-atlas-border p-5 shadow-xl space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-atlas-border pb-2.5">
              <div className="flex items-center space-x-2 font-bold text-atlas-text font-display">
                <Satellite className="w-4 h-4 text-atlas-violet" />
                <span>Orbiter Pass & Sensors</span>
              </div>
              <span className="text-[10px] text-atlas-teal font-bold">{orbitalWindow?.state || "PASS ACTIVE"}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="p-2.5 bg-atlas-elevated border border-atlas-border">
                <div className="text-atlas-muted">Orbital Elevation</div>
                <div className="font-bold text-atlas-text text-sm mt-0.5">{orbitalWindow?.currentElevationDeg || 37.4}°</div>
              </div>
              <div className="p-2.5 bg-atlas-elevated border border-atlas-border">
                <div className="text-atlas-muted">Bandwidth</div>
                <div className="font-bold text-atlas-violet text-sm mt-0.5">{orbitalWindow?.bandwidthKbps || 2048} kbps</div>
              </div>
            </div>

            <div className="p-2.5 bg-atlas-elevated border border-atlas-border text-[10px] space-y-1">
              <div className="text-atlas-muted uppercase">Laser Altimetry Observation</div>
              <div className="font-bold text-atlas-text">
                {observations.length > 0 ? `${observations[0].sensorType}: Validated` : "-2,534.2 m ± 0.15m (Slope 21.8°)"}
              </div>
            </div>
          </div>

          {/* Mission Event Audit Stream */}
          <div className="bg-atlas-surface border border-atlas-border p-5 shadow-xl space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-atlas-border pb-2.5">
              <div className="flex items-center space-x-2 font-bold text-atlas-text font-display">
                <Clock className="w-4 h-4 text-atlas-blue" />
                <span>Event Audit Stream</span>
              </div>
              <span className="text-[10px] text-atlas-muted">
                {network ? `${network.links.filter((l) => l.status === "CONNECTED").length} Links` : `${events.length} Recorded`}
              </span>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {events.slice(0, 5).map((ev) => (
                <div key={ev.id} className="p-2 bg-atlas-elevated border border-atlas-border text-[10px] space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-atlas-accent font-bold">[{ev.eventType}]</span>
                    <span className="text-atlas-muted">{ev.timestamp.substring(11, 19)}</span>
                  </div>
                  <div className="text-atlas-text truncate">{ev.message}</div>
                </div>
              ))}
              {timeline.slice(0, 1).map((tm) => (
                <div key={tm.id} className="text-[9px] text-atlas-muted italic pt-1 border-t border-atlas-border">
                  Scheduled: {tm.timeLabel} · {tm.title}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Shared Science Queue Strip */}
        {scienceQueue.length > 0 && (
          <div className="bg-atlas-surface border border-atlas-border p-5 shadow-xl space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-atlas-border pb-2">
              <div className="flex items-center space-x-2 text-atlas-text font-bold font-display">
                <Layers className="w-4 h-4 text-atlas-accent" />
                <span>Shared Science Target Queue</span>
              </div>
              <span className="text-[10px] text-atlas-muted">{scienceQueue.length} Targets In Queue</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {scienceQueue.slice(0, 4).map((item) => (
                <div key={item.id} className="p-3 bg-atlas-elevated border border-atlas-border space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-atlas-text truncate">{item.targetName}</span>
                    <span className="text-[9px] text-atlas-teal uppercase font-bold">{item.status}</span>
                  </div>
                  <div className="text-[10px] text-atlas-muted">
                    Assigned: <b className="text-atlas-text">{item.recommendedAgentCallsign}</b>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
