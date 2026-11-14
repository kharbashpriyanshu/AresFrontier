import React, { useEffect, useState } from "react";
import { api } from "../services/api.js";
import { WhatIfSimulationResult } from "../types/index.js";
import {
  AlertTriangle,
  Play,
  CheckCircle2,
  XCircle,
  Sliders,
  Plus,
  Copy,
  Trash2,
  Save,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";

interface ScenarioBuilderProps {
  baselineMissionId?: string;
  onSimulationComplete?: (result: WhatIfSimulationResult) => void;
  className?: string;
}

export const ScenarioBuilder: React.FC<ScenarioBuilderProps> = ({
  baselineMissionId = "mission-jezero-sol100",
  onSimulationComplete,
  className = "",
}) => {
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [form, setForm] = useState<any>(null);
  const [outcome, setOutcome] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const loadScenarios = async (selectId?: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const list = await api.listScenarios();
      setScenarios(list);
      const target = (selectId ? list.find((s) => s.id === selectId) : undefined) || list[0];
      if (target) {
        setSelectedId(target.id);
        setForm(JSON.parse(JSON.stringify(target)));
        setOutcome(target.lastExecution || null);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load scenarios.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadScenarios();
  }, []);

  const handleSelect = (id: string) => {
    const found = scenarios.find((s) => s.id === id);
    if (found) {
      setSelectedId(found.id);
      setForm(JSON.parse(JSON.stringify(found)));
      setOutcome(found.lastExecution || null);
      setError(null);
      setStatusMsg(null);
    }
  };

  const handleCreateNew = async () => {
    try {
      setIsSaving(true);
      setError(null);
      const created = await api.createScenario({
        name: `Custom Scenario ${scenarios.length + 1}`,
        description: "Operator-configured mission stress scenario",
        baselineMissionId,
        routeId: "route-jezero-delta-sol100",
        durationMinutes: 180,
        agents: {
          rover01Available: true,
          rover02Available: true,
          astronaut01Available: true,
          requiredCapabilities: ["HAZARD_LIDAR", "ROTARY_DRILL"],
        },
        resources: {
          initialBatteryPercent: 85,
          batteryDegradationMultiplier: 1.15,
          oxygenReserveMinutes: 220,
          sampleStorageKg: 12,
        },
        comms: {
          surfaceRelayAvailable: true,
          orbiterRelayAvailable: true,
          blackoutWindowMinutes: 20,
        },
        terrain: {
          maxAllowedSlopeDeg: 20,
          hazardEscalationFactor: 1.1,
          restrictedZones: ["Kodiak Steep Scarp (>20°)"],
        },
        science: {
          objectivePriority: "ANCIENT_WATER_ACTIVITY",
          targetIds: ["target-jezero-01"],
          instrumentFailure: false,
        },
        conditions: ["BATTERY_DEGRADATION"],
      });
      setStatusMsg(`Created scenario "${created.name}".`);
      await loadScenarios(created.id);
    } catch (err: any) {
      setError(err.message || "Failed to create scenario.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!form || !selectedId) return;
    try {
      setIsSaving(true);
      setError(null);
      const updated = await api.updateScenario(selectedId, {
        name: form.name,
        description: form.description,
        durationMinutes: Number(form.durationMinutes),
        agents: form.agents,
        resources: {
          initialBatteryPercent: Number(form.resources.initialBatteryPercent),
          batteryDegradationMultiplier: Number(form.resources.batteryDegradationMultiplier),
          oxygenReserveMinutes: Number(form.resources.oxygenReserveMinutes),
          sampleStorageKg: Number(form.resources.sampleStorageKg),
        },
        comms: {
          ...form.comms,
          blackoutWindowMinutes: Number(form.comms.blackoutWindowMinutes),
        },
        terrain: {
          ...form.terrain,
          maxAllowedSlopeDeg: Number(form.terrain.maxAllowedSlopeDeg),
          hazardEscalationFactor: Number(form.terrain.hazardEscalationFactor),
        },
        science: form.science,
      });
      setStatusMsg(`Saved scenario "${updated.name}".`);
      await loadScenarios(updated.id);
    } catch (err: any) {
      setError(err.message || "Invalid scenario parameters.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDuplicate = async () => {
    if (!selectedId) return;
    try {
      setIsSaving(true);
      setError(null);
      const copy = await api.duplicateScenario(selectedId);
      setStatusMsg(`Duplicated scenario as "${copy.name}".`);
      await loadScenarios(copy.id);
    } catch (err: any) {
      setError(err.message || "Failed to duplicate scenario.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId || scenarios.length <= 1) return;
    try {
      setIsSaving(true);
      setError(null);
      await api.deleteScenario(selectedId);
      setStatusMsg("Deleted scenario.");
      await loadScenarios();
    } catch (err: any) {
      setError(err.message || "Failed to delete scenario.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleExecute = async () => {
    if (!selectedId) return;
    try {
      setIsExecuting(true);
      setError(null);
      await handleSave();
      const res = await api.executeScenario(selectedId);
      setOutcome(res);
      setStatusMsg(`Executed isolated SIMULATED scenario (${res.executionId}). Live mission state untouched.`);
      if (onSimulationComplete && res.whatIfSummary) {
        onSimulationComplete({
          simulationId: res.whatIfSummary.simulationId,
          routeFeasible: res.feasible,
          missionSuccessProbability: res.monteCarloSuccessProbability,
        } as any);
      }
      await loadScenarios(selectedId);
    } catch (err: any) {
      setError(err.message || "Scenario execution failed.");
    } finally {
      setIsExecuting(false);
    }
  };

  if (isLoading && !form) {
    return (
      <div className="bg-atlas-surface border border-atlas-border rounded-lg p-6 text-xs font-mono text-atlas-muted">
        Loading persisted scenarios...
      </div>
    );
  }

  return (
    <div className={`bg-atlas-surface border border-atlas-border rounded-lg p-4 md:p-6 space-y-5 ${className}`}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-atlas-border pb-4">
        <div>
          <h3 className="text-base font-bold font-display text-atlas-text flex items-center gap-2">
            <Sliders className="w-4 h-4 text-atlas-accent" />
            <span>Dynamic Scenario Builder (Isolated SIMULATED Execution)</span>
          </h3>
          <p className="text-xs font-mono text-atlas-muted mt-0.5">
            Save, load, duplicate, edit, and stress-test mission configurations against cloned state without mutating live missions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleCreateNew}
            disabled={isSaving}
            className="px-3 py-1.5 rounded bg-atlas-elevated hover:bg-atlas-elevated/80 border border-atlas-border text-xs font-mono text-atlas-text flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> New
          </button>
          <button
            onClick={handleDuplicate}
            disabled={isSaving || !selectedId}
            className="px-3 py-1.5 rounded bg-atlas-elevated hover:bg-atlas-elevated/80 border border-atlas-border text-xs font-mono text-atlas-text flex items-center gap-1.5"
          >
            <Copy className="w-3.5 h-3.5" /> Duplicate
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !selectedId}
            className="px-3 py-1.5 rounded bg-atlas-teal/20 hover:bg-atlas-teal/30 border border-atlas-teal/40 text-xs font-mono text-atlas-teal flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" /> Save
          </button>
          <button
            onClick={handleDelete}
            disabled={isSaving || scenarios.length <= 1}
            className="px-3 py-1.5 rounded bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-xs font-mono text-red-400 flex items-center gap-1.5 disabled:opacity-40"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
          <button
            onClick={handleExecute}
            disabled={isExecuting || !selectedId}
            className="px-4 py-1.5 rounded bg-atlas-accent hover:bg-atlas-accent/90 text-xs font-mono font-bold text-white flex items-center gap-1.5"
          >
            {isExecuting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isExecuting ? "Simulating..." : "Execute Isolated"}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-mono flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {statusMsg && (
        <div className="p-3 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
          {statusMsg}
        </div>
      )}

      {/* Scenario Selector + Editor */}
      {form && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Saved Scenarios List */}
          <div className="lg:col-span-4 space-y-2">
            <div className="text-[11px] font-mono text-atlas-muted uppercase tracking-wider">
              Saved Scenarios ({scenarios.length})
            </div>
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {scenarios.map((sc) => (
                <button
                  key={sc.id}
                  onClick={() => handleSelect(sc.id)}
                  className={`w-full text-left p-3 rounded border transition-colors ${
                    sc.id === selectedId
                      ? "bg-atlas-accent/15 border-atlas-accent text-atlas-text"
                      : "bg-atlas-elevated/40 border-atlas-border text-atlas-muted hover:text-atlas-text"
                  }`}
                >
                  <div className="text-xs font-bold font-display text-atlas-text">{sc.name}</div>
                  <div className="text-[11px] font-mono text-atlas-muted mt-0.5 line-clamp-2">
                    {sc.durationMinutes}m · Batt {sc.resources.initialBatteryPercent}% · O2 {sc.resources.oxygenReserveMinutes}m
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right: Scenario Parameters */}
          <div className="lg:col-span-8 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-mono text-atlas-muted block mb-1">Scenario Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-atlas-elevated border border-atlas-border rounded px-3 py-1.5 text-xs font-mono text-atlas-text"
                />
              </div>
              <div>
                <label className="text-[11px] font-mono text-atlas-muted block mb-1">Duration (minutes)</label>
                <input
                  type="number"
                  value={form.durationMinutes}
                  onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })}
                  className="w-full bg-atlas-elevated border border-atlas-border rounded px-3 py-1.5 text-xs font-mono text-atlas-text"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-[11px] font-mono text-atlas-muted block mb-1">Description</label>
                <input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full bg-atlas-elevated border border-atlas-border rounded px-3 py-1.5 text-xs font-mono text-atlas-text"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-atlas-elevated/30 p-3 rounded border border-atlas-border">
              <div>
                <label className="text-[10px] font-mono text-atlas-muted block mb-1">Initial Battery %</label>
                <input
                  type="number"
                  value={form.resources.initialBatteryPercent}
                  onChange={(e) =>
                    setForm({ ...form, resources: { ...form.resources, initialBatteryPercent: Number(e.target.value) } })
                  }
                  className="w-full bg-atlas-surface border border-atlas-border rounded px-2 py-1 text-xs font-mono text-atlas-text"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-atlas-muted block mb-1">Batt Degradation (x)</label>
                <input
                  type="number"
                  step="0.05"
                  value={form.resources.batteryDegradationMultiplier}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      resources: { ...form.resources, batteryDegradationMultiplier: Number(e.target.value) },
                    })
                  }
                  className="w-full bg-atlas-surface border border-atlas-border rounded px-2 py-1 text-xs font-mono text-atlas-text"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-atlas-muted block mb-1">O2 Reserve (min)</label>
                <input
                  type="number"
                  value={form.resources.oxygenReserveMinutes}
                  onChange={(e) =>
                    setForm({ ...form, resources: { ...form.resources, oxygenReserveMinutes: Number(e.target.value) } })
                  }
                  className="w-full bg-atlas-surface border border-atlas-border rounded px-2 py-1 text-xs font-mono text-atlas-text"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-atlas-muted block mb-1">Sample Storage (kg)</label>
                <input
                  type="number"
                  value={form.resources.sampleStorageKg}
                  onChange={(e) =>
                    setForm({ ...form, resources: { ...form.resources, sampleStorageKg: Number(e.target.value) } })
                  }
                  className="w-full bg-atlas-surface border border-atlas-border rounded px-2 py-1 text-xs font-mono text-atlas-text"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-atlas-muted block mb-1">Max Slope (°)</label>
                <input
                  type="number"
                  value={form.terrain.maxAllowedSlopeDeg}
                  onChange={(e) =>
                    setForm({ ...form, terrain: { ...form.terrain, maxAllowedSlopeDeg: Number(e.target.value) } })
                  }
                  className="w-full bg-atlas-surface border border-atlas-border rounded px-2 py-1 text-xs font-mono text-atlas-text"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-atlas-muted block mb-1">Hazard Escalation (x)</label>
                <input
                  type="number"
                  step="0.1"
                  value={form.terrain.hazardEscalationFactor}
                  onChange={(e) =>
                    setForm({ ...form, terrain: { ...form.terrain, hazardEscalationFactor: Number(e.target.value) } })
                  }
                  className="w-full bg-atlas-surface border border-atlas-border rounded px-2 py-1 text-xs font-mono text-atlas-text"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-atlas-muted block mb-1">Blackout Window (min)</label>
                <input
                  type="number"
                  value={form.comms.blackoutWindowMinutes}
                  onChange={(e) =>
                    setForm({ ...form, comms: { ...form.comms, blackoutWindowMinutes: Number(e.target.value) } })
                  }
                  className="w-full bg-atlas-surface border border-atlas-border rounded px-2 py-1 text-xs font-mono text-atlas-text"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-atlas-muted block mb-1">Objective Priority</label>
                <select
                  value={form.science.objectivePriority}
                  onChange={(e) =>
                    setForm({ ...form, science: { ...form.science, objectivePriority: e.target.value } })
                  }
                  className="w-full bg-atlas-surface border border-atlas-border rounded px-2 py-1 text-xs font-mono text-atlas-text"
                >
                  <option value="ANCIENT_WATER_ACTIVITY">Ancient Water</option>
                  <option value="BIOSIGNATURE_PRESERVATION">Biosignatures</option>
                  <option value="SUBSURFACE_ICE_DETECTION">Subsurface Ice</option>
                </select>
              </div>
            </div>

            {/* Toggles for Fleet, Comms & Instrument Failure */}
            <div className="flex flex-wrap gap-3 text-xs font-mono">
              <label className="flex items-center gap-1.5 text-atlas-text cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.agents.rover01Available}
                  onChange={(e) => setForm({ ...form, agents: { ...form.agents, rover01Available: e.target.checked } })}
                />
                ROVER-01
              </label>
              <label className="flex items-center gap-1.5 text-atlas-text cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.agents.rover02Available}
                  onChange={(e) => setForm({ ...form, agents: { ...form.agents, rover02Available: e.target.checked } })}
                />
                ROVER-02
              </label>
              <label className="flex items-center gap-1.5 text-atlas-text cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.agents.astronaut01Available}
                  onChange={(e) =>
                    setForm({ ...form, agents: { ...form.agents, astronaut01Available: e.target.checked } })
                  }
                />
                ASTRONAUT-01
              </label>
              <label className="flex items-center gap-1.5 text-atlas-text cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.comms.surfaceRelayAvailable}
                  onChange={(e) =>
                    setForm({ ...form, comms: { ...form.comms, surfaceRelayAvailable: e.target.checked } })
                  }
                />
                Surface Relay
              </label>
              <label className="flex items-center gap-1.5 text-atlas-text cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.comms.orbiterRelayAvailable}
                  onChange={(e) =>
                    setForm({ ...form, comms: { ...form.comms, orbiterRelayAvailable: e.target.checked } })
                  }
                />
                Orbiter Relay
              </label>
              <label className="flex items-center gap-1.5 text-amber-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.science.instrumentFailure}
                  onChange={(e) =>
                    setForm({ ...form, science: { ...form.science, instrumentFailure: e.target.checked } })
                  }
                />
                Simulate Instrument Failure
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Isolated Simulation Outcome */}
      {outcome && (
        <div className="border-t border-atlas-border pt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-mono font-bold">
                {outcome.mode} · ISOLATED SNAPSHOT
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                  outcome.feasible
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                    : "bg-red-500/20 text-red-400 border-red-500/30"
                }`}
              >
                {outcome.feasible ? "SCENARIO FEASIBLE" : "SAFETY / FEASIBILITY BREACH"}
              </span>
            </div>
            <span className="text-[11px] font-mono text-atlas-muted">
              Execution ID: {outcome.executionId}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="p-3 rounded bg-atlas-elevated/40 border border-atlas-border">
              <div className="text-[10px] font-mono text-atlas-muted">Projected Battery</div>
              <div className="text-base font-bold font-mono text-atlas-text">{outcome.projectedBatteryPercent}%</div>
            </div>
            <div className="p-3 rounded bg-atlas-elevated/40 border border-atlas-border">
              <div className="text-[10px] font-mono text-atlas-muted">Projected O2</div>
              <div className="text-base font-bold font-mono text-atlas-text">{outcome.projectedOxygenMinutes} min</div>
            </div>
            <div className="p-3 rounded bg-atlas-elevated/40 border border-atlas-border">
              <div className="text-[10px] font-mono text-atlas-muted">Comms Coverage</div>
              <div className="text-base font-bold font-mono text-atlas-text">{outcome.commsCoveragePercent}%</div>
            </div>
            <div className="p-3 rounded bg-atlas-elevated/40 border border-atlas-border">
              <div className="text-[10px] font-mono text-atlas-muted">MC Success Prob</div>
              <div className="text-base font-bold font-mono text-atlas-accent">{outcome.monteCarloSuccessProbability}%</div>
            </div>
            <div className="p-3 rounded bg-atlas-elevated/40 border border-atlas-border">
              <div className="text-[10px] font-mono text-atlas-muted">Simulated Science</div>
              <div className="text-base font-bold font-mono text-atlas-teal">{outcome.estimatedScienceYield} pts</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3 rounded bg-atlas-elevated/30 border border-atlas-border space-y-1.5">
              <div className="text-[11px] font-mono font-bold text-atlas-text flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-atlas-accent" /> Safety Invariant Checks
              </div>
              {outcome.safetyChecks?.map((c: any, idx: number) => (
                <div key={idx} className="flex items-start gap-2 text-xs font-mono">
                  {c.passed ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className="font-bold text-atlas-text">{c.invariantId}:</span>{" "}
                    <span className="text-atlas-muted">{c.violationReason || c.description}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 rounded bg-atlas-elevated/30 border border-atlas-border space-y-1">
              <div className="text-[11px] font-mono font-bold text-atlas-text">Model Assumptions & Provenance</div>
              <ul className="list-disc pl-4 space-y-0.5 text-[11px] font-mono text-atlas-muted">
                {outcome.assumptions?.map((a: string, idx: number) => (
                  <li key={idx}>{a}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
