import React, { useEffect, useState, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
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
  Compass,
  X,
  Download,
  GitCompare,
  ShieldCheck,
  ArrowLeft,
  FastForward,
  Rewind,
} from "lucide-react";

export const MissionReplayPage: React.FC = () => {
  const [missions, setMissions] = useState<any[]>([]);
  const [selectedMissionId, setSelectedMissionId] = useState<string>("MARSWALK-001");
  const [replayState, setReplayState] = useState<any>(null);
  const [reconstructed, setReconstructed] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [auditIntegrity, setAuditIntegrity] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

  // Filters
  const [filterAgent, setFilterAgent] = useState<string>("ALL");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [minTimeFilter, setMinTimeFilter] = useState<string>("");
  const [maxTimeFilter, setMaxTimeFilter] = useState<string>("");
  const [seekTimestampInput, setSeekTimestampInput] = useState<string>("");

  // Event Inspection, Comparison, What-If, Lineage
  const [inspectedEvent, setInspectedEvent] = useState<any>(null);
  const [comparisonResult, setComparisonResult] = useState<any>(null);
  const [compareLeftSeq] = useState<number>(1);
  const [compareRightMode, setCompareRightMode] = useState<"LIVE" | "SEQ">("LIVE");
  const [compareRightSeq, setCompareRightSeq] = useState<number>(2);
  const [showWhatIf, setShowWhatIf] = useState<boolean>(false);
  const [whatIfResult, setWhatIfResult] = useState<any>(null);
  const [selectedDecision, setSelectedDecision] = useState<string>("IGNORE_HAZARD");
  const [showLineage, setShowLineage] = useState<boolean>(false);
  const [lineageData, setLineageData] = useState<any>(null);
  const [provenanceModal, setProvenanceModal] = useState<any>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  const playbackTimerRef = useRef<any>(null);

  const syncReconstructionForEvent = async (missionId: string, evt: any) => {
    if (!evt) return;
    try {
      const [rec, detail] = await Promise.all([
        api.reconstructHistoricalState(missionId, { eventId: evt.eventId }),
        api.inspectReplayEvent(missionId, evt.eventId).catch(() => null),
      ]);
      setReconstructed(rec);
      if (detail) setInspectedEvent(detail);
    } catch (err) {
      console.error("Failed to reconstruct historical state", err);
    }
  };

  const loadMissionReplay = async (missionId: string) => {
    try {
      setIsLoading(true);
      setIsPlaying(false);
      const [missionsList, res] = await Promise.all([
        api.getReplayMissions().catch(() => []),
        api.getReplayState(missionId),
      ]);
      if (missionsList.length > 0) setMissions(missionsList);
      setReplayState(res.state);
      setEvents(res.events || []);
      setAuditIntegrity(res.auditIntegrity || null);
      if (res.state?.currentEvent) {
        await syncReconstructionForEvent(missionId, res.state.currentEvent);
      } else {
        const rec = await api.reconstructHistoricalState(missionId).catch(() => null);
        setReconstructed(rec);
      }
    } catch (err) {
      console.error("Failed to load replay state", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMissionReplay(selectedMissionId);
  }, [selectedMissionId]);

  // Playback loop honoring playbackSpeed
  useEffect(() => {
    if (isPlaying) {
      const intervalMs = Math.max(300, Math.round(1400 / playbackSpeed));
      playbackTimerRef.current = setInterval(async () => {
        try {
          const updated = await api.stepReplay("FORWARD", selectedMissionId);
          setReplayState(updated);
          if (updated.currentEvent) {
            syncReconstructionForEvent(selectedMissionId, updated.currentEvent);
          }
          if (updated.status === "COMPLETED") {
            setIsPlaying(false);
          }
        } catch {
          setIsPlaying(false);
        }
      }, intervalMs);
    } else {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    }
    return () => {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    };
  }, [isPlaying, playbackSpeed, selectedMissionId]);

  const handleTogglePlay = async () => {
    if (isPlaying) {
      const state = await api.pauseReplay(selectedMissionId);
      setIsPlaying(false);
      setReplayState(state);
    } else {
      const state =
        replayState?.status === "PAUSED"
          ? await api.resumeReplay(selectedMissionId)
          : await api.startReplay(selectedMissionId);
      setIsPlaying(true);
      setReplayState(state);
    }
  };

  const handleStep = async (dir: "FORWARD" | "BACKWARD") => {
    setIsPlaying(false);
    const updated = await api.stepReplay(dir, selectedMissionId);
    setReplayState(updated);
    if (updated.currentEvent) {
      await syncReconstructionForEvent(selectedMissionId, updated.currentEvent);
    }
  };

  const handleReset = async () => {
    setIsPlaying(false);
    const updated = await api.resetReplay(selectedMissionId);
    setReplayState(updated);
    if (updated.currentEvent) {
      await syncReconstructionForEvent(selectedMissionId, updated.currentEvent);
    }
  };

  const handleSeekIndex = async (idx: number) => {
    setIsPlaying(false);
    const updated = await api.seekReplay(idx, selectedMissionId, "INDEX");
    setReplayState(updated);
    if (updated.currentEvent) {
      await syncReconstructionForEvent(selectedMissionId, updated.currentEvent);
    }
  };

  const handleSeekByTimestamp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!seekTimestampInput.trim()) return;
    setIsPlaying(false);
    const rec = await api.reconstructHistoricalState(selectedMissionId, { timestamp: seekTimestampInput.trim() });
    setReconstructed(rec);
    if (rec.targetEventIndex >= 0) {
      const updated = await api.seekReplay(rec.targetEventIndex, selectedMissionId, "INDEX");
      setReplayState(updated);
      if (rec.targetEvent) {
        const detail = await api.inspectReplayEvent(selectedMissionId, rec.targetEvent.eventId).catch(() => null);
        if (detail) setInspectedEvent(detail);
      }
    }
  };

  const handleCompare = async () => {
    const leftTarget =
      reconstructed?.targetEvent?.eventId
        ? { type: "EVENT", eventId: reconstructed.targetEvent.eventId }
        : { type: "SEQUENCE", sequenceNumber: compareLeftSeq };
    const rightTarget =
      compareRightMode === "LIVE"
        ? { type: "LIVE" }
        : { type: "SEQUENCE", sequenceNumber: compareRightSeq };
    const res = await api.compareHistoricalStates(selectedMissionId, leftTarget, rightTarget);
    setComparisonResult(res);
  };

  const handleExport = async (format: "csv" | "json" | "markdown", kind: "events" | "snapshot" | "summary") => {
    try {
      const text = await api.exportReplayData(selectedMissionId, format, kind, {
        eventId: reconstructed?.targetEvent?.eventId,
        agentId: filterAgent,
        eventType: filterType,
      });
      const blob = new Blob([text], { type: format === "csv" ? "text/csv" : "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${selectedMissionId}-${kind}.${format === "markdown" ? "md" : format}`;
      a.click();
      URL.revokeObjectURL(url);
      setExportStatus(`Exported ${kind} (${format.toUpperCase()}) for ${selectedMissionId}.`);
    } catch (err: any) {
      setExportStatus(`Export failed: ${err.message}`);
    }
  };

  const handleRunWhatIf = async () => {
    try {
      const res = await api.runWhatIf({
        baselineMissionId: selectedMissionId,
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

  const uniqueEventTypes = useMemo(() => Array.from(new Set(events.map((e) => e.eventType))).sort(), [events]);
  const uniqueAgents = useMemo(
    () => Array.from(new Set(events.map((e) => e.agentId || e.actor).filter(Boolean))).sort(),
    [events]
  );

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (filterAgent !== "ALL" && e.actor !== filterAgent && e.agentId !== filterAgent) return false;
      if (filterType !== "ALL" && e.eventType !== filterType) return false;
      if (minTimeFilter && new Date(e.timestamp).getTime() < new Date(minTimeFilter).getTime()) return false;
      if (maxTimeFilter && new Date(e.timestamp).getTime() > new Date(maxTimeFilter).getTime()) return false;
      return true;
    });
  }, [events, filterAgent, filterType, minTimeFilter, maxTimeFilter]);

  const curEvent = replayState?.currentEvent;
  const displayAgents = reconstructed?.agents || replayState?.agents || [];
  const displayHazards = reconstructed?.activeHazards || replayState?.activeHazards || [];
  const displayWaypoints = reconstructed?.activeWaypoints || replayState?.activeRouteWaypoints || [];
  const displayMetrics = reconstructed?.metrics || replayState?.metrics || {};
  const curSimTime = replayState?.currentSimTimeSeconds || 0;
  const metFormatted = `MET 00:${String(Math.floor(curSimTime / 60)).padStart(2, "0")}:${String(curSimTime % 60).padStart(2, "0")}`;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-atlas-bg text-atlas-text flex items-center justify-center font-mono text-xs">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-atlas-accent animate-spin" />
          <span>Reconstructing persisted mission event ledger...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-atlas-bg text-atlas-text font-sans p-4 md:p-6 pb-24 transition-colors space-y-5">
      {/* Historical Isolation & Integrity Banner */}
      <div className="max-w-7xl mx-auto p-3 bg-atlas-surface border-2 border-atlas-accent flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2 py-0.5 bg-atlas-accent text-white font-bold">RECONSTRUCTED HISTORICAL STATE</span>
          <span className="text-atlas-text font-bold">
            Timestamp: {reconstructed?.targetTimestamp || curEvent?.timestamp || "Genesis"}
          </span>
          <span
            className={`px-2 py-0.5 border font-bold ${
              reconstructed?.completeness === "COMPLETE"
                ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/40"
                : "bg-amber-500/10 text-amber-300 border-amber-500/40"
            }`}
          >
            Reconstruction: {reconstructed?.completeness || "COMPLETE"}
          </span>
          <span
            className={`px-2 py-0.5 border font-bold flex items-center gap-1 ${
              auditIntegrity?.valid !== false
                ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/40"
                : "bg-red-500/10 text-red-300 border-red-500/40"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Audit Chain: {auditIntegrity?.valid !== false ? "VERIFIED" : "BROKEN"}</span>
          </span>
        </div>

        <Link
          to="/operations"
          className="px-3 py-1 bg-atlas-elevated hover:bg-atlas-bg border border-atlas-border text-atlas-teal font-bold flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Live Mission View</span>
        </Link>
      </div>

      {/* Top Header Bar */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-atlas-border pb-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl md:text-2xl font-bold font-display text-atlas-text flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-atlas-accent" />
              <span>Planetary Mission Replay &amp; Historical Reconstruction</span>
            </h1>
            <select
              aria-label="Select mission for replay"
              value={selectedMissionId}
              onChange={(e) => setSelectedMissionId(e.target.value)}
              className="bg-atlas-elevated border border-atlas-border text-atlas-text text-xs font-mono px-2.5 py-1 rounded"
            >
              {missions.length > 0 ? (
                missions.map((m) => (
                  <option key={m.missionId} value={m.missionId}>
                    {m.missionId} — {m.name} ({m.eventCount} events)
                  </option>
                ))
              ) : (
                <option value="MARSWALK-001">MARSWALK-001</option>
              )}
            </select>
          </div>
          <p className="text-xs text-atlas-muted mt-1 font-mono">
            Mission: {selectedMissionId} | {events.length} persisted events | Live canonical state is isolated from replay cursor
          </p>
        </div>

        {/* Exports & Quick Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => handleExport("csv", "events")}
            className="px-2.5 py-1.5 text-xs font-mono bg-atlas-elevated hover:bg-atlas-surface text-atlas-text border border-atlas-border flex items-center gap-1"
          >
            <Download className="w-3.5 h-3.5 text-atlas-teal" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => handleExport("json", "snapshot")}
            className="px-2.5 py-1.5 text-xs font-mono bg-atlas-elevated hover:bg-atlas-surface text-atlas-text border border-atlas-border flex items-center gap-1"
          >
            <Download className="w-3.5 h-3.5 text-atlas-blue" />
            <span>Snapshot JSON</span>
          </button>
          <button
            onClick={() => handleExport("markdown", "summary")}
            className="px-2.5 py-1.5 text-xs font-mono bg-atlas-elevated hover:bg-atlas-surface text-atlas-text border border-atlas-border flex items-center gap-1"
          >
            <Download className="w-3.5 h-3.5 text-atlas-amber" />
            <span>Summary MD</span>
          </button>
          <button
            onClick={() => handleInspectLineage("evt-flagship-detour")}
            className="px-2.5 py-1.5 text-xs font-semibold bg-atlas-elevated hover:bg-atlas-surface text-atlas-text border border-atlas-border flex items-center gap-1"
          >
            <HelpCircle className="w-3.5 h-3.5 text-atlas-blue" />
            <span>Lineage</span>
          </button>
          <button
            onClick={handleRunWhatIf}
            className="px-2.5 py-1.5 text-xs font-semibold bg-atlas-accent hover:bg-atlas-accent-dark text-white font-bold flex items-center gap-1"
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>What-If</span>
          </button>
        </div>
      </div>

      {exportStatus && (
        <div className="max-w-7xl mx-auto p-2.5 bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 text-xs font-mono">
          {exportStatus}
        </div>
      )}

      {reconstructed?.anomalies?.length > 0 && (
        <div className="max-w-7xl mx-auto p-3 bg-amber-500/10 border border-amber-500/40 text-amber-300 text-xs font-mono space-y-1">
          <div className="font-bold">Reconstruction Notes / Legacy Payload Limitations:</div>
          {reconstructed.anomalies.map((a: string, i: number) => (
            <div key={i}>• {a}</div>
          ))}
        </div>
      )}

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Playback Controls, Historical Map, Event Inspection, Comparison */}
        <div className="lg:col-span-2 space-y-6">
          {/* Scrubber & Playback Bar */}
          <div className="bg-atlas-surface border border-atlas-border p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <span className="text-xs text-atlas-muted font-mono uppercase tracking-wider">Historical Replay Time</span>
                <div className="text-2xl font-extrabold font-mono text-atlas-accent tracking-wider mt-0.5">
                  {metFormatted}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-xs font-mono">
                  <span className="text-atlas-muted mr-1.5">Speed:</span>
                  {[0.5, 1, 2, 4].map((spd) => (
                    <button
                      key={spd}
                      onClick={() => setPlaybackSpeed(spd)}
                      className={`px-2 py-0.5 border mr-1 ${
                        playbackSpeed === spd
                          ? "bg-atlas-accent text-white border-atlas-accent font-bold"
                          : "bg-atlas-elevated text-atlas-muted border-atlas-border"
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
                <span className="text-xs font-mono font-bold px-2 py-1 bg-atlas-elevated border border-atlas-border text-atlas-text">
                  {replayState?.status}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <input
                type="range"
                min="0"
                max={Math.max(1, events.length - 1)}
                value={replayState?.currentEventIndex || 0}
                onChange={(e) => handleSeekIndex(Number(e.target.value))}
                className="w-full h-2 bg-atlas-elevated appearance-none cursor-pointer accent-atlas-accent border border-atlas-border"
              />
              <div className="flex justify-between text-xs text-atlas-muted font-mono">
                <span>Start (#0)</span>
                <span>
                  Event #{(replayState?.currentEventIndex || 0) + 1} of {events.length}
                </span>
                <span>End (#{Math.max(0, events.length - 1)})</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 border-t border-atlas-border pt-4">
              <button
                onClick={() => handleSeekIndex(0)}
                title="Jump to Mission Start"
                className="px-2.5 py-2 bg-atlas-elevated hover:bg-atlas-surface border border-atlas-border text-atlas-text text-xs font-mono flex items-center gap-1"
              >
                <Rewind className="w-3.5 h-3.5" />
                <span>Start</span>
              </button>
              <button
                onClick={() => handleStep("BACKWARD")}
                title="Step Backward"
                className="p-2 bg-atlas-elevated hover:bg-atlas-surface border border-atlas-border text-atlas-text"
              >
                <SkipBack className="w-4 h-4" />
              </button>
              <button
                onClick={handleTogglePlay}
                className="px-5 py-2 bg-atlas-accent hover:bg-atlas-accent-dark text-white font-bold flex items-center gap-2 shadow-md"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span className="font-mono text-xs">
                  {isPlaying ? "Pause" : replayState?.status === "PAUSED" ? "Resume" : "Play Replay"}
                </span>
              </button>
              <button
                onClick={() => handleStep("FORWARD")}
                title="Step Forward"
                className="p-2 bg-atlas-elevated hover:bg-atlas-surface border border-atlas-border text-atlas-text"
              >
                <SkipForward className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleSeekIndex(Math.max(0, events.length - 1))}
                title="Jump to Mission End"
                className="px-2.5 py-2 bg-atlas-elevated hover:bg-atlas-surface border border-atlas-border text-atlas-text text-xs font-mono flex items-center gap-1"
              >
                <span>End</span>
                <FastForward className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleReset}
                title="Reset Replay"
                className="p-2 bg-atlas-elevated hover:bg-atlas-surface border border-atlas-border text-atlas-muted hover:text-atlas-text"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            {/* Seek by UTC Timestamp */}
            <form onSubmit={handleSeekByTimestamp} className="flex flex-wrap items-center gap-2 pt-2 border-t border-atlas-border text-xs font-mono">
              <span className="text-atlas-muted">Seek Timestamp (ISO):</span>
              <input
                type="text"
                placeholder="e.g. 2026-11-12T12:00:00Z"
                value={seekTimestampInput}
                onChange={(e) => setSeekTimestampInput(e.target.value)}
                className="flex-1 min-w-[200px] bg-atlas-elevated border border-atlas-border text-atlas-text px-2 py-1"
              />
              <button type="submit" className="px-3 py-1 bg-atlas-elevated border border-atlas-border text-atlas-accent font-bold">
                Reconstruct At Time
              </button>
            </form>
          </div>

          {/* Historical Surface Tactical Map */}
          <div className="bg-atlas-surface border border-atlas-border p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-atlas-border pb-2">
              <div className="flex items-center gap-2 font-display font-bold text-sm text-atlas-text">
                <Compass className="w-4 h-4 text-atlas-teal" />
                <span>Historical Surface Map Snapshot (Jezero Crater)</span>
              </div>
              <span className="text-[11px] font-mono text-atlas-muted">
                {displayWaypoints.length} Waypoints | {displayHazards.length} Hazards
              </span>
            </div>

            <div className="h-64 bg-atlas-bg border border-atlas-border relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(#29384b_1px,transparent_1px)] [background-size:16px_16px] opacity-40" />
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                {displayWaypoints.length > 1 && (
                  <polyline
                    fill="none"
                    stroke="var(--atlas-teal)"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                    points={displayWaypoints
                      .map((w: any) => {
                        const x = Math.min(92, Math.max(8, ((w.longitude - 77.4) / 0.08) * 100));
                        const y = Math.min(90, Math.max(10, 100 - ((w.latitude - 18.4) / 0.08) * 100));
                        return `${x * 6},${y * 2.5}`;
                      })
                      .join(" ")}
                  />
                )}
              </svg>

              {displayHazards.map((h: any, idx: number) => {
                const xPct = Math.min(90, Math.max(10, ((h.location.longitude - 77.4) / 0.08) * 100));
                const yPct = Math.min(90, Math.max(10, 100 - ((h.location.latitude - 18.4) / 0.08) * 100));
                return (
                  <div
                    key={h.hazardId || idx}
                    style={{ left: `${xPct}%`, top: `${yPct}%` }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 px-1.5 py-0.5 bg-red-600/90 text-white text-[9px] font-mono font-bold border border-white"
                  >
                    HAZARD {h.estimatedSlopeDeg}°
                  </div>
                );
              })}

              {displayAgents.map((ag: any) => {
                if (!ag.position) return null;
                const xPct = Math.min(90, Math.max(10, ((ag.position.longitude - 77.4) / 0.08) * 100));
                const yPct = Math.min(90, Math.max(10, 100 - ((ag.position.latitude - 18.4) / 0.08) * 100));
                return (
                  <div
                    key={ag.id}
                    style={{ left: `${xPct}%`, top: `${yPct}%` }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 bg-atlas-surface border-2 border-atlas-accent px-1.5 py-0.5 text-[9px] font-mono font-bold text-atlas-text shadow"
                  >
                    {ag.callsign} ({ag.status})
                  </div>
                );
              })}
            </div>
          </div>

          {/* Current Event Inspection Card */}
          <div className="bg-atlas-surface border border-atlas-border p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-atlas-border">
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 bg-atlas-elevated text-atlas-accent border border-atlas-border font-mono font-bold">
                  Seq #{curEvent?.sequenceNumber || (replayState?.currentEventIndex || 0) + 1}
                </span>
                <span className="text-sm font-display font-semibold text-atlas-text">
                  {curEvent?.eventType || "MISSION_EVENT"}
                </span>
              </div>
              <span className="text-xs font-mono text-atlas-muted">Actor: {curEvent?.actor || "SYSTEM"}</span>
            </div>

            {inspectedEvent && (
              <div className="p-3 bg-atlas-elevated border border-atlas-border text-xs font-mono space-y-1.5">
                <div className="text-atlas-teal font-bold">{inspectedEvent.explanation}</div>
                <div className="text-atlas-muted">
                  Entity: <b className="text-atlas-text">{curEvent?.entityId || curEvent?.agentId || "N/A"}</b> | Provenance:{" "}
                  <b className="text-atlas-amber">{curEvent?.provenance?.sourceType || "DERIVED"}</b> | Related Events:{" "}
                  <b className="text-atlas-text">{inspectedEvent.relatedEvents?.length || 0}</b>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
              <div className="space-y-1">
                <div className="text-atlas-muted uppercase text-[10px]">Timestamp (UTC):</div>
                <div className="text-atlas-text bg-atlas-elevated p-2 border border-atlas-border">
                  {curEvent?.timestamp || "N/A"}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-atlas-muted uppercase text-[10px]">Event Hash (SHA-256):</div>
                <div className="text-atlas-muted bg-atlas-elevated p-2 border border-atlas-border truncate">
                  {curEvent?.eventHash || "GENESIS"}
                </div>
              </div>
            </div>

            {(curEvent?.previousState || curEvent?.resultingState) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                <div>
                  <div className="text-atlas-muted uppercase text-[10px] mb-1">Previous State:</div>
                  <pre className="p-2 bg-atlas-elevated border border-atlas-border overflow-x-auto">
                    {JSON.stringify(curEvent.previousState || {}, null, 2)}
                  </pre>
                </div>
                <div>
                  <div className="text-atlas-muted uppercase text-[10px] mb-1">Resulting State:</div>
                  <pre className="p-2 bg-atlas-elevated border border-atlas-border overflow-x-auto">
                    {JSON.stringify(curEvent.resultingState || {}, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <span className="text-xs font-mono text-atlas-muted uppercase">Event Payload &amp; Evidence:</span>
              <pre className="p-3 bg-atlas-elevated text-atlas-text text-xs font-mono border border-atlas-border overflow-x-auto leading-relaxed">
                {JSON.stringify(curEvent?.payload || {}, null, 2)}
              </pre>
            </div>

            {curEvent?.eventType === "HAZARD_DETECTED" && (
              <button
                onClick={() => handleOpenProvenance("slope", "21.8°")}
                className="text-xs font-mono text-atlas-accent hover:underline font-semibold"
              >
                Why do we believe this hazard? (View Provenance)
              </button>
            )}
          </div>

          {/* Historical vs Live / Two-Point Comparison Panel */}
          <div className="bg-atlas-surface border border-atlas-border p-5 shadow-xl space-y-3 font-mono text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-atlas-border pb-2">
              <div className="flex items-center gap-2 font-display font-bold text-sm text-atlas-text">
                <GitCompare className="w-4 h-4 text-atlas-accent" />
                <span>Historical State Comparison</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={compareRightMode}
                  onChange={(e) => setCompareRightMode(e.target.value as any)}
                  className="bg-atlas-elevated border border-atlas-border text-atlas-text px-2 py-1"
                >
                  <option value="LIVE">Compare Selected Event vs Current Live State</option>
                  <option value="SEQ">Compare Two Sequence Positions</option>
                </select>
                {compareRightMode === "SEQ" && (
                  <input
                    type="number"
                    min={1}
                    max={Math.max(1, events.length)}
                    value={compareRightSeq}
                    onChange={(e) => setCompareRightSeq(Number(e.target.value))}
                    className="w-16 bg-atlas-elevated border border-atlas-border text-atlas-text px-2 py-1"
                  />
                )}
                <button
                  onClick={handleCompare}
                  className="px-3 py-1 bg-atlas-accent hover:bg-atlas-accent/90 text-white font-bold"
                >
                  Compare States
                </button>
              </div>
            </div>

            {comparisonResult && (
              <div className="space-y-2">
                <div className="text-atlas-muted">
                  {comparisonResult.leftLabel} vs {comparisonResult.rightLabel} —{" "}
                  <b className="text-atlas-text">{comparisonResult.totalDifferences} differences</b>
                </div>
                {comparisonResult.differences.length === 0 ? (
                  <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                    No state differences between selected historical point and comparison target.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {comparisonResult.differences.map((d: any, idx: number) => (
                      <div key={idx} className="p-2 bg-atlas-elevated border border-atlas-border flex items-center justify-between gap-2">
                        <div>
                          <span className="px-1.5 py-0.5 bg-atlas-surface border border-atlas-border text-atlas-accent font-bold mr-2">
                            {d.changeType}
                          </span>
                          <span className="text-atlas-muted uppercase mr-1">[{d.domain}]</span>
                          <span className="text-atlas-text font-bold">{d.entityId}:</span>{" "}
                          <span className="text-atlas-muted">{d.summary}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Reconstructed Replay Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-atlas-surface border border-atlas-border p-3.5 text-center">
              <div className="text-xs font-mono text-atlas-muted uppercase">Battery Drain</div>
              <div className="text-lg font-mono font-bold text-atlas-amber mt-1">
                {Number(displayMetrics?.batteryDepletedPercent || 0).toFixed(1)}%
              </div>
            </div>
            <div className="bg-atlas-surface border border-atlas-border p-3.5 text-center">
              <div className="text-xs font-mono text-atlas-muted uppercase">Hazards Encountered</div>
              <div className="text-lg font-mono font-bold text-atlas-text mt-1">
                {displayMetrics?.hazardsEncountered || 0}
              </div>
            </div>
            <div className="bg-atlas-surface border border-atlas-border p-3.5 text-center">
              <div className="text-xs font-mono text-atlas-muted uppercase">Packets Delivered</div>
              <div className="text-lg font-mono font-bold text-atlas-teal mt-1">
                {displayMetrics?.packetsDeliveredCount || 0}
              </div>
            </div>
            <div className="bg-atlas-surface border border-atlas-border p-3.5 text-center">
              <div className="text-xs font-mono text-atlas-muted uppercase">Science Yield</div>
              <div className="text-lg font-mono font-bold text-atlas-blue mt-1">
                {displayMetrics?.scienceYieldScore || 0} pts
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Reconstructed Fleet & Filtered Event Stream */}
        <div className="space-y-6">
          <div className="bg-atlas-surface border border-atlas-border p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-atlas-border">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-atlas-blue" />
                <h3 className="font-display font-bold text-sm text-atlas-text">Reconstructed Historical Fleet</h3>
              </div>
              <span className="text-xs font-mono text-atlas-muted">{displayAgents.length} Agents</span>
            </div>

            <div className="space-y-2">
              {displayAgents.map((agent: any) => (
                <div key={agent.id} className="p-3 bg-atlas-elevated border border-atlas-border flex items-center justify-between">
                  <div>
                    <div className="text-xs font-mono font-bold text-atlas-text">{agent.callsign || agent.name}</div>
                    <div className="text-[11px] font-mono text-atlas-muted mt-0.5">
                      {agent.position
                        ? `Pos: ${agent.position.latitude.toFixed(4)}°, ${agent.position.longitude.toFixed(4)}°`
                        : "Historical telemetry unavailable"}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] px-2 py-0.5 font-mono font-bold border bg-atlas-surface text-atlas-teal border-atlas-border">
                      {agent.status}
                    </span>
                    <div className="text-[11px] font-mono text-atlas-amber mt-1">
                      Bat: {agent.telemetry?.batteryPercent ?? "N/A"}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-atlas-surface border border-atlas-border p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-atlas-border">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-atlas-teal" />
                <h3 className="font-display font-bold text-sm text-atlas-text">Persisted Event Stream</h3>
              </div>
              <span className="text-xs font-mono text-atlas-muted">{filteredEvents.length} Shown</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <select
                aria-label="Filter by event type"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-atlas-elevated text-atlas-text border border-atlas-border text-xs font-mono p-1.5"
              >
                <option value="ALL">All Event Types</option>
                {uniqueEventTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <select
                aria-label="Filter by agent"
                value={filterAgent}
                onChange={(e) => setFilterAgent(e.target.value)}
                className="bg-atlas-elevated text-atlas-text border border-atlas-border text-xs font-mono p-1.5"
              >
                <option value="ALL">All Agents / Actors</option>
                {uniqueAgents.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
              <input
                type="text"
                placeholder="Min UTC (ISO)"
                value={minTimeFilter}
                onChange={(e) => setMinTimeFilter(e.target.value)}
                className="bg-atlas-elevated text-atlas-text border border-atlas-border p-1"
              />
              <input
                type="text"
                placeholder="Max UTC (ISO)"
                value={maxTimeFilter}
                onChange={(e) => setMaxTimeFilter(e.target.value)}
                className="bg-atlas-elevated text-atlas-text border border-atlas-border p-1"
              />
            </div>

            <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
              {filteredEvents.map((evt, idx) => {
                const origIdx = events.findIndex((x) => x.eventId === evt.eventId);
                return (
                  <div
                    key={evt.eventId || idx}
                    onClick={() => handleSeekIndex(origIdx >= 0 ? origIdx : idx)}
                    className={`p-2.5 border text-xs font-mono cursor-pointer transition-colors ${
                      origIdx === replayState?.currentEventIndex
                        ? "bg-atlas-elevated border-atlas-accent text-atlas-text shadow-sm"
                        : "bg-atlas-elevated/60 border-atlas-border text-atlas-muted hover:text-atlas-text"
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-[11px]">
                      <span>
                        #{evt.sequenceNumber || origIdx + 1} {evt.eventType}
                      </span>
                      <span className="text-[10px] text-atlas-muted">{new Date(evt.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div className="text-[10px] text-atlas-muted mt-0.5 truncate">
                      Actor: {evt.actor} | ID: {evt.eventId}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* What-If Modal */}
      {showWhatIf && whatIfResult && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
          <div className="bg-atlas-surface border border-atlas-border max-w-lg w-full p-6 space-y-4 shadow-2xl font-mono text-xs">
            <div className="flex items-center justify-between border-b border-atlas-border pb-3">
              <h3 className="font-display font-bold text-base text-atlas-text">What-If Counterfactual (Isolated)</h3>
              <button onClick={() => setShowWhatIf(false)} className="text-atlas-muted hover:text-atlas-text">
                <X className="w-5 h-5" />
              </button>
            </div>
            <select
              value={selectedDecision}
              onChange={(e) => setSelectedDecision(e.target.value)}
              className="w-full bg-atlas-elevated border border-atlas-border text-atlas-text p-2"
            >
              <option value="IGNORE_HAZARD">IGNORE_HAZARD</option>
              <option value="ABORT_EVA">ABORT_EVA</option>
              <option value="DETOUR_VALLEY">DETOUR_VALLEY</option>
            </select>
            <button onClick={handleRunWhatIf} className="w-full py-2 bg-atlas-accent text-white font-bold">
              Re-Run Counterfactual
            </button>
            <pre className="p-3 bg-atlas-elevated border border-atlas-border max-h-60 overflow-auto">
              {JSON.stringify(whatIfResult, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Decision Lineage Modal */}
      {showLineage && lineageData && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
          <div className="bg-atlas-surface border border-atlas-border max-w-lg w-full p-6 space-y-4 shadow-2xl font-mono text-xs">
            <div className="flex items-center justify-between border-b border-atlas-border pb-3">
              <h3 className="font-display font-bold text-base text-atlas-text">Decision Lineage</h3>
              <button onClick={() => setShowLineage(false)} className="text-atlas-muted hover:text-atlas-text">
                <X className="w-5 h-5" />
              </button>
            </div>
            <pre className="p-3 bg-atlas-elevated border border-atlas-border max-h-72 overflow-auto">
              {JSON.stringify(lineageData, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Provenance Modal */}
      {provenanceModal && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
          <div className="bg-atlas-surface border border-atlas-border max-w-md w-full p-5 space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-atlas-border pb-2">
              <span className="font-bold text-atlas-text">Data Provenance</span>
              <button onClick={() => setProvenanceModal(null)} className="text-atlas-muted hover:text-atlas-text">
                <X className="w-4 h-4" />
              </button>
            </div>
            <pre className="p-2 bg-atlas-elevated border border-atlas-border max-h-60 overflow-auto">
              {JSON.stringify(provenanceModal, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
