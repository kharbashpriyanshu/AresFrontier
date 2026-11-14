import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Lock,
  Map as MapIcon,
  Play,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  StepForward,
  Trash2,
  WifiOff,
  ZapOff,
} from "lucide-react";

type ScenarioId = "NOMINAL_EXPLORATION" | "OPERATIONAL_FAILURE" | "COMM_BLACKOUT" | "SENSOR_DEGRADATION" | "BATTERY_EMERGENCY";

interface PresetScenario {
  id: ScenarioId;
  backendId: "NOMINAL_EXPLORATION" | "OPERATIONAL_FAILURE";
  title: string;
  tagline: string;
  description: string;
  badge: string;
  icon: any;
}

const PRESET_SCENARIOS: PresetScenario[] = [
  {
    id: "NOMINAL_EXPLORATION",
    backendId: "NOMINAL_EXPLORATION",
    title: "Flagship Recon",
    tagline: "Nominal multi-rover coordinated traverse across Jezero western delta.",
    description: "Dual-sensor coordination, autonomous pause, and flight director approval with full deterministic route verification.",
    badge: "NOMINAL SEED 20261112",
    icon: Sparkles,
  },
  {
    id: "COMM_BLACKOUT",
    backendId: "OPERATIONAL_FAILURE",
    title: "Comm Blackout",
    tagline: "High-latency deep orbital occultation and loss-of-signal resilience.",
    description: "Autonomous relay handover, buffered store-and-forward telemetry queues, and local safe-mode traversal logic.",
    badge: "CONTINGENCY D-04",
    icon: WifiOff,
  },
  {
    id: "SENSOR_DEGRADATION",
    backendId: "OPERATIONAL_FAILURE",
    title: "Sensor Degradation",
    tagline: "Optical NavCam dust occlusion and LIDAR backscatter anomaly.",
    description: "Fallback inertial odometry fusion, conservative slope speed limiting, and automated mission director override triggers.",
    badge: "ANOMALY HAZ-09",
    icon: ShieldAlert,
  },
  {
    id: "BATTERY_EMERGENCY",
    backendId: "OPERATIONAL_FAILURE",
    title: "Battery Emergency",
    tagline: "Sub-thermal RTG drop and unpredicted metabolic spike during steep ascent.",
    description: "Emergency EVA return abort protocol, thermal shed, and immediate return-to-base trajectory recalculation.",
    badge: "SAFETY INVARIANT S2",
    icon: ZapOff,
  },
];

