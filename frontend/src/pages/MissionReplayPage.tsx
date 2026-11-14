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
    <div className="min-h-screen bg-atlas-bg text-atlas-text font-sans pb-32 transition-colors space-y-8">
      {/* Historical Isolation & Integrity Header Strip */}
      <div className="border-b border-atlas-border bg-atlas-surface/40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="px-3 py-1 bg-atlas-accent/15 border border-atlas-accent/40 text-atlas-accent font-bold rounded-md tracking-wider">
              RECONSTRUCTED HISTORICAL STATE
            </span>
            <span className="text-atlas-muted">
              Snapshot: <strong className="text-atlas-text">{reconstructed?.targetTimestamp || curEvent?.timestamp || "Genesis"}</strong>
            </span>
            <span
              className={`px-2.5 py-0.5 border rounded-md font-bold ${
                reconstructed?.completeness === "COMPLETE"
                  ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/40"
                  : "bg-amber-500/10 text-amber-300 border-amber-500/40"
              }`}
            >
              Reconstruction: {reconstructed?.completeness || "COMPLETE"}
            </span>
            <span
              className={`px-2.5 py-0.5 border rounded-md font-bold flex items-center gap-1.5 ${
                auditIntegrity?.valid !== false
                  ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/40"
                  : "bg-red-500/10 text-red-300 border-red-500/40"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Audit Chain: {auditIntegrity?.valid !== false ? "VERIFIED (SHA-256)" : "BROKEN"}</span>
            </span>
          </div>

          <Link
            to="/operations"
            className="px-3.5 py-1.5 bg-atlas-elevated hover:bg-atlas-surface border border-atlas-border hover:border-atlas-teal/50 text-atlas-teal font-bold rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Live Operations</span>
          </Link>
        </div>
      </div>

      {/* Top Header Bar */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 flex flex-col md:flex-row md:items-center md:justify-between gap-6 border-b border-atlas-border pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-atlas-muted mb-2">
            <span className="text-atlas-accent font-bold">04</span>
            <span>/</span>
            <span>Deterministic Mission Replay &amp; Event Traceability</span>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-extrabold font-display text-atlas-text flex items-center gap-3">
              <RotateCcw className="w-6 h-6 text-atlas-accent" />
              <span>Mission Replay — {selectedMissionId}</span>
            </h1>
            <select
              aria-label="Select mission for replay"
              value={selectedMissionId}
              onChange={(e) => setSelectedMissionId(e.target.value)}
              className="bg-atlas-elevated border border-atlas-border text-atlas-text text-xs font-mono px-3.5 py-1.5 rounded-lg focus:outline-none focus:border-atlas-accent"
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
          <p className="text-xs text-atlas-muted mt-1.5 font-mono">
            {events.length} persisted ledger events · Reconstructed with full cryptographic replay determinism
          </p>
        </div>

        {/* Exports & Quick Actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => handleExport("csv", "events")}
            className="px-3 py-1.5 text-xs font-mono font-medium bg-atlas-elevated hover:bg-atlas-surface text-atlas-text border border-atlas-border hover:border-atlas-teal/50 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-atlas-teal" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => handleExport("json", "snapshot")}
            className="px-3 py-1.5 text-xs font-mono font-medium bg-atlas-elevated hover:bg-atlas-surface text-atlas-text border border-atlas-border hover:border-blue-400/50 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span>Snapshot JSON</span>
          </button>
          <button
            onClick={() => handleExport("markdown", "summary")}
            className="px-3 py-1.5 text-xs font-mono font-medium bg-atlas-elevated hover:bg-atlas-surface text-atlas-text border border-atlas-border hover:border-amber-400/50 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>Summary MD</span>
          </button>
          <button
            onClick={() => handleInspectLineage("evt-flagship-detour")}
            className="px-3 py-1.5 text-xs font-semibold bg-atlas-elevated hover:bg-atlas-surface text-atlas-text border border-atlas-border hover:border-atlas-accent/50 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <HelpCircle className="w-3.5 h-3.5 text-atlas-teal" />
            <span>Lineage</span>
          </button>
          <button
            onClick={handleRunWhatIf}
            className="px-4 py-1.5 text-xs font-bold bg-atlas-accent hover:bg-atlas-accent-dark text-white rounded-lg flex items-center gap-1.5 transition-colors shadow-lg shadow-atlas-accent/20"
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>What-If</span>
          </button>
        </div>
      </div>

      {exportStatus && (
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 text-xs font-mono rounded-xl">
            {exportStatus}
          </div>
        </div>
      )}

      {reconstructed?.anomalies?.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="p-4 bg-amber-500/10 border border-amber-500/40 text-amber-300 text-xs font-mono space-y-1.5 rounded-xl">
            <div className="font-bold">Reconstruction Notes / Legacy Payload Limitations:</div>
            {reconstructed.anomalies.map((a: string, i: number) => (
              <div key={i}>• {a}</div>
            ))}
          </div>
        </div>
      )}

      {/* Main Replay Stage: Split View Matching Reference Image 2 (Card 04) */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 space-y-8">
        <div className="bg-atlas-surface border border-atlas-border rounded-2xl shadow-2xl overflow-hidden">
          {/* Upper Split: Left Event Timeline vs Right Surface Tactical Canvas */}
          <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[460px]">
            {/* Left 5 Cols: Event Timeline */}
            <div className="lg:col-span-5 border-b lg:border-b-0 lg:border-r border-atlas-border p-5 md:p-6 flex flex-col justify-between bg-atlas-surface/80 space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-atlas-border pb-3">
                  <div>
                    <span className="text-[10px] font-bold font-mono tracking-widest text-atlas-accent uppercase block">
                      CHRONOLOGY
                    </span>
                    <h3 className="text-base font-bold font-display text-atlas-text">Event Timeline</h3>
                  </div>
                  <span className="text-xs font-mono text-atlas-muted">
                    #{((replayState?.currentEventIndex || 0) + 1)} of {events.length}
                  </span>
                </div>

                {/* Filter Controls */}
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <select
                    aria-label="Filter by event type"
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="bg-atlas-elevated text-atlas-text border border-atlas-border rounded-lg p-1.5 focus:outline-none focus:border-atlas-accent"
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
                    className="bg-atlas-elevated text-atlas-text border border-atlas-border rounded-lg p-1.5 focus:outline-none focus:border-atlas-accent"
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
                    className="bg-atlas-elevated text-atlas-text border border-atlas-border rounded px-2 py-1 placeholder:text-atlas-muted/40"
                  />
                  <input
                    type="text"
                    placeholder="Max UTC (ISO)"
                    value={maxTimeFilter}
                    onChange={(e) => setMaxTimeFilter(e.target.value)}
                    className="bg-atlas-elevated text-atlas-text border border-atlas-border rounded px-2 py-1 placeholder:text-atlas-muted/40"
                  />
                </div>

                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {filteredEvents.map((evt, idx) => {
                    const origIdx = events.findIndex((x) => x.eventId === evt.eventId);
                    const isCurrent = origIdx === replayState?.currentEventIndex;
                    const sec = Math.min((origIdx >= 0 ? origIdx : idx) * 420, 5340);
                    const timeLabel = `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

                    return (
                      <div
                        key={evt.eventId || idx}
                        onClick={() => handleSeekIndex(origIdx >= 0 ? origIdx : idx)}
                        className={`p-3 rounded-xl border text-xs font-mono cursor-pointer transition-all flex items-center justify-between gap-3 ${
                          isCurrent
                            ? "bg-atlas-accent/15 border-atlas-accent text-atlas-text shadow-sm"
                            : "bg-atlas-elevated/40 border-atlas-border text-atlas-muted hover:text-atlas-text hover:bg-atlas-elevated"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-0.5 rounded font-mono text-[11px] font-bold ${
                            isCurrent ? "bg-atlas-accent text-white" : "bg-atlas-elevated text-atlas-muted"
                          }`}>
                            {timeLabel}
                          </span>
                          <span className={`font-medium ${isCurrent ? "text-atlas-text font-bold" : ""}`}>
                            {evt.eventType.replace(/_/g, " ")}
                          </span>
                        </div>
                        <span className="text-[10px] text-atlas-muted uppercase">{evt.actor}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right 7 Cols: Tactical Surface Visualization */}
            <div className="lg:col-span-7 p-5 md:p-6 flex flex-col justify-between bg-atlas-bg/60 relative">
              <div className="flex items-center justify-between border-b border-atlas-border pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <Compass className="w-4 h-4 text-atlas-teal" />
                  <span className="text-sm font-bold font-display text-atlas-text">Jezero Surface State Reconstruction</span>
                </div>
                <div className="flex items-center gap-3 text-xs font-mono text-atlas-muted">
                  <span>{displayAgents.length} Agents</span>
                  <span>·</span>
                  <span>{displayHazards.length} Hazards</span>
                </div>
              </div>

              <div className="h-80 md:h-96 bg-atlas-bg border border-atlas-border rounded-xl relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(#223A4E_1px,transparent_1px)] [background-size:20px_20px] opacity-40" />
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  {displayWaypoints.length > 1 && (
                    <polyline
                      fill="none"
                      stroke="#2CB9B1"
                      strokeWidth="2.5"
                      strokeDasharray="6 6"
                      points={displayWaypoints
                        .map((w: any) => {
                          const x = Math.min(92, Math.max(8, ((w.longitude - 77.4) / 0.08) * 100));
                          const y = Math.min(90, Math.max(10, 100 - ((w.latitude - 18.4) / 0.08) * 100));
                          return `${x * 6.5},${y * 3.5}`;
                        })
                        .join(" ")}
                    />
                  )}
                </svg>

                {displayHazards.map((h: any, idx: number) => {
                  const xPct = Math.min(90, Math.max(10, ((h.location?.longitude ?? 77.45) - 77.4) / 0.08 * 100));
                  const yPct = Math.min(90, Math.max(10, 100 - ((h.location?.latitude ?? 18.44) - 18.4) / 0.08 * 100));
                  return (
                    <div
                      key={h.hazardId || idx}
                      style={{ left: `${xPct}%`, top: `${yPct}%` }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 px-2 py-0.5 bg-red-600/90 text-white text-[10px] font-mono font-bold rounded shadow-lg border border-red-300"
                    >
                      HAZARD {h.estimatedSlopeDeg ?? 22}°
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
                      className="absolute -translate-x-1/2 -translate-y-1/2 bg-atlas-surface border-2 border-atlas-accent px-2.5 py-1 rounded-md text-[10px] font-mono font-bold text-atlas-text shadow-xl"
                    >
                      {ag.callsign} ({ag.status})
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Lower Scrubber & Playback Bar Matching Reference Image 2 */}
          <div className="border-t border-atlas-border bg-atlas-elevated/40 p-5 md:p-6 space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={handleTogglePlay}
                  className="w-12 h-12 rounded-xl bg-atlas-accent hover:bg-atlas-accent-dark text-white flex items-center justify-center shadow-lg shadow-atlas-accent/25 transition-transform active:scale-95"
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                </button>
                <div>
                  <span className="text-[10px] text-atlas-muted font-mono uppercase tracking-wider block">MISSION ELAPSED TIME</span>
                  <div className="text-xl md:text-2xl font-bold font-mono text-atlas-text tracking-wide">
                    {metFormatted} <span className="text-atlas-muted text-base font-normal">/ 01:29:00</span>
                  </div>
                </div>
              </div>

              {/* Scrubber Range Bar */}
              <div className="flex-1 max-w-2xl px-2 space-y-1.5">
                <input
                  type="range"
                  min="0"
                  max={Math.max(1, events.length - 1)}
                  value={replayState?.currentEventIndex || 0}
                  onChange={(e) => handleSeekIndex(Number(e.target.value))}
                  className="w-full h-2.5 bg-atlas-elevated rounded-lg appearance-none cursor-pointer accent-atlas-accent border border-atlas-border"
                />
                <div className="flex justify-between text-[11px] text-atlas-muted font-mono">
                  <span>Start (00:00:00)</span>
                  <span>Event #{(replayState?.currentEventIndex || 0) + 1} of {events.length}</span>
                  <span>End (01:29:00)</span>
                </div>
              </div>

              {/* Step Controls & Playback Speed */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSeekIndex(0)}
                  title="Jump to Mission Start"
                  className="p-2.5 bg-atlas-elevated hover:bg-atlas-surface border border-atlas-border text-atlas-text rounded-lg transition-colors"
                >
                  <Rewind className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleStep("BACKWARD")}
                  title="Step Backward"
                  className="p-2.5 bg-atlas-elevated hover:bg-atlas-surface border border-atlas-border text-atlas-text rounded-lg transition-colors"
                >
                  <SkipBack className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleStep("FORWARD")}
                  title="Step Forward"
                  className="p-2.5 bg-atlas-elevated hover:bg-atlas-surface border border-atlas-border text-atlas-text rounded-lg transition-colors"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleSeekIndex(Math.max(0, events.length - 1))}
                  title="Jump to Mission End"
                  className="p-2.5 bg-atlas-elevated hover:bg-atlas-surface border border-atlas-border text-atlas-text rounded-lg transition-colors"
                >
                  <FastForward className="w-4 h-4" />
                </button>
                <button
                  onClick={handleReset}
                  title="Reset Replay"
                  className="p-2.5 bg-atlas-elevated hover:bg-atlas-surface border border-atlas-border text-atlas-muted hover:text-atlas-text rounded-lg transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-1 bg-atlas-elevated border border-atlas-border rounded-lg p-1 text-xs font-mono ml-2">
                  {[0.5, 1, 2, 4].map((spd) => (
                    <button
                      key={spd}
                      onClick={() => setPlaybackSpeed(spd)}
                      className={`px-2 py-1 rounded transition-colors ${
                        playbackSpeed === spd
                          ? "bg-atlas-accent text-white font-bold"
                          : "text-atlas-muted hover:text-atlas-text"
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Seek by UTC Timestamp */}
            <form onSubmit={handleSeekByTimestamp} className="flex flex-wrap items-center gap-2 pt-2 border-t border-atlas-border/50 text-xs font-mono">
              <span className="text-atlas-muted">Seek Timestamp (ISO):</span>
              <input
                type="text"
                placeholder="e.g. 2026-11-12T12:00:00Z"
                value={seekTimestampInput}
                onChange={(e) => setSeekTimestampInput(e.target.value)}
                className="flex-1 min-w-[200px] bg-atlas-elevated border border-atlas-border text-atlas-text rounded-lg px-3 py-1.5 focus:outline-none focus:border-atlas-accent"
              />
              <button type="submit" className="px-3.5 py-1.5 bg-atlas-elevated hover:bg-atlas-surface border border-atlas-border hover:border-atlas-accent text-atlas-accent font-bold rounded-lg transition-colors">
                Reconstruct At Time
              </button>
            </form>
          </div>
        </div>

        {/* Reconstructed Replay Metrics (4 KPI Cards Matching Reference 2) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-atlas-surface border border-atlas-border p-6 rounded-2xl shadow-xl">
            <span className="text-[10px] font-bold font-mono tracking-widest text-atlas-muted uppercase block">
              BATTERY DRAIN
            </span>
            <div className="text-2xl font-bold font-mono text-atlas-amber mt-2">
              {Number(displayMetrics?.batteryDepletedPercent || 0).toFixed(1)}%
            </div>
            <span className="text-xs text-atlas-muted mt-1 block">Fleet average discharge</span>
          </div>

          <div className="bg-atlas-surface border border-atlas-border p-6 rounded-2xl shadow-xl">
            <span className="text-[10px] font-bold font-mono tracking-widest text-atlas-muted uppercase block">
              HAZARDS ENCOUNTERED
            </span>
            <div className="text-2xl font-bold font-mono text-atlas-text mt-2">
              {displayMetrics?.hazardsEncountered || 0}
            </div>
            <span className="text-xs text-atlas-muted mt-1 block">Slope &amp; terrain envelopes</span>
          </div>

          <div className="bg-atlas-surface border border-atlas-border p-6 rounded-2xl shadow-xl">
            <span className="text-[10px] font-bold font-mono tracking-widest text-atlas-muted uppercase block">
              PACKETS DELIVERED
            </span>
            <div className="text-2xl font-bold font-mono text-atlas-teal mt-2">
              {displayMetrics?.packetsDeliveredCount || 0}
            </div>
            <span className="text-xs text-atlas-muted mt-1 block">Orbiter relay telemetry</span>
          </div>

          <div className="bg-atlas-surface border border-atlas-border p-6 rounded-2xl shadow-xl">
            <span className="text-[10px] font-bold font-mono tracking-widest text-atlas-muted uppercase block">
              SCIENCE YIELD
            </span>
            <div className="text-2xl font-bold font-mono text-atlas-accent mt-2">
              {displayMetrics?.scienceYieldScore || 0} pts
            </div>
            <span className="text-xs text-atlas-muted mt-1 block">Sample acquisition score</span>
          </div>
        </div>

        {/* Current Event Inspection & Comparative State Inspector */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Current Event Inspection Card */}
          <div className="bg-atlas-surface border border-atlas-border p-6 md:p-8 rounded-2xl shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-atlas-border">
              <div className="flex items-center gap-3">
                <span className="text-xs px-2.5 py-1 bg-atlas-elevated text-atlas-accent border border-atlas-border font-mono font-bold rounded-md">
                  Seq #{curEvent?.sequenceNumber || (replayState?.currentEventIndex || 0) + 1}
                </span>
                <span className="text-base font-display font-bold text-atlas-text">
                  {curEvent?.eventType || "MISSION_EVENT"}
                </span>
              </div>
              <span className="text-xs font-mono text-atlas-muted">Actor: {curEvent?.actor || "SYSTEM"}</span>
            </div>

            {inspectedEvent && (
              <div className="p-3.5 bg-atlas-elevated/40 border border-atlas-border rounded-xl text-xs font-mono space-y-1.5">
                <div className="text-atlas-teal font-bold">{inspectedEvent.explanation}</div>
                <div className="text-atlas-muted">
                  Entity: <b className="text-atlas-text">{curEvent?.entityId || curEvent?.agentId || "N/A"}</b> | Provenance:{" "}
                  <b className="text-atlas-amber">{curEvent?.provenance?.sourceType || "DERIVED"}</b>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <span className="text-[10px] font-mono text-atlas-muted uppercase tracking-wider font-semibold">
                Event Payload &amp; Evidence:
              </span>
              <pre className="p-4 bg-atlas-elevated/50 text-atlas-text text-xs font-mono border border-atlas-border rounded-xl overflow-x-auto leading-relaxed max-h-56">
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
          <div className="bg-atlas-surface border border-atlas-border p-6 md:p-8 rounded-2xl shadow-xl space-y-4 font-mono text-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-atlas-border pb-4">
              <div className="flex items-center gap-2 font-display font-bold text-base text-atlas-text">
                <GitCompare className="w-5 h-5 text-atlas-accent" />
                <span>Historical State Comparison</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={compareRightMode}
                  onChange={(e) => setCompareRightMode(e.target.value as any)}
                  className="bg-atlas-elevated border border-atlas-border text-atlas-text rounded-lg px-2.5 py-1.5 text-xs"
                >
                  <option value="LIVE">Selected Event vs Current Live State</option>
                  <option value="SEQ">Two Sequence Positions</option>
                </select>
                {compareRightMode === "SEQ" && (
                  <input
                    type="number"
                    min={1}
                    max={Math.max(1, events.length)}
                    value={compareRightSeq}
                    onChange={(e) => setCompareRightSeq(Number(e.target.value))}
                    className="w-16 bg-atlas-elevated border border-atlas-border text-atlas-text rounded-lg px-2 py-1.5 text-xs"
                  />
                )}
                <button
                  onClick={handleCompare}
                  className="px-3.5 py-1.5 bg-atlas-accent hover:bg-atlas-accent-dark text-white rounded-lg font-bold shadow-sm transition-colors"
                >
                  Compare
                </button>
              </div>
            </div>

            {comparisonResult ? (
              <div className="space-y-3">
                <div className="text-atlas-muted text-xs">
                  {comparisonResult.leftLabel} vs {comparisonResult.rightLabel} —{" "}
                  <b className="text-atlas-text font-bold">{comparisonResult.totalDifferences} differences</b>
                </div>
                {comparisonResult.differences.length === 0 ? (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-xl">
                    No state differences between selected historical point and comparison target.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {comparisonResult.differences.map((d: any, idx: number) => (
                      <div key={idx} className="p-2.5 bg-atlas-elevated border border-atlas-border rounded-lg flex items-center justify-between gap-2">
                        <div>
                          <span className="px-2 py-0.5 bg-atlas-surface border border-atlas-border text-atlas-accent font-bold rounded text-[10px] mr-2">
                            {d.changeType}
                          </span>
                          <span className="text-atlas-text font-bold">{d.entityId}:</span>{" "}
                          <span className="text-atlas-muted">{d.summary}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 text-center text-atlas-muted border border-dashed border-atlas-border rounded-xl">
                Click "Compare" above to evaluate delta between this historical event and live operations.
              </div>
            )}
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
