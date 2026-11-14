import React, { useEffect, useState, useRef } from "react";
import { api } from "../services/api.js";
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  SkipBack,
  Activity,
  Layers,
  HelpCircle,
  GitBranch,
  AlertTriangle,
  Compass,
} from "lucide-react";

export const MissionReplayPage: React.FC = () => {
  const [replayState, setReplayState] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [filterAgent, setFilterAgent] = useState<string>("ALL");
  const [filterType, setFilterType] = useState<string>("ALL");

  // What-If Drawer & Decision Lineage
  const [showWhatIf, setShowWhatIf] = useState<boolean>(false);
  const [whatIfResult, setWhatIfResult] = useState<any>(null);
  const [selectedDecision, setSelectedDecision] = useState<string>("IGNORE_HAZARD");
  const [showLineage, setShowLineage] = useState<boolean>(false);
  const [lineageData, setLineageData] = useState<any>(null);
  const [provenanceModal, setProvenanceModal] = useState<any>(null);

  const playbackTimerRef = useRef<any>(null);

  const fetchState = async () => {
    try {
      const res = await api.getReplayState("MARSWALK-001");
      setReplayState(res.state);
      setSummary(res.summary);
      setEvents(res.events || []);
      setIsLoading(false);
    } catch (err) {
      console.error("Failed to load replay state", err);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchState();
  }, []);

  // Playback loop
  useEffect(() => {
    if (isPlaying) {
      playbackTimerRef.current = setInterval(async () => {
        try {
          const updated = await api.stepReplay("FORWARD");
          setReplayState(updated);
          if (updated.status === "COMPLETED") {
            setIsPlaying(false);
          }
        } catch {
          setIsPlaying(false);
        }
      }, 1500);
    } else {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    }
    return () => {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    };
  }, [isPlaying]);

  const handleTogglePlay = async () => {
    if (isPlaying) {
      const state = await api.resetReplay();
      setIsPlaying(false);
      setReplayState(state);
    } else {
      const state = await api.startReplay("MARSWALK-001");
      setIsPlaying(true);
      setReplayState(state);
    }
  };

  const handleStep = async (dir: "FORWARD" | "BACKWARD") => {
    setIsPlaying(false);
    const updated = await api.stepReplay(dir);
    setReplayState(updated);
  };

  const handleReset = async () => {
    setIsPlaying(false);
    const updated = await api.resetReplay();
    setReplayState(updated);
  };

  const handleSeek = async (val: number) => {
    setIsPlaying(false);
    const updated = await api.seekReplay(val);
    setReplayState(updated);
  };

  const handleRunWhatIf = async () => {
    try {
      const res = await api.runWhatIf({
        baselineMissionId: "MARSWALK-001",
        decisionOverride: selectedDecision,
        forkSimTimeMinutes: 18,
      });
      setWhatIfResult(res);
      setShowWhatIf(true);
    } catch (err) {
      console.error("Failed to execute what-if simulation", err);
    }
  };

  const handleInspectLineage = async (eventId: string = "evt-flagship-detour") => {
    try {
      const res = await api.getDecisionLineage(eventId);
      setLineageData(res);
      setShowLineage(true);
    } catch (err) {
      console.error("Failed to fetch decision lineage", err);
    }
  };

  const handleOpenProvenance = async (key: string, val: string) => {
    try {
      const res = await api.getProvenance(key, val);
      setProvenanceModal(res);
    } catch (err) {
      console.error("Failed to fetch provenance", err);
    }
  };

  const curEvent = replayState?.currentEvent;
  const curSimTime = replayState?.currentSimTimeSeconds || 0;
  const metFormatted = `MET 00:${String(Math.floor(curSimTime / 60)).padStart(2, "0")}:${String(curSimTime % 60).padStart(2, "0")}`;

  const filteredEvents = events.filter((e) => {
    if (filterAgent !== "ALL" && e.actor !== filterAgent && e.agentId !== filterAgent) return false;
    if (filterType !== "ALL" && e.eventType !== filterType) return false;
    return true;
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-space-950 text-slate-100 flex items-center justify-center font-mono">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-amber-500 animate-spin" />
          <span>RECONSTRUCTING DIGITAL TWIN MISSION LEDGER...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-space-950 text-slate-100 font-sans p-6 pb-24">
      {/* Top Header Bar */}
      <div className="max-w-7xl mx-auto mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-space-800 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-wider font-mono text-white flex items-center gap-2">
              <RotateCcw className="w-6 h-6 text-amber-500" />
              PLANETARY MISSION REPLAY & DIGITAL TWIN
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded font-mono font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
              IMMUTABLE EVENT STREAM
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded font-mono font-semibold bg-space-800 text-slate-300 border border-space-700">
              REPRODUCIBLE
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            MISSION: MARSWALK-001 | {summary?.totalRecordedEvents || events.length} EVENTS RECORDED | JEZERO CRATER DELTA RECONNAISSANCE | DIGITAL TWIN STATE RESTORATION
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleInspectLineage("evt-flagship-detour")}
            className="px-3 py-1.5 text-xs font-mono font-semibold rounded bg-space-800 hover:bg-space-700 text-slate-200 border border-space-700 flex items-center gap-1.5 transition-colors"
          >
            <HelpCircle className="w-4 h-4 text-cyan-400" />
            Decision Lineage
          </button>
          <button
            onClick={handleRunWhatIf}
            className="px-3 py-1.5 text-xs font-mono font-semibold rounded bg-amber-600 hover:bg-amber-500 text-space-950 font-bold flex items-center gap-1.5 shadow transition-colors"
          >
            <GitBranch className="w-4 h-4" />
            What-If Analysis
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Replay Controls & Current Event */}
        <div className="lg:col-span-2 space-y-6">
          {/* Main Scrubber Card */}
          <div className="bg-space-900 border border-space-800 rounded-lg p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-xs text-slate-400 font-mono uppercase tracking-wider">Mission Elapsed Time</span>
                <div className="text-3xl font-extrabold font-mono text-amber-400 tracking-wider">
                  {metFormatted}
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400 font-mono uppercase">Replay Status</span>
                <div className="flex items-center gap-2 justify-end mt-0.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${isPlaying ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
                  <span className="text-sm font-mono font-bold">{replayState?.status}</span>
                </div>
              </div>
            </div>

            {/* Timeline Slider */}
            <div className="space-y-2 mb-6">
              <input
                type="range"
                min="0"
                max={Math.max(1, (events.length - 1))}
                value={replayState?.currentEventIndex || 0}
                onChange={(e) => handleSeek(Number(e.target.value))}
                className="w-full h-2 bg-space-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <div className="flex justify-between text-xs text-slate-400 font-mono">
                <span>EVENT #0 (GENESIS)</span>
                <span>EVENT #{replayState?.currentEventIndex || 0} OF {events.length - 1}</span>
                <span>COMPLETION</span>
              </div>
            </div>

            {/* Playback Button Bar */}
            <div className="flex items-center justify-center gap-3 border-t border-space-800 pt-4">
              <button
                onClick={handleReset}
                title="Reset Replay"
                className="p-2.5 rounded bg-space-800 hover:bg-space-700 text-slate-300 transition-colors"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
              <button
                onClick={() => handleStep("BACKWARD")}
                title="Step Backward"
                className="p-2.5 rounded bg-space-800 hover:bg-space-700 text-slate-300 transition-colors"
              >
                <SkipBack className="w-5 h-5" />
              </button>
              <button
                onClick={handleTogglePlay}
                title={isPlaying ? "Pause" : "Play"}
                className="px-6 py-2.5 rounded bg-amber-500 hover:bg-amber-400 text-space-950 font-bold flex items-center gap-2 shadow-lg transition-transform active:scale-95"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                <span className="font-mono">{isPlaying ? "PAUSE" : "PLAY REPLAY"}</span>
              </button>
              <button
                onClick={() => handleStep("FORWARD")}
                title="Step Forward"
                className="p-2.5 rounded bg-space-800 hover:bg-space-700 text-slate-300 transition-colors"
              >
                <SkipForward className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Current Event Telemetry Card */}
          <div className="bg-space-900 border border-space-800 rounded-lg p-5">
            <div className="flex items-center justify-between pb-3 border-b border-space-800 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-mono font-bold">
                  EVENT {replayState?.currentEventIndex + 1}
                </span>
                <span className="text-sm font-mono font-semibold text-white">
                  {curEvent?.eventType || "MISSION_EVENT"}
                </span>
              </div>
              <span className="text-xs font-mono text-slate-400">
                ACTOR: {curEvent?.actor || "SYSTEM"}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 text-xs font-mono">
                <div className="text-slate-400">TIMESTAMP (UTC):</div>
                <div className="text-slate-200 bg-space-950 p-2 rounded border border-space-800">
                  {curEvent?.timestamp || "N/A"}
                </div>
              </div>
              <div className="space-y-2 text-xs font-mono">
                <div className="text-slate-400">PREVIOUS EVENT HASH (SHA-256):</div>
                <div className="text-slate-400 bg-space-950 p-2 rounded border border-space-800 truncate" title={curEvent?.previousEventHash}>
                  {curEvent?.previousEventHash || "GENESIS"}
                </div>
              </div>
            </div>

            {/* Event Payload */}
            <div className="mt-4">
              <span className="text-xs font-mono text-slate-400 uppercase">Event Payload & Evidence:</span>
              <pre className="mt-1.5 p-3 rounded bg-space-950 text-slate-300 text-xs font-mono border border-space-800 overflow-x-auto">
                {JSON.stringify(curEvent?.payload || {}, null, 2)}
              </pre>
            </div>

            {/* Sensor & Decision Details */}
            {curEvent?.eventType === "HAZARD_DETECTED" && (
              <div className="mt-4 p-3 bg-red-950/40 border border-red-800 rounded flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div className="text-xs font-mono">
                  <div className="text-red-300 font-bold">CORROBORATED ESCARPMENT HAZARD CONFIRMED</div>
                  <div className="text-slate-300 mt-1">
                    Stereo HazCam (21.8° ± 1.1°) and Laser Altimeter independently corroborated slope violation exceeding vehicle 20.0° threshold.
                  </div>
                  <button
                    onClick={() => handleOpenProvenance("slope", "21.8°")}
                    className="text-amber-400 hover:text-amber-300 underline mt-2 flex items-center gap-1"
                  >
                    Why do we believe this? (View Provenance)
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Reconstructed Replay Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-space-900 border border-space-800 rounded p-3 text-center">
              <div className="text-xs font-mono text-slate-400">BATTERY DRAIN</div>
              <div className="text-lg font-mono font-bold text-amber-400 mt-1">
                {replayState?.metrics?.batteryDepletedPercent?.toFixed(1) || "0.0"}%
              </div>
            </div>
            <div className="bg-space-900 border border-space-800 rounded p-3 text-center">
              <div className="text-xs font-mono text-slate-400">HAZARDS ENCOUNTERED</div>
              <div className="text-lg font-mono font-bold text-slate-200 mt-1">
                {replayState?.metrics?.hazardsEncountered || 0}
              </div>
            </div>
            <div className="bg-space-900 border border-space-800 rounded p-3 text-center">
              <div className="text-xs font-mono text-slate-400">HAZARDS AVOIDED</div>
              <div className="text-lg font-mono font-bold text-emerald-400 mt-1">
                {replayState?.metrics?.hazardsAvoided || 0}
              </div>
            </div>
            <div className="bg-space-900 border border-space-800 rounded p-3 text-center">
              <div className="text-xs font-mono text-slate-400">SCIENCE YIELD</div>
              <div className="text-lg font-mono font-bold text-cyan-400 mt-1">
                {replayState?.metrics?.scienceYieldScore || 0} PTS
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Reconstructed Multi-Agent Fleet & Event Stream */}
        <div className="space-y-6">
          {/* Reconstructed Fleet Card */}
          <div className="bg-space-900 border border-space-800 rounded-lg p-5">
            <div className="flex items-center justify-between pb-3 border-b border-space-800 mb-4">
              <div className="flex items-center gap-2">
                <Compass className="w-5 h-5 text-amber-500" />
                <h3 className="font-mono font-bold text-sm text-white">RECONSTRUCTED FLEET</h3>
              </div>
              <span className="text-xs font-mono text-slate-400">
                {replayState?.agents?.length || 0} ACTIVE
              </span>
            </div>

            <div className="space-y-3">
              {replayState?.agents?.map((agent: any) => (
                <div key={agent.id} className="p-3 bg-space-950 border border-space-800 rounded flex items-center justify-between">
                  <div>
                    <div className="text-xs font-mono font-bold text-slate-200">{agent.callsign || agent.name}</div>
                    <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                      POS: {agent.position?.latitude?.toFixed(4)}°, {agent.position?.longitude?.toFixed(4)}°
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                      agent.status === "EXECUTING" ? "bg-emerald-950 text-emerald-400 border border-emerald-800" :
                      agent.status === "PAUSED" ? "bg-amber-950 text-amber-400 border border-amber-800" :
                      "bg-space-800 text-slate-400"
                    }`}>
                      {agent.status}
                    </span>
                    <div className="text-[11px] font-mono text-amber-400 mt-1">
                      BAT: {agent.telemetry?.batteryPercent || 85}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Event Stream Filter & List */}
          <div className="bg-space-900 border border-space-800 rounded-lg p-5">
            <div className="flex items-center justify-between pb-3 border-b border-space-800 mb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-cyan-400" />
                <h3 className="font-mono font-bold text-sm text-white">HISTORICAL EVENTS</h3>
              </div>
              <span className="text-xs font-mono text-slate-400">
                {filteredEvents.length} RECORDED
              </span>
            </div>

            {/* Filter pills */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-space-950 text-slate-200 border border-space-800 text-xs font-mono rounded px-2 py-1 w-full"
              >
                <option value="ALL">All Event Types</option>
                <option value="MISSION_STARTED">MISSION_STARTED</option>
                <option value="SENSOR_OBSERVATION">SENSOR_OBSERVATION</option>
                <option value="HAZARD_DETECTED">HAZARD_DETECTED</option>
                <option value="COMMAND_EXECUTED">COMMAND_EXECUTED</option>
                <option value="REPLAN_APPROVED">REPLAN_APPROVED</option>
              </select>
              <select
                value={filterAgent}
                onChange={(e) => setFilterAgent(e.target.value)}
                className="bg-space-950 text-slate-200 border border-space-800 text-xs font-mono rounded px-2 py-1 w-full"
              >
                <option value="ALL">All Agents / Actors</option>
                <option value="agent-rover-01">agent-rover-01</option>
                <option value="agent-rover-02">agent-rover-02</option>
                <option value="agent-rover-03">agent-rover-03</option>
                <option value="MISSION_COMMAND">MISSION_COMMAND</option>
              </select>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {filteredEvents.map((evt, idx) => (
                <div
                  key={evt.eventId || idx}
                  onClick={() => handleSeek(idx)}
                  className={`p-2.5 rounded border text-xs font-mono cursor-pointer transition-colors ${
                    idx === replayState?.currentEventIndex
                      ? "bg-amber-950/60 border-amber-600 text-amber-200"
                      : "bg-space-950 border-space-800 text-slate-300 hover:border-space-700"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold">{evt.eventType}</span>
                    <span className="text-slate-500 text-[10px]">MET {Math.floor((evt.simulationTime || idx * 120) / 60)}m</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 truncate">
                    {evt.actor}: {JSON.stringify(evt.payload)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* WHAT-IF MODAL DRAWER */}
      {showWhatIf && whatIfResult && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-space-900 border border-space-700 rounded-lg max-w-4xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-space-800 pb-3">
              <div>
                <h2 className="text-xl font-bold font-mono text-white flex items-center gap-2">
                  <GitBranch className="w-5 h-5 text-amber-500" />
                  WHAT-IF DECISION COMPARATOR
                </h2>
                <p className="text-xs font-mono text-slate-400 mt-0.5">
                  Simulating alternate outcome from decision point MET 00:18:00
                </p>
              </div>
              <button
                onClick={() => setShowWhatIf(false)}
                className="text-slate-400 hover:text-white font-mono text-sm px-2 py-1 bg-space-800 rounded"
              >
                CLOSE
              </button>
            </div>

            {/* Decision selector */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-slate-300">Alternate Decision:</span>
              <select
                value={selectedDecision}
                onChange={(e) => setSelectedDecision(e.target.value)}
                className="bg-space-950 text-amber-400 border border-space-700 text-xs font-mono rounded px-3 py-1.5"
              >
                <option value="IGNORE_HAZARD">IGNORE_HAZARD (Continue direct route over scarp)</option>
                <option value="CONSERVATIVE_STANDBY">CONSERVATIVE_STANDBY (Hold for orbital pass)</option>
                <option value="MAX_SPEED_BURST">MAX_SPEED_BURST (Drive at maximum speed)</option>
              </select>
              <button
                onClick={handleRunWhatIf}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-space-950 text-xs font-mono font-bold rounded"
              >
                Re-simulate
              </button>
            </div>

            {/* Side-by-Side Comparison Table */}
            <div className="border border-space-800 rounded overflow-hidden">
              <table className="w-full text-xs font-mono">
                <thead className="bg-space-950 text-slate-400 border-b border-space-800">
                  <tr>
                    <th className="py-2.5 px-4 text-left">METRIC</th>
                    <th className="py-2.5 px-4 text-center">BASELINE (DETOUR APPROVED)</th>
                    <th className="py-2.5 px-4 text-center">WHAT-IF (HAZARD IGNORED)</th>
                    <th className="py-2.5 px-4 text-right">DELTA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-space-800 text-slate-200">
                  <tr>
                    <td className="py-2 px-4 font-bold">Traversal Distance</td>
                    <td className="py-2 px-4 text-center">{whatIfResult.baseline.distanceKm} km</td>
                    <td className="py-2 px-4 text-center text-amber-400">{whatIfResult.alternative.distanceKm} km</td>
                    <td className="py-2 px-4 text-right text-emerald-400">{whatIfResult.comparison.distanceDeltaKm} km</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-4 font-bold">Traversal Duration</td>
                    <td className="py-2 px-4 text-center">{whatIfResult.baseline.durationMin} min</td>
                    <td className="py-2 px-4 text-center">{whatIfResult.alternative.durationMin} min</td>
                    <td className="py-2 px-4 text-right text-emerald-400">{whatIfResult.comparison.durationDeltaMin} min</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-4 font-bold">Final Battery Reserve</td>
                    <td className="py-2 px-4 text-center font-bold text-emerald-400">{whatIfResult.baseline.batteryPercent}%</td>
                    <td className="py-2 px-4 text-center font-bold text-red-400">{whatIfResult.alternative.batteryPercent}%</td>
                    <td className="py-2 px-4 text-right text-red-400">{whatIfResult.comparison.batteryDeltaPercent}%</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-4 font-bold">Safety Score (S2 Gate)</td>
                    <td className="py-2 px-4 text-center font-bold text-emerald-400">{whatIfResult.baseline.safetyScore}/100</td>
                    <td className="py-2 px-4 text-center font-bold text-red-400">{whatIfResult.alternative.safetyScore}/100</td>
                    <td className="py-2 px-4 text-right text-red-400">{whatIfResult.comparison.safetyDelta} pts</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-4 font-bold">Hazards Encountered</td>
                    <td className="py-2 px-4 text-center">{whatIfResult.baseline.hazardsEncountered}</td>
                    <td className="py-2 px-4 text-center text-red-400">{whatIfResult.alternative.hazardsEncountered}</td>
                    <td className="py-2 px-4 text-right text-red-400">+2 hazards</td>
                  </tr>
                  <tr className="bg-space-950 font-bold">
                    <td className="py-2.5 px-4">MISSION OUTCOME</td>
                    <td className="py-2.5 px-4 text-center text-emerald-400">{whatIfResult.baseline.outcome}</td>
                    <td className="py-2.5 px-4 text-center text-red-400">{whatIfResult.alternative.outcome}</td>
                    <td className="py-2.5 px-4 text-right text-red-400">DEGRADED</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Verdict Box */}
            <div className="p-4 bg-space-950 border border-space-800 rounded font-mono text-xs space-y-2">
              <div className="text-amber-400 font-bold uppercase tracking-wide">Scientific Finding:</div>
              <div className="text-slate-300 leading-relaxed">{whatIfResult.verdict}</div>
            </div>
          </div>
        </div>
      )}

      {/* DECISION LINEAGE MODAL */}
      {showLineage && lineageData && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-space-900 border border-space-700 rounded-lg max-w-3xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-space-800 pb-3">
              <div>
                <h2 className="text-lg font-bold font-mono text-white flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-cyan-400" />
                  DECISION EXPLANATION LINEAGE
                </h2>
                <p className="text-xs font-mono text-slate-400 mt-0.5">
                  “Why did Mission Control decide to pause and take the Northern Detour?”
                </p>
              </div>
              <button
                onClick={() => setShowLineage(false)}
                className="text-slate-400 hover:text-white font-mono text-sm px-2 py-1 bg-space-800 rounded"
              >
                CLOSE
              </button>
            </div>

            <div className="space-y-4">
              {lineageData.nodes.map((node: any) => (
                <div key={node.nodeId} className="p-3.5 bg-space-950 border border-space-800 rounded-lg font-mono text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-space-800/80 mb-2">
                    <span className="font-bold text-amber-400">
                      STEP {node.stepIndex}: {node.stage}
                    </span>
                    <span className="text-slate-500">{node.timestamp}</span>
                  </div>
                  <div className="font-semibold text-white">{node.title}</div>
                  <div className="text-slate-300 mt-1">{node.summary}</div>
                  <div className="mt-2 text-slate-400 text-[11px] bg-space-900 p-2 rounded border border-space-800">
                    <span className="text-cyan-400 font-bold">Justification: </span>
                    {node.justification}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PROVENANCE MODAL */}
      {provenanceModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-space-900 border border-space-700 rounded-lg max-w-lg w-full p-5 shadow-2xl space-y-4 font-mono text-xs">
            <div className="flex justify-between items-center border-b border-space-800 pb-2">
              <span className="font-bold text-amber-400 uppercase">WHY DO WE BELIEVE THIS?</span>
              <button onClick={() => setProvenanceModal(null)} className="text-slate-400 hover:text-white">CLOSE</button>
            </div>
            <div className="space-y-2 text-slate-200">
              <div><span className="text-slate-500">FIELD: </span>{provenanceModal.field}</div>
              <div><span className="text-slate-500">MEASURED VALUE: </span><span className="text-amber-400 font-bold">{provenanceModal.value}</span></div>
              <div><span className="text-slate-500">UNCERTAINTY: </span>{provenanceModal.uncertainty}</div>
              <div><span className="text-slate-500">SOURCE: </span>{provenanceModal.source}</div>
              <div><span className="text-slate-500">PROCESSING: </span>{provenanceModal.processingMethod}</div>
              <div><span className="text-slate-500">DATA MODE: </span><span className="text-cyan-400 font-bold">{provenanceModal.simulationStatus}</span></div>
              <div className="pt-2 border-t border-space-800 text-slate-300">
                <span className="text-amber-400 font-bold">Interpretation: </span>{provenanceModal.interpretation}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
