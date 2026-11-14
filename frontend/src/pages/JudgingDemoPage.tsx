import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  History,
  Lock,
  Map as MapIcon,
  Play,
  RotateCcw,
  ShieldCheck,
  StepForward,
  Trash2,
} from "lucide-react";

type ScenarioId = "NOMINAL_EXPLORATION" | "OPERATIONAL_FAILURE";

export const JudgingDemoPage: React.FC = () => {
  const [catalog, setCatalog] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<ScenarioId>("NOMINAL_EXPLORATION");
  const [activeRun, setActiveRun] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [auditResult, setAuditResult] = useState<any>(null);

  const loadDemoState = async () => {
    try {
      const [cat, runList] = await Promise.all([
        api.getJudgingDemoCatalog(),
        api.listJudgingDemoRuns(),
      ]);
      setCatalog(Array.isArray(cat) ? cat : []);
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
      const run = await api.runJudgingDemo(selectedScenario);
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
        activeRun.scenarioId === selectedScenario &&
        activeRun.mode === "MANUAL" &&
        activeRun.status === "IN_PROGRESS";

      const run = await api.stepJudgingDemo({
        scenarioId: selectedScenario,
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

  const activeScenarioDef = catalog.find((c) => c.scenarioId === selectedScenario);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2 text-amber-400 text-xs font-mono uppercase tracking-widest mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span>Isolated End-to-End Judging Demonstration</span>
              <span className="px-2 py-0.5 rounded bg-amber-950/70 border border-amber-700 text-amber-300 font-bold">
                SIMULATED
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white">
              Martian Map Judging Demo &amp; Safety Verification Console
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Executes real backend services in isolated <code className="text-cyan-300">DEMO-*</code>{" "}
              missions without mutating user missions. Every step is persisted and auditable.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleVerifyAuditChain}
              className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-medium text-emerald-300"
            >
              <Lock className="w-3.5 h-3.5" /> Verify SHA-256 Audit Chain
            </button>
            <button
              onClick={handleResetDemo}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 bg-rose-950/70 hover:bg-rose-900/70 border border-rose-700 rounded-lg text-xs font-semibold text-rose-200"
            >
              <Trash2 className="w-3.5 h-3.5" /> Safe Demo Reset
            </button>
          </div>
        </div>

        {/* Banners */}
        {error && (
          <div className="bg-rose-950/50 border border-rose-700 rounded-xl p-4 text-sm text-rose-200">
            <strong>Demo Error:</strong> {error}
          </div>
        )}
        {resetMessage && (
          <div className="bg-emerald-950/40 border border-emerald-700 rounded-xl p-4 text-sm text-emerald-200">
            {resetMessage}
          </div>
        )}
        {auditResult && (
          <div className="bg-slate-900 border border-emerald-800 rounded-xl p-4 text-xs flex items-center justify-between">
            <span className="text-emerald-300 font-semibold">
              Audit Chain Verification: {auditResult.isValid ? "100% VERIFIED" : "COMPROMISED"}
            </span>
            <span className="font-mono text-slate-400">
              Chain Length: {auditResult.chainLength} blocks
            </span>
          </div>
        )}

        {/* Scenario Selector & Execution Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white">
              1. Select Deterministic Scenario &amp; Execution Mode
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => setSelectedScenario("NOMINAL_EXPLORATION")}
                className={`text-left p-4 rounded-xl border transition ${
                  selectedScenario === "NOMINAL_EXPLORATION"
                    ? "bg-emerald-950/30 border-emerald-500"
                    : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono text-emerald-400">SCENARIO A • SEED 20261112</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-sm font-semibold text-white">Nominal Exploration</div>
                <p className="text-xs text-slate-400 mt-1">
                  Isolated mission creation, science target assignment, route check, nominal EVA
                  completion, comms check, and analytics/audit verification.
                </p>
              </button>

              <button
                onClick={() => setSelectedScenario("OPERATIONAL_FAILURE")}
                className={`text-left p-4 rounded-xl border transition ${
                  selectedScenario === "OPERATIONAL_FAILURE"
                    ? "bg-amber-950/30 border-amber-500"
                    : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono text-amber-400">SCENARIO B • SEED 20261199</span>
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-sm font-semibold text-white">Operational Failure &amp; Recovery</div>
                <p className="text-xs text-slate-400 mt-1">
                  Isolated What-If battery/comms failure, Monte Carlo 50-run sweep, emergency EVA
                  return, autonomous relay reassignment, and audit verification.
                </p>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={handleRunGuided}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-lg text-xs font-bold text-white"
              >
                <Play className="w-4 h-4" />
                {loading ? "Executing..." : "Run Guided Mode (Full End-to-End)"}
              </button>
              <button
                onClick={handleStepManual}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg text-xs font-semibold text-white"
              >
                <StepForward className="w-4 h-4" />
                Execute Next Manual Step
              </button>
              {activeRun?.mode === "MANUAL" && activeRun?.status === "IN_PROGRESS" && (
                <span className="text-xs font-mono text-indigo-300">
                  Manual Run {activeRun.runId}: {activeRun.steps?.length || 0} /{" "}
                  {activeScenarioDef?.steps?.length || 6} steps completed
                </span>
              )}
            </div>
          </div>

          {/* Persistent Run History */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <History className="w-4 h-4 text-cyan-400" /> Persistent Demo Run History ({runs.length})
            </h2>
            {runs.length === 0 ? (
              <div className="text-xs text-slate-500 py-8 text-center border border-dashed border-slate-800 rounded-lg">
                No demo runs recorded yet. Launch Scenario A or B to generate a persisted run.
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {runs.map((r) => (
                  <button
                    key={r.runId}
                    onClick={() => setActiveRun(r)}
                    className={`w-full text-left p-2.5 rounded-lg border text-xs transition ${
                      activeRun?.runId === r.runId
                        ? "bg-slate-800 border-cyan-500"
                        : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-semibold text-white">{r.missionId}</span>
                      <span className="px-1.5 py-0.5 rounded bg-amber-950/70 text-amber-300 text-[10px]">
                        SIMULATED
                      </span>
                    </div>
                    <div className="text-slate-400 mt-0.5 flex items-center justify-between">
                      <span>
                        {r.mode} • {r.status}
                      </span>
                      <span>{r.steps?.length || 0} steps</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Active Run Step-by-Step Readout & Final Summary */}
        {activeRun && (
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-cyan-400">RUN {activeRun.runId}</span>
                  <span className="px-2 py-0.5 rounded bg-amber-950/80 border border-amber-700 text-amber-300 text-[10px] font-bold">
                    {activeRun.provenanceClassification}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-700 text-emerald-300 text-[10px] font-bold">
                    {activeRun.status}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white mt-1">
                  {activeRun.scenarioTitle} — Mission <code className="text-cyan-300">{activeRun.missionId}</code>
                </h3>
              </div>

              {/* Cross-workspace links */}
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to="/mission-analytics"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs text-cyan-300"
                >
                  <BarChart3 className="w-3.5 h-3.5" /> Inspect in Analytics
                </Link>
                <Link
                  to="/replay"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs text-purple-300"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Inspect in Replay
                </Link>
                <Link
                  to="/map"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs text-emerald-300"
                >
                  <MapIcon className="w-3.5 h-3.5" /> Open Mars Map
                </Link>
              </div>
            </div>

            {/* Steps */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(activeRun.steps || []).map((st: any) => (
                <div
                  key={st.stepId}
                  className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">{st.title}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300">
                      {st.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">{st.summary}</p>
                  <div className="text-[10px] font-mono text-slate-500">
                    {st.provenanceClassification} • {new Date(st.executedAt).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>

            {/* Final Summary */}
            {activeRun.finalSummary && (
              <div className="bg-emerald-950/20 border border-emerald-800/60 rounded-xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300 uppercase tracking-wider">
                    <Activity className="w-4 h-4" /> Final Verified Demonstration Summary (SIMULATED)
                  </div>
                  {activeRun.finalSummary.disclosure && (
                    <span className="text-[11px] text-amber-300/90">
                      {activeRun.finalSummary.disclosure}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                  <div>
                    <div className="text-slate-400">Steps Completed</div>
                    <div className="font-bold text-white">
                      {activeRun.finalSummary.completedSteps} / {activeRun.finalSummary.totalSteps}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">Distance</div>
                    <div className="font-bold text-white">
                      {activeRun.finalSummary.totalDistanceKm} km
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">Modeled Science Yield</div>
                    <div className="font-bold text-purple-300">
                      {activeRun.finalSummary.cumulativeScienceYield} pts
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">Monte Carlo (Comp / Surv)</div>
                    <div className="font-bold text-cyan-300">
                      {activeRun.finalSummary.monteCarloCompletionRatePercent !== null &&
                      activeRun.finalSummary.monteCarloCompletionRatePercent !== undefined
                        ? `${activeRun.finalSummary.monteCarloCompletionRatePercent}% / ${activeRun.finalSummary.monteCarloSurvivalRatePercent}%`
                        : "N/A (Nominal)"}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">Emergency Return</div>
                    <div
                      className={`font-bold ${
                        activeRun.finalSummary.emergencyReturnTriggered
                          ? "text-amber-300"
                          : "text-slate-300"
                      }`}
                    >
                      {activeRun.finalSummary.emergencyReturnTriggered
                        ? `TRIGGERED (${activeRun.finalSummary.historicalEmergencyCount ?? 1} hist)`
                        : "NONE"}
                    </div>
                    {activeRun.finalSummary.finalEvaSessionStatus && (
                      <div className="text-[10px] text-slate-400">
                        Final EVA: {activeRun.finalSummary.finalEvaSessionStatus}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-slate-400">Hash Audit Integrity</div>
                    <div className="font-bold text-emerald-400">
                      {activeRun.finalSummary.auditIntegrityStatus}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