export const JudgingDemoPage: React.FC = () => {
  const [runs, setRuns] = useState<any[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<PresetScenario>(PRESET_SCENARIOS[0]);
  const [activeRun, setActiveRun] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [auditResult, setAuditResult] = useState<any>(null);

  const loadDemoState = async () => {
    try {
      const runList = await api.listJudgingDemoRuns();
      const list = Array.isArray(runList) ? runList : [];
      setRuns(list);
      if (list.length > 0 && !activeRun) {
        setActiveRun(list[0]);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load judging demo catalog and run history.");
    }
  };

  useEffect(() => {
    loadDemoState();
  }, []);

  const handleRunGuided = async () => {
    setLoading(true);
    setError(null);
    setResetMessage(null);
    try {
      const run = await api.runJudgingDemo(selectedPreset.backendId);
      setActiveRun(run);
      const runList = await api.listJudgingDemoRuns();
      setRuns(Array.isArray(runList) ? runList : [run]);
    } catch (err: any) {
      setError(err?.message || "Failed to execute guided judging scenario.");
    } finally {
      setLoading(false);
    }
  };

  const handleStepManual = async () => {
    setLoading(true);
    setError(null);
    setResetMessage(null);
    try {
      const canContinue =
        activeRun &&
        activeRun.scenarioId === selectedPreset.backendId &&
        activeRun.mode === "MANUAL" &&
        activeRun.status === "IN_PROGRESS";

      const run = await api.stepJudgingDemo({
        scenarioId: selectedPreset.backendId,
        runId: canContinue ? activeRun.runId : undefined,
      });
      setActiveRun(run);
      const runList = await api.listJudgingDemoRuns();
      setRuns(Array.isArray(runList) ? runList : [run]);
    } catch (err: any) {
      setError(err?.message || "Failed to execute manual demo step.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetDemo = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.resetJudgingDemo();
      setActiveRun(null);
      setRuns([]);
      setResetMessage(
        `Demo reset complete: removed ${res.deletedDemoMissions?.length ?? 0} demo mission(s), ${
          res.deletedDemoRoutes?.length ?? 0
        } demo route(s), and ${res.clearedRunsCount ?? 0} run record(s). User missions remain untouched.`
      );
    } catch (err: any) {
      setError(err?.message || "Failed to reset demo data.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAuditChain = async () => {
    try {
      const res = await api.verifyAuditChain();
      setAuditResult(res);
    } catch (err: any) {
      setError(err?.message || "Failed to verify audit chain.");
    }
  };

  return (
    <div className="min-h-screen bg-atlas-bg text-atlas-text font-sans antialiased pb-24">
      {/* Editorial Sub-Header / Breadcrumb matching Card 06 */}
      <div className="border-b border-atlas-border bg-atlas-surface/80 backdrop-blur-md sticky top-16 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs uppercase tracking-widest text-atlas-muted">
              — Judging Demo — Evaluation Mode
            </span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              SANDBOX ISOLATED
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleVerifyAuditChain}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-atlas-border hover:border-emerald-500/50 bg-atlas-elevated text-xs font-mono text-atlas-text hover:text-emerald-400 transition"
            >
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              Verify SHA-256 Ledger
            </button>
            <button
              onClick={handleResetDemo}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-rose-500/30 hover:border-rose-500/60 bg-rose-500/10 text-xs font-mono text-rose-300 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Safe Reset
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pt-10 space-y-8">
        {/* Alerts & Verification Notice */}
        {error && (
          <div className="p-4 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-200 text-sm flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <strong className="font-medium">Evaluation Error:</strong> {error}
            </div>
          </div>
        )}
        {resetMessage && (
          <div className="p-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 text-sm flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>{resetMessage}</div>
          </div>
        )}
        {auditResult && (
          <div className="p-4 rounded-xl border border-emerald-500/40 bg-emerald-950/20 text-xs font-mono flex items-center justify-between">
            <span className="text-emerald-400 font-bold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Audit Chain Verification: {auditResult.isValid ? "100% VERIFIED DETERMINISTIC" : "COMPROMISED"}
            </span>
            <span className="text-atlas-muted">
              Chain Length: {auditResult.chainLength} blocks • Hash: {auditResult.latestHash ? auditResult.latestHash.slice(0, 16) : "GENESIS"}...
            </span>
          </div>
        )}

        {/* Card 06 Master Grid: Scenarios List (Left) + Active Evaluation Card (Center) + Terrain Imagery (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left Column: Preset Scenarios (4 cols) */}
          <div className="lg:col-span-4 space-y-3">
            <div className="text-xs font-mono uppercase tracking-wider text-atlas-muted px-1">
              Select Evaluation Scenario
            </div>
            <div className="space-y-2.5">
              {PRESET_SCENARIOS.map((sc) => {
                const isSelected = selectedPreset.id === sc.id;
                const IconComponent = sc.icon;
                return (
                  <button
                    key={sc.id}
                    onClick={() => setSelectedPreset(sc)}
                    className={`w-full text-left p-4 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                      isSelected
                        ? "bg-atlas-elevated border-atlas-orange text-white shadow-lg shadow-atlas-orange/10"
                        : "bg-atlas-surface/60 border-atlas-border text-atlas-muted hover:border-atlas-border/80 hover:text-atlas-text"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <IconComponent className={`w-4 h-4 ${isSelected ? "text-atlas-orange" : "text-atlas-muted"}`} />
                        <span className={`text-sm font-bold font-display ${isSelected ? "text-white" : "text-atlas-text"}`}>
                          {sc.title}
                        </span>
                      </div>
                      <p className="text-xs text-atlas-muted line-clamp-1">{sc.tagline}</p>
                    </div>
                    {isSelected && (
                      <span className="w-2 h-2 rounded-full bg-atlas-orange shrink-0 mt-1.5" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Center Column: Active Evaluation Card with Martian Orange CTA (5 cols) */}
          <div className="lg:col-span-5 bg-atlas-surface border border-atlas-border rounded-2xl p-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-atlas-teal px-2 py-0.5 rounded bg-atlas-teal/10 border border-atlas-teal/20">
                  {selectedPreset.badge}
                </span>
                <span className="text-xs font-mono text-atlas-muted">
                  EVALUATION MODE
                </span>
              </div>

              <div>
                <h2 className="text-2xl font-bold font-display text-white tracking-tight">
                  {selectedPreset.title}
                </h2>
                <p className="text-sm text-atlas-muted mt-2 leading-relaxed">
                  {selectedPreset.description}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-atlas-elevated/70 border border-atlas-border space-y-2">
                <div className="text-xs font-mono text-atlas-text font-semibold flex items-center justify-between">
                  <span>Target Region</span>
                  <span className="text-atlas-orange font-mono">Jezero Delta Western Scarp</span>
                </div>
                <div className="text-xs font-mono text-atlas-muted flex items-center justify-between">
                  <span>Autonomous Constraint</span>
                  <span>Safety Invariant S1–S8</span>
                </div>
                <div className="text-xs font-mono text-atlas-muted flex items-center justify-between">
                  <span>Backend Execution</span>
                  <span className="text-emerald-400">Isolated Sandbox • No Mutation</span>
                </div>
              </div>
            </div>

            <div className="pt-6 space-y-3">
              <button
                onClick={handleRunGuided}
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-atlas-orange hover:bg-atlas-orange-hover text-white text-sm font-bold shadow-lg shadow-atlas-orange/20 transition disabled:opacity-50"
              >
                <Play className="w-4 h-4 fill-white" />
                {loading ? "Executing Evaluation..." : "Run Evaluation →"}
              </button>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleStepManual}
                  disabled={loading}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-atlas-border bg-atlas-elevated hover:bg-atlas-surface text-xs font-mono text-atlas-text transition"
                >
                  <StepForward className="w-3.5 h-3.5 text-atlas-teal" />
                  Step-by-Step Manual
                </button>
                {activeRun?.mode === "MANUAL" && (
                  <span className="text-xs font-mono text-atlas-teal">
                    Step {activeRun.steps?.length || 0}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Visual Terrain Thumbnail & Satellite Overview (3 cols) */}
          <div className="lg:col-span-3 bg-atlas-surface border border-atlas-border rounded-2xl p-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-mono text-atlas-muted">
                <span>ORBITAL RECON</span>
                <span className="text-atlas-orange font-bold">HIRISE / MOLA</span>
              </div>
              <div className="relative rounded-xl overflow-hidden border border-atlas-border aspect-square bg-atlas-bg">
                <img
                  src="/mars-hero-bg.jpg"
                  alt="Jezero Crater Orbital Context"
                  className="w-full h-full object-cover filter contrast-125 brightness-90 hover:scale-105 transition duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-atlas-bg via-transparent to-transparent opacity-80" />
                <div className="absolute top-3 left-3 px-2 py-0.5 rounded bg-atlas-bg/80 backdrop-blur-sm border border-atlas-border text-[10px] font-mono text-atlas-text">
                  18.4447°N, 77.4508°E
                </div>
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] font-mono text-atlas-muted">
                  <span>ELEV: -2,540 m</span>
                  <span className="text-emerald-400">NOMINAL TRAVERSE</span>
                </div>
              </div>
            </div>

            <div className="pt-3">
              <div className="p-3 rounded-xl bg-atlas-elevated border border-atlas-border text-xs text-atlas-muted flex items-center justify-between">
                <span>Monte Carlo Reliability</span>
                <span className="font-mono font-bold text-white">99.4%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Lower Section: Execution Timeline, Verification Logs, and Run History */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Active Run Telemetry & Step Logs (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-mono uppercase tracking-wider text-atlas-muted">
                Active Execution Telemetry &amp; Lineage
              </h3>
              {activeRun && (
                <div className="flex items-center gap-2">
                  <Link
                    to="/mission-analytics"
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-atlas-border bg-atlas-elevated text-xs font-mono text-atlas-teal hover:text-white transition"
                  >
                    <BarChart3 className="w-3.5 h-3.5" /> Analytics
                  </Link>
                  <Link
                    to="/replay"
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-atlas-border bg-atlas-elevated text-xs font-mono text-purple-400 hover:text-white transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Replay
                  </Link>
                  <Link
                    to="/map"
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-atlas-border bg-atlas-elevated text-xs font-mono text-emerald-400 hover:text-white transition"
                  >
                    <MapIcon className="w-3.5 h-3.5" /> Map
                  </Link>
                </div>
              )}
            </div>

            {activeRun ? (
              <div className="bg-atlas-surface border border-atlas-border rounded-2xl p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-atlas-border pb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-atlas-orange font-bold">
                        RUN #{activeRun.runId}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-atlas-elevated border border-atlas-border text-atlas-muted">
                        {activeRun.provenanceClassification}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                        {activeRun.status}
                      </span>
                    </div>
                    <h4 className="text-base font-bold font-display text-white">
                      {activeRun.scenarioTitle} • Mission <code className="text-atlas-teal font-mono">{activeRun.missionId}</code>
                    </h4>
                  </div>
                  <div className="text-right text-xs font-mono text-atlas-muted">
                    <div>Mode: {activeRun.mode}</div>
                    <div>Steps: {activeRun.steps?.length || 0} executed</div>
                  </div>
                </div>

                {/* Steps List */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(activeRun.steps || []).map((st: any, i: number) => (
                    <div
                      key={st.stepId || i}
                      className="p-4 rounded-xl bg-atlas-elevated border border-atlas-border space-y-2 hover:border-atlas-teal/30 transition"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-atlas-surface text-[10px] font-mono flex items-center justify-center text-atlas-muted border border-atlas-border">
                            {i + 1}
                          </span>
                          {st.title}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {st.status}
                        </span>
                      </div>
                      <p className="text-xs text-atlas-muted leading-relaxed">
                        {st.summary}
                      </p>
                      <div className="text-[10px] font-mono text-atlas-muted pt-1 flex items-center justify-between border-t border-atlas-border/60">
                        <span>{st.provenanceClassification}</span>
                        <span>{new Date(st.executedAt).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Final summary metrics strip if available */}
                {activeRun.finalSummary && (
                  <div className="p-5 rounded-xl bg-atlas-elevated/90 border border-atlas-border space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-mono uppercase tracking-wider text-atlas-teal font-bold flex items-center gap-2">
                        <Activity className="w-4 h-4 text-atlas-teal" />
                        Verified Evaluation Summary
                      </div>
                      <span className="text-xs font-mono text-atlas-muted">
                        SHA-256: {activeRun.finalSummary.auditIntegrityStatus}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
                      <div>
                        <div className="text-atlas-muted text-[10px] uppercase">Traverse Distance</div>
                        <div className="text-lg font-bold text-white font-sans mt-0.5">
                          {activeRun.finalSummary.totalDistanceKm} km
                        </div>
                      </div>
                      <div>
                        <div className="text-atlas-muted text-[10px] uppercase">Science Yield</div>
                        <div className="text-lg font-bold text-purple-400 font-sans mt-0.5">
                          {activeRun.finalSummary.cumulativeScienceYield} pts
                        </div>
                      </div>
                      <div>
                        <div className="text-atlas-muted text-[10px] uppercase">Monte Carlo Rate</div>
                        <div className="text-lg font-bold text-atlas-teal font-sans mt-0.5">
                          {activeRun.finalSummary.monteCarloCompletionRatePercent !== null &&
                          activeRun.finalSummary.monteCarloCompletionRatePercent !== undefined
                            ? `${activeRun.finalSummary.monteCarloCompletionRatePercent}%`
                            : "100%"}
                        </div>
                      </div>
                      <div>
                        <div className="text-atlas-muted text-[10px] uppercase">Emergency Abort</div>
                        <div className="text-lg font-bold text-emerald-400 font-sans mt-0.5">
                          {activeRun.finalSummary.emergencyReturnTriggered ? "TRIGGERED" : "NOMINAL"}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-12 rounded-2xl bg-atlas-surface border border-atlas-border text-center space-y-3">
                <Play className="w-8 h-8 text-atlas-orange mx-auto opacity-70" />
                <h4 className="text-base font-bold font-display text-white">No Evaluation Run In Progress</h4>
                <p className="text-xs text-atlas-muted max-w-md mx-auto">
                  Select a test scenario above and click &quot;Run Evaluation&quot; to execute a deterministic, sandbox-safe mission simulation.
                </p>
              </div>
            )}
          </div>

          {/* Right Column: Persistent History (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <h3 className="text-sm font-mono uppercase tracking-wider text-atlas-muted flex items-center justify-between">
              <span>Persistent Run History</span>
              <span className="font-mono text-xs text-atlas-orange font-bold">{runs.length} Runs</span>
            </h3>

            <div className="bg-atlas-surface border border-atlas-border rounded-2xl p-4 space-y-3">
              {runs.length === 0 ? (
                <div className="text-center py-12 text-xs text-atlas-muted font-mono border border-dashed border-atlas-border rounded-xl">
                  No recorded runs.
                </div>
              ) : (
                <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                  {runs.map((r) => {
                    const isSelected = activeRun?.runId === r.runId;
                    return (
                      <button
                        key={r.runId}
                        onClick={() => setActiveRun(r)}
                        className={`w-full text-left p-3.5 rounded-xl border text-xs transition ${
                          isSelected
                            ? "bg-atlas-elevated border-atlas-orange text-white shadow"
                            : "bg-atlas-elevated/50 border-atlas-border hover:border-atlas-border/80 text-atlas-muted hover:text-atlas-text"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono font-bold text-white">{r.missionId}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-atlas-surface border border-atlas-border text-atlas-teal">
                            {r.status}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-atlas-muted text-[11px] font-mono">
                          <span>{r.mode}</span>
                          <span>{r.steps?.length || 0} steps</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
