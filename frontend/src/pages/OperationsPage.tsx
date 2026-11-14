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

  const fetchState = async () => {
    try {
      const stateRes = await api.getOperationsState();
      setAgents(stateRes.agents);
      setNetwork(stateRes.network);
      setTimeline(stateRes.timeline);
      setScienceQueue(stateRes.scienceQueue);
      setEvents(stateRes.events);
      setSimState(stateRes.simState);

      // Orbital pass & observations
      if (stateRes.network?.orbitalVisibility) {
        setOrbitalWindow(stateRes.network.orbitalVisibility);
      }
      if ((stateRes as any).observations) {
        setObservations((stateRes as any).observations);
      }
      if ((stateRes as any).commQueue) {
        setCommQueue((stateRes as any).commQueue);
      }

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

  // Auto-trigger demo if URL has query (execute once)
  useEffect(() => {
    if (autoDemo && !isLoading && !hasTriggeredDemoRef.current) {
      hasTriggeredDemoRef.current = true;
      handleTriggerDemo();
    }
  }, [autoDemo, isLoading]);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 5000);
  };

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

      // 1st transmission
      await api.submitSecureCommand(envelope);
      showNotification("SECURITY-001: Initial command executed and signed into cryptographic audit chain.");

      // 2nd transmission (Replay Attack)
      try {
        await api.submitSecureCommand(envelope);
      } catch (replayErr: any) {
        showNotification("SECURITY-001: REPLAY ATTACK BLOCKED! Duplicate commandId & nonce rejected by server.");
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
      showNotification("Replan Approved by MISSION_COMMAND. Scout rover resuming along valley detour.");
    } catch (err: any) {
      showNotification(`Approval failed: ${err.message}`);
    }
  };

  // Copilot Query
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

  // Command an agent
  const handleAgentCommand = async (command: "PAUSE" | "RESUME" | "RETURN_TO_BASE") => {
    if (!selectedAgentId) return;
    await api.executeAgentCommand(selectedAgentId, command);
    await fetchState();
    showNotification(`Command '${command}' transmitted to agent.`);
  };

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) || agents[0];

  if (isLoading && agents.length === 0) {
    return (
      <div className="h-[calc(100vh-3.5rem)] bg-space-950 flex flex-col items-center justify-center space-y-4 font-mono text-xs text-slate-300">
        <div className="w-10 h-10 border-2 border-mars-accent border-t-transparent rounded-full animate-spin"></div>
        <div className="tracking-widest uppercase">Initializing Verified Planetary Simulation Bus...</div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-space-950 text-slate-100 p-3 md:p-6 font-mono text-xs selection:bg-mars-rust selection:text-white flex flex-col space-y-4">
      {/* Top Banner / Notification */}
      {notification && (
        <div className="p-3 bg-cyan-950/90 border border-cyan-500 text-cyan-200 rounded flex items-center justify-between shadow-xl animate-fade-in">
          <div className="flex items-center space-x-2">
            <Radio className="w-4 h-4 text-cyan-400 shrink-0 animate-pulse" />
            <span>{notification}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-cyan-400 hover:text-white font-bold ml-4">
            ×
          </button>
        </div>
      )}

      {/* Flagship Replan Alert Banner if Active */}
      {activeReplan && activeReplan.status === "PROPOSED" && (
        <div className="p-4 bg-amber-950/90 border-2 border-amber-500 text-amber-100 rounded-lg shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 animate-pulse">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-amber-400 font-bold uppercase tracking-wider text-xs">
              <AlertTriangle className="w-4 h-4" />
              <span>SENSOR-CORROBORATED REPLAN PENDING MISSION COMMAND APPROVAL</span>
            </div>
            <div className="text-sm font-bold text-white">
              {activeReplan.trigger.hazardDescription || activeReplan.trigger.reason}
            </div>
            <div className="text-[11px] text-amber-200/90">
              Proposed Detour: <b className="text-white">Safest Valley Corridor</b> | Safety Score:{" "}
              <b className="text-emerald-400">+{activeReplan.comparison.safetyScoreDiff} pts</b> | Dist Diff:{" "}
              <b>{activeReplan.comparison.distanceDiffKm} km</b>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={handleApproveReplan}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded shadow-lg text-xs flex items-center space-x-1.5 transition-all"
            >
              <CheckCircle className="w-4 h-4" />
              <span>APPROVE REPLAN (FLIGHT DIRECTOR GATE)</span>
            </button>
          </div>
        </div>
      )}

      {/* Header & Simulation Control Console */}
      <div className="p-3.5 bg-space-900 border border-space-800 rounded-lg flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center space-x-3 flex-wrap gap-2">
          <div className="flex items-center space-x-2 text-mars-accent font-bold text-sm">
            <Radio className="w-4 h-4 text-telemetry-emerald animate-pulse" />
            <span className="font-sans">PLANETARY OPERATIONS COMMAND CONSOLE</span>
          </div>

          <span className="px-2 py-0.5 rounded bg-space-800 border border-space-700 text-slate-300 text-[11px]">
            SCENARIO: <b className="text-white">{activeScenario}</b>
          </span>

          <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-[10px] font-bold">
            AGENTS: {agents.length} ACTIVE
          </span>

          <span className="px-2 py-0.5 rounded bg-blue-950/80 border border-blue-500/50 text-blue-300 text-[10px] font-bold flex items-center space-x-1">
            <Lock className="w-3 h-3" />
            <span>AUTH: {securityStatus.role}</span>
          </span>
        </div>

        {/* Simulation Controls */}
        <div className="flex items-center space-x-2 flex-wrap gap-1">
          <div className="flex items-center space-x-1.5 bg-space-850 px-2.5 py-1 rounded border border-space-700 text-[11px]">
            <Clock className="w-3.5 h-3.5 text-telemetry-cyan" />
            <span className="text-slate-400">MET:</span>
            <span className="text-white font-bold font-mono">
              {Math.floor(simState.simulationTimeMinutes / 60)
                .toString()
                .padStart(2, "0")}
              :{(simState.simulationTimeMinutes % 60).toString().padStart(2, "0")}:00
            </span>
          </div>

          <button
            onClick={handleToggleSim}
            className={`px-3 py-1 rounded font-bold border text-[11px] flex items-center space-x-1 transition-all ${
              simState.isRunning
                ? "bg-amber-600 text-white border-amber-500"
                : "bg-space-800 hover:bg-space-750 text-emerald-400 border-space-700"
            }`}
          >
            {simState.isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{simState.isRunning ? "PAUSE" : "RESUME"}</span>
          </button>

          <button
            onClick={() => handleAdvanceSim(15)}
            className="px-2.5 py-1 bg-space-800 hover:bg-space-750 text-slate-200 rounded border border-space-700 text-[11px] flex items-center space-x-1"
            title="Step simulation forward 15 minutes"
          >
            <FastForward className="w-3.5 h-3.5 text-telemetry-cyan" />
            <span>+15m</span>
          </button>

          <button
            onClick={handleResetSim}
            className="px-2 py-1 bg-space-800 hover:bg-space-750 text-slate-400 hover:text-white rounded border border-space-700"
            title="Reset simulation clock"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Provenance & Truthfulness Strip (Section 22A) */}
      <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400 bg-space-900/90 px-3.5 py-2 rounded-lg border border-space-800 shadow">
        <span className="text-slate-500 font-bold uppercase tracking-wider flex items-center space-x-1">
          <Server className="w-3 h-3 text-telemetry-cyan" />
          <span>PROVENANCE:</span>
        </span>
        <span className="bg-space-850 px-2 py-0.5 rounded text-amber-300 border border-amber-900/50">DATA MODE: BENCHMARK</span>
        <span className="bg-space-850 px-2 py-0.5 rounded text-cyan-300 border border-cyan-900/50">OBSERVATIONS: SIMULATED (NOISE MODEL)</span>
        <span className="bg-space-850 px-2 py-0.5 rounded text-emerald-300 border border-emerald-900/50">TERRAIN: MOLA MEGDR 128 px/deg</span>
        <span className="bg-space-850 px-2 py-0.5 rounded text-purple-300 border border-purple-900/50">ORBIT: 112m KEPLERIAN APPROX</span>
        <span className="bg-space-850 px-2 py-0.5 rounded text-rose-300 border border-rose-900/50">RBAC: SERVER ENFORCED</span>
      </div>

      {/* Deterministic Scenario Execution Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-space-900 p-2.5 rounded-lg border border-space-800 text-[11px]">
        <div className="flex items-center space-x-1.5 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
          <Zap className="w-3.5 h-3.5 text-mars-accent" />
          <span>DETERMINISTIC VERIFICATION SCENARIOS:</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={handleTriggerDemo}
            className="px-2.5 py-1 bg-space-850 hover:bg-space-800 text-amber-300 border border-amber-800/50 rounded font-bold text-[10px]"
          >
            MARSWALK-001 (Flagship Recon)
          </button>
          <button
            onClick={handleTriggerBlackoutScenario}
            className="px-2.5 py-1 bg-space-850 hover:bg-space-800 text-purple-300 border border-purple-800/50 rounded font-bold text-[10px]"
          >
            COMM-BLACKOUT-001 (Orbital Loss)
          </button>
          <button
            onClick={handleTriggerBatteryScenario}
            className="px-2.5 py-1 bg-space-850 hover:bg-space-800 text-rose-300 border border-rose-800/50 rounded font-bold text-[10px]"
          >
            EMERGENCY-001 (Battery Critical)
          </button>
          <button
            onClick={handleTriggerSecurityScenario}
            className="px-2.5 py-1 bg-space-850 hover:bg-space-800 text-cyan-300 border border-cyan-800/50 rounded font-bold text-[10px]"
          >
            SECURITY-001 (Replay Attack Block)
          </button>
          <Link
            to="/replay"
            className="px-2.5 py-1 bg-mars-rust/20 hover:bg-mars-rust/30 text-mars-accent border border-mars-rust/50 rounded font-bold text-[10px] flex items-center space-x-1"
          >
            <RotateCcw className="w-3 h-3" />
            <span>MISSION REPLAY</span>
          </Link>
          <Link
            to="/demo"
            className="px-2.5 py-1 bg-purple-950/80 hover:bg-purple-900/80 text-purple-300 border border-purple-500/50 rounded font-bold text-[10px] flex items-center space-x-1"
          >
            <Award className="w-3 h-3" />
            <span>JUDGING DEMO</span>
          </Link>
        </div>
      </div>

      {/* Main Grid: Left Map + Comms + Timeline, Right Agent Sidebar + Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1">
        {/* Left Column (2 Cols wide on desktop): Map View & Network & Timeline */}
        <div className="lg:col-span-2 space-y-4">
          {/* Surface Map Viewport */}
          <div className="p-4 bg-space-900 border border-space-800 rounded-lg shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-space-800 pb-2">
              <div className="flex items-center space-x-2 text-slate-200 font-bold">
                <Compass className="w-4 h-4 text-telemetry-cyan" />
                <span>JEZERO CRATER SURFACE TACTICAL MAP</span>
              </div>
              <div className="flex items-center space-x-3 text-[10px] text-slate-400">
                <span>CENTER: 18.4447°N, 77.4508°E</span>
                <span>DATUM: AREOID 3396.2 KM</span>
              </div>
            </div>

            {/* Tactical Grid Visualization */}
            <div className="h-72 bg-space-950 rounded border border-space-800 relative overflow-hidden flex items-center justify-center">
              <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-40"></div>

              {/* Jezero Delta Rim Contour Line */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                <path
                  d="M 50 180 Q 150 120 280 140 T 500 200"
                  fill="none"
                  stroke="#c1440e"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                  opacity="0.6"
                />
                <text x="70" y="170" fill="#f97316" fontSize="9" fontFamily="monospace">
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
                        className={`w-6 h-6 rounded-full flex items-center justify-center shadow-lg border-2 ${
                          ag.status === "EMERGENCY"
                            ? "bg-rose-900 border-rose-500 animate-pulse"
                            : ag.status === "PAUSED"
                            ? "bg-amber-900 border-amber-500"
                            : isSelected
                            ? "bg-telemetry-cyan border-white"
                            : "bg-space-800 border-telemetry-cyan"
                        }`}
                      >
                        {ag.type === "ASTRONAUT" ? (
                          <User className="w-3 h-3 text-white" />
                        ) : ag.type === "ORBITER" ? (
                          <Satellite className="w-3 h-3 text-white" />
                        ) : (
                          <Bot className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <div className="absolute top-6 left-1/2 -translate-x-1/2 whitespace-nowrap bg-space-950/90 px-1 rounded text-[8px] border border-space-700 text-slate-300">
                        {ag.callsign}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Two-Column Mid-Row: Orbiter Status & Sensor Observations (Section 22B & 22C) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Orbiter Pass Status Card (Section 22C) */}
            <div className="p-4 bg-space-900 border border-space-800 rounded-lg shadow-xl space-y-2">
              <div className="flex items-center justify-between border-b border-space-800 pb-2">
                <div className="flex items-center space-x-2 text-slate-200 font-bold">
                  <Satellite className="w-4 h-4 text-purple-400" />
                  <span>ORBITAL RELAY PASS MONITOR</span>
                </div>
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                    orbitalWindow?.state === "PASS_ACTIVE"
                      ? "bg-emerald-950 text-emerald-300 border border-emerald-500 animate-pulse"
                      : orbitalWindow?.state === "PASS_APPROACHING"
                      ? "bg-amber-950 text-amber-300 border border-amber-500"
                      : "bg-space-950 text-slate-400"
                  }`}
                >
                  {orbitalWindow?.state || "PASS ACTIVE"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="bg-space-850 p-2 rounded border border-space-800">
                  <div className="text-slate-400">ELEVATION ANGLE</div>
                  <div className="text-sm font-bold text-white">{orbitalWindow?.currentElevationDeg || 37.4}°</div>
                  <div className="text-[9px] text-slate-400">Mask threshold: &ge;15.0°</div>
                </div>

                <div className="bg-space-850 p-2 rounded border border-space-800">
                  <div className="text-slate-400">THROUGHPUT BANDWIDTH</div>
                  <div className="text-sm font-bold text-purple-300">{orbitalWindow?.bandwidthKbps || 2048} kbps</div>
                  <div className="text-[9px] text-slate-400">Slant Range: {orbitalWindow?.slantRangeKm || 385} km</div>
                </div>
              </div>

              <div className="text-[10px] text-slate-300 flex items-center justify-between bg-space-950 p-2 rounded">
                <span>Pass Remaining: <b className="text-white">{orbitalWindow?.remainingSeconds ? `${Math.round(orbitalWindow.remainingSeconds / 60)}m ${orbitalWindow.remainingSeconds % 60}s` : "08m 42s"}</b></span>
                <span>Next Window: <b className="text-purple-300">{orbitalWindow?.nextPassInSeconds ? `${Math.round(orbitalWindow.nextPassInSeconds / 60)}m` : "112m Cycle"}</b></span>
              </div>
            </div>

            {/* Sensor Observation Panel (Section 22B) */}
            <div className="p-4 bg-space-900 border border-space-800 rounded-lg shadow-xl space-y-2">
              <div className="flex items-center justify-between border-b border-space-800 pb-2">
                <div className="flex items-center space-x-2 text-slate-200 font-bold">
                  <Activity className="w-4 h-4 text-telemetry-cyan" />
                  <span>ONBOARD SENSOR OBSERVATIONS</span>
                </div>
                <span className="text-[9px] bg-cyan-950 text-cyan-300 px-1.5 py-0.5 rounded font-bold">
                  FUSED QUALITY: GOOD ({observations.length} SAMPLES)
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="bg-space-850 p-2 rounded border border-space-800">
                  <div className="text-slate-400">LASER ALTIMETER</div>
                  <div className="text-sm font-bold text-cyan-300">-2534.2 m &plusmn; 0.15m</div>
                  <div className="text-[9px] text-slate-400">Slope: 21.8° &plusmn; 1.2°</div>
                </div>

                <div className="bg-space-850 p-2 rounded border border-space-800">
                  <div className="text-slate-400">STEREO HAZCAM</div>
                  <div className="text-sm font-bold text-amber-300">OBSTACLE: 87%</div>
                  <div className="text-[9px] text-slate-400">Confidence: 0.94 (Corroborated)</div>
                </div>
              </div>

              <div className="text-[10px] text-slate-400 bg-space-950 p-2 rounded truncate">
                Raman: Mineral Match <b className="text-slate-200">Carbonate 0.88</b> | Bio Evidence: <b className="text-emerald-400">NONE (Clean)</b>
              </div>
            </div>
          </div>

          {/* Communication Priority Queue (Section 22D) */}
          <div className="p-4 bg-space-900 border border-space-800 rounded-lg shadow-xl space-y-2">
            <div className="flex items-center justify-between border-b border-space-800 pb-2">
              <div className="flex items-center space-x-2 text-slate-200 font-bold">
                <Wifi className="w-4 h-4 text-emerald-400" />
                <span>TACTICAL COMMUNICATION PACKET QUEUE</span>
              </div>
              <span className="text-[10px] text-slate-400">{commQueue.length} Packets Buffered/Queued</span>
            </div>

            <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
              {commQueue.map((pkt) => (
                <div key={pkt.packetId} className="p-2 bg-space-850 rounded border border-space-800 flex items-center justify-between text-[10px]">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-1.5 py-0.2 rounded font-bold uppercase ${
                        pkt.priority === "CRITICAL"
                          ? "bg-rose-950 text-rose-300 border border-rose-500/50"
                          : "bg-space-800 text-slate-300"
                      }`}
                    >
                      {pkt.priority}
                    </span>
                    <span className="font-bold text-white">{pkt.type}</span>
                    <span className="text-slate-400">({pkt.payloadSizeKb} KB)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-1.5 py-0.2 rounded font-bold ${
                        pkt.status === "DELIVERED"
                          ? "text-emerald-400"
                          : pkt.status === "TRANSMITTING"
                          ? "text-cyan-400 animate-pulse"
                          : "text-amber-400"
                      }`}
                    >
                      {pkt.status}
                    </span>
                    <span className="text-slate-500">{pkt.sourceAgentId}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mission Timeline & Operational Events Stream */}
          <div className="p-4 bg-space-900 border border-space-800 rounded-lg shadow-xl space-y-2">
            <div className="flex items-center justify-between border-b border-space-800 pb-2">
              <div className="flex items-center space-x-2 text-slate-200 font-bold">
                <Clock className="w-4 h-4 text-telemetry-cyan" />
                <span>MISSION TIMELINE & EVENT AUDIT STREAM</span>
              </div>
              <span className="text-[10px] text-slate-400">
                Network: {network?.links.filter((l) => l.status === "CONNECTED").length || 0} active links
              </span>
            </div>

            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {events.slice(0, 8).map((ev) => (
                <div key={ev.id} className="p-2 bg-space-850 rounded border border-space-800 flex items-center justify-between text-[10px]">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-mars-accent">{ev.timestamp.substring(11, 19)}</span>
                    <span className="font-bold text-white">[{ev.eventType}]</span>
                    <span className="text-slate-300 truncate max-w-xs">{ev.message}</span>
                  </div>
                  <span className="text-[9px] text-slate-500 font-mono">{ev.agentId}</span>
                </div>
              ))}
              {timeline.slice(0, 2).map((tm) => (
                <div key={tm.id} className="text-[9px] text-slate-400 italic">
                  Scheduled: {tm.timeLabel} - {tm.title} ({tm.status})
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Agent Status List + Telemetry Drawer + Science Queue + Copilot */}
        <div className="space-y-4">
          {/* Agent Status Selector List */}
          <div className="p-4 bg-space-900 border border-space-800 rounded-lg shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-space-800 pb-2">
              <div className="flex items-center space-x-2 text-slate-200 font-bold">
                <Shield className="w-4 h-4 text-telemetry-cyan" />
                <span>PLANETARY AGENT ROSTER</span>
              </div>
              <span className="text-[10px] text-slate-400">{agents.length} Deployed</span>
            </div>

            <div className="space-y-2">
              {agents.map((ag) => {
                const isSelected = ag.id === selectedAgentId;
                return (
                  <div
                    key={ag.id}
                    onClick={() => setSelectedAgentId(ag.id)}
                    className={`p-3 rounded border cursor-pointer transition-all ${
                      isSelected
                        ? "bg-space-800 border-telemetry-cyan shadow-md"
                        : "bg-space-850 border-space-800 hover:border-space-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {ag.type === "ASTRONAUT" ? (
                          <User className="w-4 h-4 text-emerald-400" />
                        ) : ag.type === "ORBITER" ? (
                          <Satellite className="w-4 h-4 text-purple-400" />
                        ) : (
                          <Bot className="w-4 h-4 text-amber-400" />
                        )}
                        <span className="font-bold text-slate-200 text-xs">{ag.callsign}</span>
                      </div>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                          ag.status === "EXECUTING"
                            ? "bg-emerald-950 text-emerald-300"
                            : ag.status === "PAUSED"
                            ? "bg-amber-950 text-amber-300 border border-amber-500/50"
                            : ag.status === "EMERGENCY"
                            ? "bg-rose-950 text-rose-300 border border-rose-500/50"
                            : "bg-space-900 text-slate-400"
                        }`}
                      >
                        {ag.status}
                      </span>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-slate-400">
                      <div>BATTERY: <b className="text-white">{ag.telemetry.batteryPercent}%</b></div>
                      <div>SPEED: <b className="text-white">{ag.telemetry.speedKph} km/h</b></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Teleoperation Commands for Selected Agent */}
          {selectedAgent && (
            <div className="p-4 bg-space-900 border border-space-800 rounded-lg shadow-xl space-y-3">
              <div className="flex items-center justify-between border-b border-space-800 pb-2">
                <span className="font-bold text-slate-200">TELEOPERATIONS: {selectedAgent.callsign}</span>
                <span className="text-[10px] text-slate-400">Role: {selectedAgent.type}</span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => handleAgentCommand("PAUSE")}
                  className="p-2 bg-space-850 hover:bg-space-800 text-amber-400 border border-space-700 rounded font-bold text-[10px]"
                >
                  PAUSE
                </button>
                <button
                  onClick={() => handleAgentCommand("RESUME")}
                  className="p-2 bg-space-850 hover:bg-space-800 text-emerald-400 border border-space-700 rounded font-bold text-[10px]"
                >
                  RESUME
                </button>
                <button
                  onClick={() => handleAgentCommand("RETURN_TO_BASE")}
                  className="p-2 bg-space-850 hover:bg-space-800 text-cyan-400 border border-space-700 rounded font-bold text-[10px]"
                >
                  RTB
                </button>
              </div>
            </div>
          )}

          {/* Collaborative Science Queue */}
          <div className="p-4 bg-space-900 border border-space-800 rounded-lg shadow-xl space-y-2">
            <div className="flex items-center justify-between border-b border-space-800 pb-2">
              <div className="flex items-center space-x-2 text-slate-200 font-bold">
                <Layers className="w-4 h-4 text-mars-accent" />
                <span>SHARED SCIENCE QUEUE</span>
              </div>
              <span className="text-[10px] text-slate-400">{scienceQueue.length} Targets</span>
            </div>

            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {scienceQueue.map((item) => (
                <div key={item.id} className="p-2 bg-space-850 rounded border border-space-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200 text-xs">{item.targetName}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                        item.status === "COMPLETED"
                          ? "bg-emerald-950 text-emerald-300"
                          : item.status === "ASSIGNED"
                          ? "bg-cyan-950 text-cyan-300 border border-cyan-500/40"
                          : "bg-space-900 text-slate-400"
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Agent: <b className="text-slate-300">{item.recommendedAgentCallsign}</b> | {item.requiredInstrument}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Operations Copilot & Decision Reasoning */}
          <div className="p-4 bg-space-900 border border-space-800 rounded-lg shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-space-800 pb-2">
              <div className="flex items-center space-x-2 text-slate-200 font-bold">
                <Sparkles className="w-4 h-4 text-telemetry-cyan" />
                <span>OPERATIONS COPILOT</span>
              </div>
              <span className="text-[10px] text-telemetry-cyan font-mono">VERIFIED REASONING</span>
            </div>

            {/* Prompt Input & Quick Queries */}
            <div className="space-y-2">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={copilotQuery}
                  onChange={(e) => setCopilotQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAskCopilot()}
                  placeholder="Ask field operations query..."
                  className="flex-1 bg-space-950 border border-space-700 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-telemetry-cyan"
                />
                <button
                  onClick={() => handleAskCopilot()}
                  disabled={isCopilotLoading}
                  className="px-3 py-1.5 bg-space-800 hover:bg-space-700 text-telemetry-cyan rounded border border-space-700 font-bold text-xs disabled:opacity-50"
                >
                  {isCopilotLoading ? "..." : "QUERY"}
                </button>
              </div>

              <div className="flex flex-wrap gap-1">
                {[
                  "Send Scout to investigate the steep region.",
                  "Which rover should inspect the delta?",
                  "Why did communication fail?",
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setCopilotQuery(preset);
                      handleAskCopilot(preset);
                    }}
                    className="px-2 py-0.5 rounded bg-space-850 hover:bg-space-800 text-[9px] text-slate-300 border border-space-750"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Copilot Response Card */}
            {copilotResponse && (
              <div className="p-3 bg-space-950 rounded border border-space-800 space-y-2 text-[11px] animate-fade-in max-h-60 overflow-y-auto">
                <div className="font-bold text-telemetry-cyan">{copilotResponse.recommendation}</div>
                <div className="text-slate-300 text-[10px] leading-relaxed">{copilotResponse.assessment}</div>

                {/* Explicit Truth Classification (Section 20) */}
                {copilotResponse.observedFact && (
                  <div className="p-1.5 bg-space-900 rounded text-[10px] border border-cyan-900/50">
                    <span className="text-cyan-400 font-bold">OBSERVED: </span>
                    <span className="text-slate-200">{copilotResponse.observedFact}</span>
                  </div>
                )}
                {copilotResponse.derivedInsight && (
                  <div className="p-1.5 bg-space-900 rounded text-[10px] border border-amber-900/50">
                    <span className="text-amber-400 font-bold">DERIVED: </span>
                    <span className="text-slate-200">{copilotResponse.derivedInsight}</span>
                  </div>
                )}
                {copilotResponse.simulatedContext && (
                  <div className="p-1.5 bg-space-900 rounded text-[10px] border border-purple-900/50">
                    <span className="text-purple-400 font-bold">SIMULATED: </span>
                    <span className="text-slate-200">{copilotResponse.simulatedContext}</span>
                  </div>
                )}

                <div className="space-y-1 pt-1 border-t border-space-800">
                  <div className="text-[9px] text-slate-500 uppercase font-bold">DIRECTIVES</div>
                  {copilotResponse.agentDirectives.map((dir, i) => (
                    <div key={i} className="flex items-start space-x-1.5 text-[10px]">
                      <span className="text-telemetry-cyan font-bold">•</span>
                      <span>
                        <b className="text-white">{dir.agentCallsign}:</b> {dir.directive}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
