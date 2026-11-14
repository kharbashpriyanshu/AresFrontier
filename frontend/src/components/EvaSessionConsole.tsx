import React, { useEffect, useState } from "react";
import { api } from "../services/api.js";
import { PlanetaryAgent } from "../types/index.js";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Pause,
  Play,
  Plus,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";

interface EvaSessionConsoleProps {
  missionId?: string;
  routeId?: string;
  agents: PlanetaryAgent[];
}

export const EvaSessionConsole: React.FC<EvaSessionConsoleProps> = ({ missionId, routeId, agents }) => {
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Create session form
  const [showCreate, setShowCreate] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>("");
  const [newDuration, setNewDuration] = useState<number>(240);
  const [newSupportRover, setNewSupportRover] = useState<string>("agent-rover-01");

  // Isolated emergency return simulation
  const [emergencySim, setEmergencySim] = useState<any | null>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  const loadSessions = async () => {
    try {
      setIsLoading(true);
      const data = await api.getEvaSessions(missionId);
      setSessions(data);
      if (data.length > 0 && (!selectedId || !data.some((s: any) => s.id === selectedId))) {
        setSelectedId(data[0].id);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load EVA sessions");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, [missionId]);

  const activeSession = sessions.find((s) => s.id === selectedId) || sessions[0];
  const rovers = agents.filter((a) => a.type === "ROVER");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const created = await api.createEvaSession({
        missionId: missionId || "MARSWALK-001",
        title: newTitle.trim(),
        crewAgentId: "agent-astronaut-01",
        supportRoverId: newSupportRover || undefined,
        routeId: routeId || "route-jezero-delta-sol100",
        plannedDurationMinutes: newDuration,
      });
      setNewTitle("");
      setShowCreate(false);
      await loadSessions();
      setSelectedId(created.id);
      setStatusMsg(`Created EVA session "${created.title}".`);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create EVA session");
    }
  };

  const handleTransition = async (
    action: "START" | "PAUSE" | "RESUME" | "EMERGENCY_RETURN" | "COMPLETE" | "ABORT"
  ) => {
    if (!activeSession) return;
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const updated = await api.transitionEvaSession(activeSession.id, action, `EVA Console: ${action}`);
      await loadSessions();
      setStatusMsg(`EVA session transitioned to ${updated.status}.`);
    } catch (err: any) {
      setErrorMsg(err.message || `Action ${action} rejected`);
    }
  };

  const handleAdvance = async (minutes: number) => {
    if (!activeSession) return;
    setErrorMsg(null);
    try {
      const updated = await api.advanceEvaSession(activeSession.id, minutes);
      await loadSessions();
      setStatusMsg(`Simulated +${minutes}m EVA elapsed (${updated.elapsedMinutes}m MET).`);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to advance EVA time");
    }
  };

  const handleSimulateEmergencyReturn = async () => {
    if (!activeSession) return;
    setIsSimulating(true);
    setErrorMsg(null);
    try {
      const res = await api.simulateEvaEmergencyReturn(activeSession.id, {
        scenario: "Dust Squall & Suit Cooling Contingency Return",
        speedFactor: 0.9,
        extraHazardDelayMinutes: 8,
      });
      setEmergencySim(res);
    } catch (err: any) {
      setErrorMsg(err.message || "Emergency return simulation failed");
    } finally {
      setIsSimulating(false);
    }
  };

  if (isLoading && sessions.length === 0) {
    return (
      <div className="p-6 bg-atlas-surface border border-atlas-border rounded-lg text-xs font-mono text-atlas-muted">
        Loading EVA Session Console...
      </div>
    );
  }

  return (
    <div className="space-y-4 font-mono text-xs">
      {/* Header & Session Selector */}
      <div className="bg-atlas-surface border border-atlas-border p-4 rounded-lg flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-atlas-text font-bold font-display text-sm">
            <Activity className="w-4 h-4 text-atlas-teal" />
            <span>EVA Session &amp; Safety Console</span>
          </div>
          {sessions.length > 0 && (
            <select
              aria-label="Select EVA session"
              value={activeSession?.id || ""}
              onChange={(e) => {
                setSelectedId(e.target.value);
                setEmergencySim(null);
              }}
              className="bg-atlas-elevated border border-atlas-border text-atlas-text px-2.5 py-1 rounded text-xs"
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} [{s.status}]
                </option>
              ))}
            </select>
          )}
        </div>

        <button
          onClick={() => setShowCreate((v) => !v)}
          className="px-3 py-1.5 bg-atlas-accent hover:bg-atlas-accent/90 text-white font-bold rounded flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{showCreate ? "Close" : "New EVA Session"}</span>
        </button>
      </div>

      {/* Feedback Banners */}
      {errorMsg && (
        <div className="p-3 bg-red-500/10 border border-red-500/40 text-red-300 rounded flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {statusMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 rounded flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* Create EVA Session Form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="bg-atlas-surface border border-atlas-border p-4 rounded-lg space-y-3">
          <div className="font-bold text-atlas-text">Create New EVA Session</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              required
              placeholder="EVA Session Title (e.g. Sol 102 Delta Rim EVA)"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="bg-atlas-elevated border border-atlas-border text-atlas-text p-2 rounded"
            />
            <select
              value={newSupportRover}
              onChange={(e) => setNewSupportRover(e.target.value)}
              className="bg-atlas-elevated border border-atlas-border text-atlas-text p-2 rounded"
            >
              <option value="">No Support Rover</option>
              {rovers.map((r) => (
                <option key={r.id} value={r.id}>
                  Support: {r.callsign} ({r.telemetry.batteryPercent}% batt)
                </option>
              ))}
            </select>
            <input
              type="number"
              min={30}
              max={480}
              step={15}
              value={newDuration}
              onChange={(e) => setNewDuration(Number(e.target.value))}
              className="bg-atlas-elevated border border-atlas-border text-atlas-text p-2 rounded"
            />
          </div>
          <button type="submit" className="px-4 py-1.5 bg-atlas-teal text-white font-bold rounded">
            Create EVA Session
          </button>
        </form>
      )}

      {/* Active EVA Session Detail */}
      {activeSession && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left 2 Cols: Lifecycle, MET & Safety */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-atlas-surface border border-atlas-border p-4 rounded-lg space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-atlas-border pb-3">
                <div>
                  <div className="text-sm font-bold text-atlas-text font-display">{activeSession.title}</div>
                  <div className="text-[10px] text-atlas-muted">
                    Session ID: {activeSession.id} | Mission: {activeSession.missionId} | Crew: {activeSession.crewAgentId}
                  </div>
                </div>
                <span
                  className={`px-2.5 py-1 rounded border font-bold text-xs ${
                    activeSession.status === "ACTIVE"
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      : activeSession.status === "EMERGENCY_RETURN"
                      ? "bg-red-500/20 text-red-300 border-red-500/40 animate-pulse"
                      : activeSession.status === "PAUSED"
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                      : "bg-atlas-elevated text-atlas-muted border-atlas-border"
                  }`}
                >
                  {activeSession.status}
                </span>
              </div>

              {/* Provenance Banner */}
              <div className="px-3 py-1.5 bg-atlas-elevated border border-atlas-border rounded text-[10px] text-atlas-amber flex items-center justify-between">
                <span>
                  Provenance: <b>{activeSession.telemetryProvenance?.sourceType || "SIMULATED"}</b> —{" "}
                  {activeSession.telemetryProvenance?.label || "Modeled Suit & Rover Telemetry"}
                </span>
                <span className="text-atlas-muted">
                  Updated: {new Date(activeSession.updatedAt).toLocaleTimeString()}
                </span>
              </div>

              {/* MET & Resource Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-atlas-elevated border border-atlas-border rounded">
                  <div className="text-[10px] text-atlas-muted uppercase">EVA Elapsed (MET)</div>
                  <div className="text-lg font-bold text-atlas-text">{activeSession.elapsedMinutes}m</div>
                </div>
                <div className="p-3 bg-atlas-elevated border border-atlas-border rounded">
                  <div className="text-[10px] text-atlas-muted uppercase">Remaining Window</div>
                  <div className="text-lg font-bold text-atlas-teal">{activeSession.remainingMinutes}m</div>
                </div>
                <div className="p-3 bg-atlas-elevated border border-atlas-border rounded">
                  <div className="text-[10px] text-atlas-muted uppercase">Suit O₂ Reserve (Sim)</div>
                  <div className="text-lg font-bold text-atlas-blue">
                    {activeSession.safetyChecks?.suitOxygenReserveMinutes ?? 240}m
                  </div>
                </div>
                <div className="p-3 bg-atlas-elevated border border-atlas-border rounded">
                  <div className="text-[10px] text-atlas-muted uppercase">Crew Battery (Sim)</div>
                  <div className="text-lg font-bold text-atlas-text">
                    {activeSession.safetyChecks?.crewBatteryPercent ?? 90}%
                  </div>
                </div>
              </div>

              {/* Lifecycle Action Controls */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-atlas-border">
                {activeSession.status === "PLANNED" && (
                  <button
                    onClick={() => handleTransition("START")}
                    className="px-3 py-1.5 bg-atlas-teal hover:bg-atlas-teal/90 text-white font-bold rounded flex items-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Start EVA</span>
                  </button>
                )}
                {activeSession.status === "ACTIVE" && (
                  <>
                    <button
                      onClick={() => handleTransition("PAUSE")}
                      className="px-3 py-1.5 bg-atlas-amber text-black font-bold rounded flex items-center gap-1.5"
                    >
                      <Pause className="w-3.5 h-3.5" />
                      <span>Pause EVA</span>
                    </button>
                    <button
                      onClick={() => handleAdvance(15)}
                      className="px-3 py-1.5 bg-atlas-elevated hover:bg-atlas-surface border border-atlas-border text-atlas-text font-bold rounded flex items-center gap-1.5"
                    >
                      <Clock className="w-3.5 h-3.5 text-atlas-blue" />
                      <span>+15m EVA Step</span>
                    </button>
                  </>
                )}
                {activeSession.status === "PAUSED" && (
                  <button
                    onClick={() => handleTransition("RESUME")}
                    className="px-3 py-1.5 bg-atlas-teal text-white font-bold rounded flex items-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Resume EVA</span>
                  </button>
                )}
                {(activeSession.status === "ACTIVE" || activeSession.status === "PAUSED") && (
                  <button
                    onClick={() => handleTransition("EMERGENCY_RETURN")}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded flex items-center gap-1.5"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Emergency Return</span>
                  </button>
                )}
                {(activeSession.status === "ACTIVE" ||
                  activeSession.status === "PAUSED" ||
                  activeSession.status === "EMERGENCY_RETURN") && (
                  <>
                    <button
                      onClick={() => handleTransition("COMPLETE")}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded flex items-center gap-1.5"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Complete EVA</span>
                    </button>
                    <button
                      onClick={() => handleTransition("ABORT")}
                      className="px-3 py-1.5 bg-atlas-elevated border border-red-500/40 text-red-300 font-bold rounded flex items-center gap-1.5"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Abort EVA</span>
                    </button>
                  </>
                )}
                <button
                  onClick={handleSimulateEmergencyReturn}
                  disabled={isSimulating}
                  className="ml-auto px-3 py-1.5 bg-atlas-elevated hover:bg-atlas-surface border border-atlas-accent text-atlas-accent font-bold rounded flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{isSimulating ? "Simulating..." : "Simulate Emergency Return (Isolated)"}</span>
                </button>
              </div>
            </div>

            {/* Isolated Emergency Return Simulation Output */}
            {emergencySim && (
              <div className="bg-atlas-surface border-2 border-atlas-accent p-4 rounded-lg space-y-3">
                <div className="flex items-center justify-between border-b border-atlas-border pb-2">
                  <span className="font-bold text-atlas-text">
                    Isolated Emergency Return Simulation ({emergencySim.outcome})
                  </span>
                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded text-[10px] font-bold">
                    Live State Untouched (Isolated)
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="p-2 bg-atlas-elevated border border-atlas-border rounded">
                    <div className="text-[10px] text-atlas-muted">Return Transit</div>
                    <div className="font-bold text-atlas-text">{emergencySim.estimatedReturnMinutes} min</div>
                  </div>
                  <div className="p-2 bg-atlas-elevated border border-atlas-border rounded">
                    <div className="text-[10px] text-atlas-muted">Projected O₂ at Airlock</div>
                    <div className="font-bold text-atlas-teal">{emergencySim.projectedOxygenAtBaseMinutes} min</div>
                  </div>
                  <div className="p-2 bg-atlas-elevated border border-atlas-border rounded">
                    <div className="text-[10px] text-atlas-muted">Projected Crew Battery</div>
                    <div className="font-bold text-atlas-blue">{emergencySim.projectedCrewBatteryAtBasePercent}%</div>
                  </div>
                </div>
                <div className="text-[11px] text-atlas-muted">
                  {emergencySim.recommendations?.join(" ")}
                </div>
              </div>
            )}
          </div>

          {/* Right Col: S1-S8 Safety & Persisted History */}
          <div className="space-y-4">
            <div className="bg-atlas-surface border border-atlas-border p-4 rounded-lg space-y-2.5">
              <div className="flex items-center gap-2 font-bold text-atlas-text border-b border-atlas-border pb-2">
                <ShieldCheck className="w-4 h-4 text-atlas-teal" />
                <span>S1–S8 Pre-EVA &amp; Live Safety Gate</span>
              </div>
              <div
                className={`p-2.5 rounded border text-xs font-bold ${
                  activeSession.safetyChecks?.overallSafe
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    : "bg-red-500/10 border-red-500/30 text-red-300"
                }`}
              >
                {activeSession.safetyChecks?.overallSafe
                  ? "NOMINAL — All S1–S8 Invariants Satisfied"
                  : "BLOCKED — Safety Invariant Violation"}
              </div>
              {activeSession.safetyChecks?.violations?.map((v: string, i: number) => (
                <div key={i} className="text-[11px] text-red-300 bg-red-500/10 p-2 rounded border border-red-500/30">
                  {v}
                </div>
              ))}
              {activeSession.safetyChecks?.warnings?.map((w: string, i: number) => (
                <div key={i} className="text-[11px] text-amber-300 bg-amber-500/10 p-2 rounded border border-amber-500/30">
                  {w}
                </div>
              ))}
            </div>

            <div className="bg-atlas-surface border border-atlas-border p-4 rounded-lg space-y-2">
              <div className="font-bold text-atlas-text border-b border-atlas-border pb-2">
                Persisted EVA Session History
              </div>
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {(activeSession.history || []).map((h: any, idx: number) => (
                  <div key={idx} className="p-2 bg-atlas-elevated border border-atlas-border rounded text-[10px]">
                    <div className="flex items-center justify-between font-bold text-atlas-text">
                      <span>{h.fromStatus ? `${h.fromStatus} -> ${h.toStatus}` : h.toStatus}</span>
                      <span className="text-atlas-muted">{new Date(h.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div className="text-atlas-muted">{h.reason}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

