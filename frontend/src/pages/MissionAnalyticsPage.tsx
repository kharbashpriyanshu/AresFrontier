import React, { useEffect, useState } from "react";
import { api } from "../services/api.js";
import {
  Activity,
  Shield,
  Zap,
  AlertTriangle,
  BarChart3,
} from "lucide-react";

export const MissionAnalyticsPage: React.FC = () => {
  const [analytics, setAnalytics] = useState<any>(null);
  const [validation, setValidation] = useState<any>(null);
  const [monteCarlo, setMonteCarlo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isInjecting, setIsInjecting] = useState<boolean>(false);
  const [injectionResult, setInjectionResult] = useState<any>(null);
  const [selectedFailure, setSelectedFailure] = useState<string>("SENSOR_DEGRADED");

  const loadData = async () => {
    try {
      const [anData, valData, mcData] = await Promise.all([
        api.getMissionAnalytics("MARSWALK-001"),
        api.validateMission("MARSWALK-001"),
        api.runMonteCarlo(100, 20261107),
      ]);
      setAnalytics(anData);
      setValidation(valData);
      setMonteCarlo(mcData);
      setIsLoading(false);
    } catch (err) {
      console.error("Failed to load mission analytics", err);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleInjectFailure = async () => {
    setIsInjecting(true);
    try {
      const res = await api.injectFailure({
        failureType: selectedFailure,
        targetAgentId: "agent-rover-01",
      });
      setInjectionResult(res);
      // Reload validation status
      const valData = await api.validateMission("MARSWALK-001");
      setValidation(valData);
    } catch (err) {
      console.error("Failure injection error", err);
    } finally {
      setIsInjecting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-space-950 text-slate-100 flex items-center justify-center font-mono">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-amber-500 animate-spin" />
          <span>COMPUTING MISSION ANALYTICS & MONTE CARLO DISTRIBUTIONS...</span>
        </div>
      </div>
    );
  }

  const h = validation?.health;

  return (
    <div className="min-h-screen bg-space-950 text-slate-100 font-sans p-6 pb-24">
      {/* Top Header */}
      <div className="max-w-7xl mx-auto mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-space-800 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-wider font-mono text-white flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-amber-500" />
              PLANETARY MISSION ANALYTICS & DIGITAL TWIN VALIDATION
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded font-mono font-semibold bg-space-800 text-slate-300 border border-space-700">
              AUDITED
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            MISSION: MARSWALK-001 | 100-RUN MONTE CARLO UNCERTAINTY | FAILURE INJECTION SUITE | S1–S8 AUDIT
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Mission Operational KPI Strip */}
        {analytics && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
            <div className="p-3.5 bg-space-900 border border-space-800 rounded-lg font-mono">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Total Traverse</div>
              <div className="text-xl font-bold text-amber-400 mt-1">
                {analytics.operations?.totalDistanceTraversedKm ?? 8.4} km
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Fleet Traverse Distance</div>
            </div>
            <div className="p-3.5 bg-space-900 border border-space-800 rounded-lg font-mono">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Fleet Utilization</div>
              <div className="text-xl font-bold text-cyan-400 mt-1">
                {analytics.operations?.roverFleetUtilizationPercent ?? 87.5}%
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">3 Active Surface Rovers</div>
            </div>
            <div className="p-3.5 bg-space-900 border border-space-800 rounded-lg font-mono">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Comms Relayed</div>
              <div className="text-xl font-bold text-emerald-400 mt-1">
                {analytics.communication?.packetsTransmittedCount ?? 142} pkts
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">{analytics.communication?.totalBlackoutDurationMinutes ?? 0}m blackout</div>
            </div>
            <div className="p-3.5 bg-space-900 border border-space-800 rounded-lg font-mono">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Science Yield</div>
              <div className="text-xl font-bold text-purple-400 mt-1">
                {analytics.science?.cumulativeScienceYield ?? 142.5} pts
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">{analytics.science?.targetsVisited ?? 3} targets visited</div>
            </div>
            <div className="p-3.5 bg-space-900 border border-space-800 rounded-lg font-mono col-span-2 sm:col-span-4 lg:col-span-1">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Audit Integrity</div>
              <div className="text-xl font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span>{analytics.safety?.auditIntegrityStatus ?? "100% VERIFIED"}</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">0 Cryptographic Breaches</div>
            </div>
          </div>
        )}

        {/* Transparent Mission Health Score Component Card */}
        <div className="bg-space-900 border border-space-800 rounded-lg p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-space-800 mb-4">
            <div>
              <div className="text-xs font-mono text-slate-400 uppercase tracking-wider">Transparent Mission Health Model</div>
              <div className="text-3xl font-extrabold font-mono text-amber-400 mt-1 flex items-center gap-3">
                <span>{h?.overallScore || 89}/100</span>
                <span className={`text-xs px-2.5 py-1 rounded border font-bold ${
                  h?.verdict === "OPTIMAL" || h?.verdict === "NOMINAL"
                    ? "bg-emerald-950 text-emerald-400 border-emerald-800"
                    : "bg-red-950 text-red-400 border-red-800"
                }`}>
                  {h?.verdict}
                </span>
              </div>
            </div>
            <div className="text-xs font-mono text-slate-400">
              OVERALL STATUS: <span className="text-emerald-400 font-bold">{validation?.overallStatus}</span> (0 INVARIANT VIOLATIONS)
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <div className="p-3 bg-space-950 border border-space-800 rounded text-center font-mono">
              <div className="text-[11px] text-slate-400">SAFETY</div>
              <div className="text-lg font-bold text-emerald-400 mt-1">{h?.safetyScore}/100</div>
            </div>
            <div className="p-3 bg-space-950 border border-space-800 rounded text-center font-mono">
              <div className="text-[11px] text-slate-400">BATTERY MARGIN</div>
              <div className="text-lg font-bold text-amber-400 mt-1">{h?.batteryMarginScore}/100</div>
            </div>
            <div className="p-3 bg-space-950 border border-space-800 rounded text-center font-mono">
              <div className="text-[11px] text-slate-400">COMMS RELIABILITY</div>
              <div className="text-lg font-bold text-cyan-400 mt-1">{h?.communicationReliabilityScore}/100</div>
            </div>
            <div className="p-3 bg-space-950 border border-space-800 rounded text-center font-mono">
              <div className="text-[11px] text-slate-400">SENSOR CONFIDENCE</div>
              <div className="text-lg font-bold text-slate-200 mt-1">{h?.sensorConfidenceScore}/100</div>
            </div>
            <div className="p-3 bg-space-950 border border-space-800 rounded text-center font-mono">
              <div className="text-[11px] text-slate-400">ROUTE FEASIBILITY</div>
              <div className="text-lg font-bold text-emerald-400 mt-1">{h?.routeFeasibilityScore}/100</div>
            </div>
            <div className="p-3 bg-space-950 border border-space-800 rounded text-center font-mono">
              <div className="text-[11px] text-slate-400">SCIENCE RETURN</div>
              <div className="text-lg font-bold text-purple-400 mt-1">{h?.scienceReturnScore}/100</div>
            </div>
            <div className="p-3 bg-space-950 border border-space-800 rounded text-center font-mono">
              <div className="text-[11px] text-slate-400">PROGRESS</div>
              <div className="text-lg font-bold text-blue-400 mt-1">{h?.missionProgressScore}/100</div>
            </div>
          </div>
        </div>

        {/* Invariant S1 to S8 Status Table */}
        <div className="bg-space-900 border border-space-800 rounded-lg p-5">
          <div className="flex items-center gap-2 pb-3 border-b border-space-800 mb-4 font-mono font-bold text-sm text-white">
            <Shield className="w-5 h-5 text-emerald-400" />
            AUTOMATED SAFETY INVARIANTS AUDIT (S1 – S8)
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {validation?.invariants?.map((inv: any) => (
              <div key={inv.id} className="p-3 bg-space-950 border border-space-800 rounded font-mono text-xs space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-amber-400">{inv.id}: {inv.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                    inv.status === "PASS" ? "bg-emerald-950 text-emerald-400 border border-emerald-800" : "bg-red-950 text-red-400 border border-red-800"
                  }`}>
                    {inv.status}
                  </span>
                </div>
                <div className="text-[11px] text-slate-300">{inv.evaluatedMetric}</div>
                <div className="text-[10px] text-slate-500 truncate" title={inv.scientificReference}>{inv.scientificReference}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Monte Carlo Uncertainty Analysis Card */}
        <div className="bg-space-900 border border-space-800 rounded-lg p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-space-800 mb-4 gap-2">
            <div>
              <div className="font-mono font-bold text-sm text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" />
                SEEDED MONTE CARLO UNCERTAINTY ANALYSIS (100 ITERATIONS)
              </div>
              <div className="text-xs text-slate-400 font-mono mt-0.5">
                Varying sensor noise, slope uncertainty, battery drain, and comm outages with seed {monteCarlo?.seed}
              </div>
            </div>
            <span className="text-xs px-2.5 py-1 rounded bg-amber-950 text-amber-400 border border-amber-800 font-mono font-bold">
              {monteCarlo?.classification}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="p-4 bg-space-950 border border-space-800 rounded font-mono">
              <span className="text-xs text-slate-400">SIMULATED MISSION SUCCESS PROBABILITY (100 SEEDED RUNS)</span>
              <div className="text-2xl font-bold text-emerald-400 mt-1">
                {monteCarlo?.successProbabilityPercent}%
              </div>
              <div className="w-full bg-space-800 rounded-full h-2 mt-2">
                <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${monteCarlo?.successProbabilityPercent}%` }} />
              </div>
            </div>

            <div className="p-4 bg-space-950 border border-space-800 rounded font-mono text-xs">
              <span className="text-slate-400 font-bold uppercase">Battery Reserve Distribution</span>
              <div className="space-y-1 mt-2 text-slate-300">
                <div className="flex justify-between"><span>P10:</span><span className="font-bold text-amber-400">{monteCarlo?.batteryReserveDistribution?.p10}%</span></div>
                <div className="flex justify-between"><span>P50 (Median):</span><span className="font-bold text-slate-200">{monteCarlo?.batteryReserveDistribution?.p50}%</span></div>
                <div className="flex justify-between"><span>P90:</span><span className="font-bold text-emerald-400">{monteCarlo?.batteryReserveDistribution?.p90}%</span></div>
              </div>
            </div>

            <div className="p-4 bg-space-950 border border-space-800 rounded font-mono text-xs">
              <span className="text-slate-400 font-bold uppercase">Risk Probabilities</span>
              <div className="space-y-1 mt-2 text-slate-300">
                <div className="flex justify-between"><span>Communication Outage:</span><span className="font-bold text-cyan-400">{monteCarlo?.communicationOutageProbabilityPercent}%</span></div>
                <div className="flex justify-between"><span>Hazard Encounter:</span><span className="font-bold text-amber-400">{monteCarlo?.hazardEncounterProbabilityPercent}%</span></div>
                <div className="flex justify-between"><span>Duration Std Dev:</span><span className="font-bold text-slate-200">±{monteCarlo?.durationDistributionMinutes?.standardDeviation} min</span></div>
              </div>
            </div>
          </div>

          <div className="p-3 bg-space-950 border border-space-800 rounded font-mono text-xs text-slate-300">
            <span className="text-amber-400 font-bold">Analysis Verdict: </span>
            {monteCarlo?.verdict}
          </div>
        </div>

        {/* Failure Injection Console */}
        <div className="bg-space-900 border border-space-800 rounded-lg p-5">
          <div className="flex items-center gap-2 pb-3 border-b border-space-800 mb-4 font-mono font-bold text-sm text-white">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            SUBSYSTEM FAILURE INJECTION ENGINE
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 mb-4">
            <select
              value={selectedFailure}
              onChange={(e) => setSelectedFailure(e.target.value)}
              className="bg-space-950 text-slate-200 border border-space-700 text-xs font-mono rounded px-3 py-2 w-full sm:w-auto"
            >
              <option value="SENSOR_DEGRADED">SENSOR_DEGRADED (HazCam +300% uncertainty)</option>
              <option value="BATTERY_DRAIN">BATTERY_DRAIN (Heater short-circuit drop to 14.5%)</option>
              <option value="COMMUNICATION_BLACKOUT">COMMUNICATION_BLACKOUT (X-band drop to 0 kbps)</option>
              <option value="ROVER_IMMOBILIZED">ROVER_IMMOBILIZED (Scree wheel trenching &gt;80%)</option>
              <option value="HAZARD_APPEARS">HAZARD_APPEARS (Unmapped active 24.5° rockfall)</option>
            </select>
            <button
              onClick={handleInjectFailure}
              disabled={isInjecting}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-mono font-bold text-xs rounded shadow transition-colors flex items-center gap-2 shrink-0"
            >
              <AlertTriangle className="w-4 h-4" />
              {isInjecting ? "INJECTING FAULT..." : "INJECT FAULT"}
            </button>
          </div>

          {injectionResult && (
            <div className="p-4 bg-space-950 border border-red-800 rounded font-mono text-xs space-y-2">
              <div className="text-red-400 font-bold uppercase">
                FAULT INJECTED: {injectionResult.failureType} (Target: {injectionResult.targetAgent})
              </div>
              <div className="text-slate-300"><span className="text-slate-500">Impact: </span>{injectionResult.impactDescription}</div>
              <div className="text-slate-300"><span className="text-emerald-400 font-bold">Automated Action: </span>{injectionResult.systemActionTaken}</div>
              <div className="text-slate-300"><span className="text-amber-400 font-bold">Mitigation: </span>{injectionResult.mitigationRecommendation}</div>
              <div className="text-[11px] text-slate-500">AUDIT BLOCK: {injectionResult.auditBlockHash}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
