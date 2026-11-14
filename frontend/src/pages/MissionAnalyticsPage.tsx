import React, { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Cpu,
  Download,
  Filter,
  GitCompare,
  Play,
  Radio,
  RefreshCw,
  Shield,
  ShieldAlert,
  Sparkles,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const PIE_COLORS = ["#f97316", "#eab308", "#ef4444", "#38bdf8", "#a855f7"];

export const MissionAnalyticsPage: React.FC = () => {
  const [selectedMissionId, setSelectedMissionId] = useState<string>("MARSWALK-001");
  const [analytics, setAnalytics] = useState<any>(null);
  const [validation, setValidation] = useState<any>(null);
  const [monteCarlo, setMonteCarlo] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [runningMc, setRunningMc] = useState<boolean>(false);
  const [injectingFailure, setInjectingFailure] = useState<boolean>(false);
  const [lastFailureResult, setLastFailureResult] = useState<any>(null);

  // Filters
  const [agentFilter, setAgentFilter] = useState<string>("ALL");
  const [hazardSeverityFilter, setHazardSeverityFilter] = useState<string>("ALL");
  const [fromIso, setFromIso] = useState<string>("");
  const [toIso, setToIso] = useState<string>("");
  const [eventLimit, setEventLimit] = useState<number>(200);
  const [exportSection, setExportSection] = useState<
    "overview" | "timeseries" | "agents" | "routes" | "hazards"
  >("overview");

  // Multi-mission comparison
  const [compareIds, setCompareIds] = useState<string[]>(["MARSWALK-001"]);
  const [comparison, setComparison] = useState<any>(null);
  const [comparing, setComparing] = useState<boolean>(false);

  const activeFilters = useMemo(
    () => ({
      from: fromIso || undefined,
      to: toIso || undefined,
      limit: eventLimit,
      agentId: agentFilter !== "ALL" ? agentFilter : undefined,
      severity: hazardSeverityFilter !== "ALL" ? hazardSeverityFilter : undefined,
    }),
    [fromIso, toIso, eventLimit, agentFilter, hazardSeverityFilter]
  );

  const loadData = async (missionId: string = selectedMissionId) => {
    setLoading(true);
    setError(null);
    try {
      const [ana, val] = await Promise.all([
        api.getMissionAnalytics(missionId, activeFilters),
        api.validateMission(missionId),
      ]);
      setAnalytics(ana);
      setValidation(val);
      if (ana?.availableMissions?.length > 1 && compareIds.length < 2) {
        setCompareIds(ana.availableMissions.slice(0, 2).map((m: any) => m.id));
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load mission analytics from backend.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(selectedMissionId);
  }, [selectedMissionId, agentFilter, hazardSeverityFilter, eventLimit]);

  const handleApplyTimeRange = () => {
    loadData(selectedMissionId);
  };

  const handleClearFilters = () => {
    setAgentFilter("ALL");
    setHazardSeverityFilter("ALL");
    setFromIso("");
    setToIso("");
    setEventLimit(200);
  };

  const handleRunMonteCarlo = async () => {
    setRunningMc(true);
    try {
      const res = await api.runMonteCarlo(100, 20261107);
      setMonteCarlo(res);
    } catch (err) {
      console.error("Monte Carlo failed:", err);
    } finally {
      setRunningMc(false);
    }
  };

  const handleInjectFailure = async (failureType: string) => {
    setInjectingFailure(true);
    try {
      const res = await api.injectFailure({
        failureType,
        targetAgentId: "agent-rover-01",
        severity: "CRITICAL",
      });
      setLastFailureResult(res);
      await loadData(selectedMissionId);
    } catch (err) {
      console.error("Failure injection failed:", err);
    } finally {
      setInjectingFailure(false);
    }
  };

  const handleCompareMissions = async () => {
    if (compareIds.length === 0) return;
    setComparing(true);
    try {
      const res = await api.compareMissions(compareIds);
      setComparison(res);
    } catch (err) {
      console.error("Mission comparison failed:", err);
    } finally {
      setComparing(false);
    }
  };

  const toggleCompareMission = (id: string) => {
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const hazardSeverityChartData = useMemo(() => {
    const entries = Object.entries(analytics?.hazardBreakdown?.bySeverity || {});
    return entries.map(([name, value]) => ({ name, value }));
  }, [analytics]);

  const hazardTypeChartData = useMemo(() => {
    const entries = Object.entries(analytics?.hazardBreakdown?.byType || {});
    return entries.map(([type, count]) => ({ type, count }));
  }, [analytics]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-cyan-400 text-xs font-mono uppercase tracking-widest mb-1">
              <BarChart3 className="w-4 h-4" />
              <span>Mission Analytics, Time-Series &amp; Multi-Mission Comparison</span>
              {analytics?.isDemo && (
                <span className="px-2 py-0.5 rounded bg-amber-950/70 border border-amber-700 text-amber-300 font-bold">
                  SIMULATED DEMO DATA
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-white">
              Mission Telemetry, Safety &amp; Scientific Yield Analytics
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Aggregated strictly from persisted missions, deduplicated event history, EVA sessions,
              task lifecycle, science decisions, and SHA-256 audit chain.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              aria-label="Select Mission"
              value={selectedMissionId}
              onChange={(e) => setSelectedMissionId(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200"
            >
              {(analytics?.availableMissions || [{ id: "MARSWALK-001", name: "MARSWALK-001", isDemo: false }]).map(
                (m: any) => (
                  <option key={m.id} value={m.id}>
                    {m.id} — {m.name} {m.isDemo ? "[SIMULATED DEMO]" : ""}
                  </option>
                )
              )}
            </select>
            <button
              onClick={() => loadData(selectedMissionId)}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-medium border border-slate-700"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              onClick={handleRunMonteCarlo}
              disabled={runningMc}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-semibold text-white"
            >
              <Play className="w-3.5 h-3.5" />
              {runningMc ? "Running 100 Trials..." : "Run Monte Carlo (100)"}
            </button>
          </div>
        </div>

        {/* Filter & Export Bar */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Agent Filter</label>
              <select
                value={agentFilter}
                onChange={(e) => setAgentFilter(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
              >
                <option value="ALL">All Agents</option>
                {(analytics?.agentMetrics || []).map((a: any) => (
                  <option key={a.agentId} value={a.agentId}>
                    {a.name} ({a.agentId})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Hazard Severity</label>
              <select
                value={hazardSeverityFilter}
                onChange={(e) => setHazardSeverityFilter(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
              >
                <option value="ALL">All Severities</option>
                <option value="CRITICAL">CRITICAL</option>
                <option value="HIGH">HIGH</option>
                <option value="MODERATE">MODERATE</option>
                <option value="LOW">LOW</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">From (UTC ISO)</label>
              <input
                type="text"
                placeholder="2026-11-12T00:00:00Z"
                value={fromIso}
                onChange={(e) => setFromIso(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 w-44"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">To (UTC ISO)</label>
              <input
                type="text"
                placeholder="2026-11-13T00:00:00Z"
                value={toIso}
                onChange={(e) => setToIso(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 w-44"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Max Events</label>
              <select
                value={eventLimit}
                onChange={(e) => setEventLimit(Number(e.target.value))}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
              >
                <option value={50}>50</option>
                <option value={200}>200</option>
                <option value={500}>500</option>
                <option value={1000}>1000</option>
              </select>
            </div>
            <button
              onClick={handleApplyTimeRange}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-700 hover:bg-cyan-600 rounded-lg text-xs font-medium text-white"
            >
              <Filter className="w-3.5 h-3.5" /> Apply
            </button>
            <button
              onClick={handleClearFilters}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs text-slate-300"
            >
              Reset
            </button>
          </div>

          {/* Export Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Export Section"
              value={exportSection}
              onChange={(e) => setExportSection(e.target.value as any)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
            >
              <option value="overview">Overview KPIs</option>
              <option value="timeseries">Time-Series</option>
              <option value="agents">Agent Metrics</option>
              <option value="routes">Route Comparison</option>
              <option value="hazards">Hazard Breakdown</option>
            </select>
            <a
              href={api.getAnalyticsExportUrl(selectedMissionId, exportSection, "csv", activeFilters)}
              download
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 rounded-lg text-xs font-semibold text-white"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </a>
            <a
              href={api.getAnalyticsExportUrl(selectedMissionId, exportSection, "json", activeFilters)}
              download
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-xs font-semibold text-slate-100"
            >
              <Download className="w-3.5 h-3.5" /> JSON
            </a>
          </div>
        </div>

        {/* Error / Loading State */}
        {error && (
          <div className="bg-rose-950/50 border border-rose-700 rounded-xl p-4 text-sm text-rose-200">
            <strong>Analytics Error:</strong> {error}
          </div>
        )}

        {loading && !analytics && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center text-sm text-slate-400">
            Loading persisted mission analytics...
          </div>
        )}

        {analytics && (
          <>
            {/* Provenance Banner */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
              <span>
                <strong className="text-slate-200">Data Source:</strong> {analytics.provenance?.dataSource}
                {analytics.provenance?.disclaimer && (
                  <span className="ml-2 text-amber-300/90">({analytics.provenance.disclaimer})</span>
                )}
              </span>
              <span className="font-mono">
                Classification:{" "}
                <strong className="text-cyan-300">{analytics.provenance?.classification}</strong> |{" "}
                Deduplicated Events: {analytics.filterMeta?.deduplicatedEventsCount ?? 0} /{" "}
                {analytics.filterMeta?.totalEventsMatched ?? 0}
              </span>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span>Distance &amp; Missions</span>
                  <Activity className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-bold text-white">
                  {analytics.operations.totalDistanceTraversedKm} km
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {analytics.missionsSummary.totalPlanned} persisted missions (
                  {analytics.missionsSummary.userMissionCount} user,{" "}
                  {analytics.missionsSummary.demoCount} demo)
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span>Battery State</span>
                  <Cpu className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-bold text-white">
                  {analytics.operations.averageFleetBatteryPercent !== null
                    ? `${analytics.operations.averageFleetBatteryPercent}%`
                    : "N/A"}
                </div>
                <div className="text-xs text-emerald-400 mt-1">
                  {analytics.safety.emergencyReserveCompliancePercent !== null
                    ? `Reserve Compliance: ${analytics.safety.emergencyReserveCompliancePercent}%`
                    : "No battery telemetry recorded"}
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span>Comms Delivery</span>
                  <Radio className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="text-2xl font-bold text-white">
                  {analytics.communication.packetDeliveryRatePercent !== null
                    ? `${analytics.communication.packetDeliveryRatePercent}%`
                    : "N/A"}
                </div>
                <div className="text-xs text-slate-400 mt-1" title={analytics.communication.denominatorNote}>
                  {analytics.communication.totalPacketsDenominator > 0
                    ? `${analytics.communication.packetsTransmittedCount}/${analytics.communication.totalPacketsDenominator} pkts`
                    : "0 resolved pkts"}{" "}
                  •{" "}
                  {analytics.communication.averageLatencyMs !== null
                    ? `${analytics.communication.averageLatencyMs} ms`
                    : "Latency N/A"}
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span>Modeled Science Yield</span>
                  <Sparkles className="w-4 h-4 text-purple-400" />
                </div>
                <div className="text-2xl font-bold text-white">
                  {analytics.science.cumulativeScienceYield} pts
                </div>
                <div className="text-xs text-purple-300 mt-1" title={analytics.science.methodologyNote}>
                  {analytics.science.approvedDecisionsCount} approved decisions •{" "}
                  {analytics.science.totalTargetsEvaluated} catalog targets
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  HEURISTIC SCORE (not measured discovery)
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span>Hash-Chain Audit</span>
                  <Shield className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-lg font-bold text-emerald-400">
                  {analytics.safety.auditIntegrityStatus}
                </div>
                <div className="text-xs text-slate-400 mt-1" title={analytics.safety.auditDisclosure}>
                  EVA: {analytics.evaSummary.totalSessions} (Hist. Emerg:{" "}
                  {analytics.evaSummary.historicalEmergencyReturnCount})
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Safety Validation: {validation?.overallStatus || "UNCHECKED"}
                </div>
              </div>
            </div>

            {/* Recharts Visualizations Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Chart 1: Time-Series Activity & Telemetry */}
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-white">
                    Time-Series Event Activity &amp; Battery Telemetry (UTC)
                  </h2>
                  <span className="text-[11px] font-mono text-slate-400">
                    Gaps left null (never interpolated)
                  </span>
                </div>
                {analytics.timeSeries && analytics.timeSeries.length > 0 ? (
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analytics.timeSeries}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} />
                        <YAxis yAxisId="left" stroke="#38bdf8" fontSize={11} />
                        <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" domain={[0, 100]} fontSize={11} />
                        <Tooltip
                          contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", fontSize: 12 }}
                        />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="eventCount"
                          name="Events / Bucket"
                          stroke="#38bdf8"
                          strokeWidth={2}
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="batteryPercent"
                          name="Battery %"
                          stroke="#f59e0b"
                          strokeWidth={2}
                          connectNulls={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
                    {analytics.filterMeta?.emptyReason || "No persisted time-series events for this filter."}
                  </div>
                )}
              </div>

              {/* Chart 2: Agent Battery & Reserve Margin */}
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-cyan-400" /> Fleet Battery &amp; Reserve Margin (%)
                  </h2>
                  <span className="text-[11px] font-mono text-slate-400">MEASURED / MODELED</span>
                </div>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.agentMetrics}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                      <YAxis stroke="#94a3b8" fontSize={11} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", fontSize: 12 }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="batteryPercent" name="Battery %" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                      <Bar
                        dataKey="emergencyReserveMarginPercent"
                        name="Reserve Margin %"
                        fill="#10b981"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 3: Hazard Severity Distribution */}
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" /> Hazard Severity Breakdown
                  </h2>
                  <span className="text-[11px] font-mono text-slate-400">
                    Total: {analytics.hazardBreakdown.total}
                  </span>
                </div>
                {hazardSeverityChartData.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={hazardSeverityChartData}
                          dataKey="value"
                          nameKey="name"
                          outerRadius={80}
                          label
                        >
                          {hazardSeverityChartData.map((_, idx) => (
                            <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", fontSize: 12 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={hazardTypeChartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis type="number" stroke="#94a3b8" fontSize={11} />
                        <YAxis dataKey="type" type="category" stroke="#94a3b8" fontSize={10} width={90} />
                        <Tooltip
                          contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", fontSize: 12 }}
                        />
                        <Bar dataKey="count" name="Hazards" fill="#f97316" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-xs text-slate-500">
                    No hazards match the selected severity filter.
                  </div>
                )}
              </div>

              {/* Chart 4: Route Safety vs. Science Yield */}
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-white">
                    Route Safety vs. Science Yield Comparison
                  </h2>
                  <span className="text-[11px] font-mono text-slate-400">Score (0–100)</span>
                </div>
                {analytics.routeComparison.length > 0 ? (
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={analytics.routeComparison}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="routeName" stroke="#94a3b8" fontSize={10} />
                        <YAxis stroke="#94a3b8" domain={[0, 100]} fontSize={11} />
                        <Tooltip
                          contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", fontSize: 12 }}
                        />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Area
                          type="monotone"
                          dataKey="safetyScore"
                          name="Safety Score"
                          stroke="#10b981"
                          fill="#10b981"
                          fillOpacity={0.25}
                        />
                        <Area
                          type="monotone"
                          dataKey="scienceYieldScore"
                          name="Science Yield"
                          stroke="#a855f7"
                          fill="#a855f7"
                          fillOpacity={0.25}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-xs text-slate-500">
                    No route comparison candidates available for this mission.
                  </div>
                )}
              </div>
            </div>

            {/* Multi-Mission Comparison Workspace */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    <GitCompare className="w-4 h-4 text-cyan-400" /> Multi-Mission Comparison &amp;
                    Trade-Off Analysis
                  </h2>
                  <p className="text-xs text-slate-400">
                    Select 2 or more missions to compare distance, battery draw, hazard exposure,
                    science yield, and EVA risk without declaring a single universal winner.
                  </p>
                </div>
                <button
                  onClick={handleCompareMissions}
                  disabled={comparing || compareIds.length === 0}
                  className="px-4 py-2 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 rounded-lg text-xs font-semibold text-white"
                >
                  {comparing ? "Comparing..." : `Compare Selected (${compareIds.length})`}
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {(analytics.availableMissions || []).map((m: any) => {
                  const selected = compareIds.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() => toggleCompareMission(m.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs border transition ${
                        selected
                          ? "bg-cyan-950/70 border-cyan-500 text-cyan-200"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      {selected ? "✓ " : "+ "}
                      {m.id} {m.isDemo ? "(SIMULATED)" : ""}
                    </button>
                  );
                })}
              </div>

              {comparison && (
                <div className="space-y-3">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400">
                          <th className="py-2 pr-4">Mission</th>
                          <th className="py-2 pr-4">Status</th>
                          <th className="py-2 pr-4">Distance (km)</th>
                          <th className="py-2 pr-4">Battery Draw (%)</th>
                          <th className="py-2 pr-4">Hazards</th>
                          <th className="py-2 pr-4">Science Yield</th>
                          <th className="py-2 pr-4">EVA Sessions</th>
                          <th className="py-2">Audit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparison.missions.map((row: any) => (
                          <tr key={row.missionId} className="border-b border-slate-800/60">
                            <td className="py-2 pr-4 font-mono text-white">
                              {row.missionId}{" "}
                              {row.isDemo && (
                                <span className="text-[10px] text-amber-300">[DEMO]</span>
                              )}
                            </td>
                            <td className="py-2 pr-4">{row.status}</td>
                            <td className="py-2 pr-4 font-mono">{row.totalDistanceKm}</td>
                            <td className="py-2 pr-4 font-mono">
                              {row.batteryConsumptionPercent !== null
                                ? `${row.batteryConsumptionPercent}%`
                                : "N/A"}
                            </td>
                            <td className="py-2 pr-4 font-mono">{row.hazardExposureCount}</td>
                            <td className="py-2 pr-4 font-mono text-purple-300">
                              {row.scienceYieldScore} (MODELED)
                            </td>
                            <td className="py-2 pr-4 font-mono">
                              {row.evaSessionsCount} (Emerg: {row.historicalEmergencyCount ?? 0})
                            </td>
                            <td className="py-2 text-emerald-400">{row.auditIntegrityStatus}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3 space-y-1">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-cyan-400">
                      Trade-Off Analysis
                    </div>
                    {comparison.tradeOffAnalysis.map((line: string, i: number) => (
                      <div key={i} className="text-xs text-slate-300">
                        • {line}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Metric Definitions & Monte Carlo / Stress Controls */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-white mb-3">
                  Metric Definitions, Units &amp; Provenance
                </h2>
                <div className="space-y-2.5">
                  {(analytics.metricDefinitions || []).map((def: any, i: number) => (
                    <div
                      key={i}
                      className="p-2.5 bg-slate-950/60 border border-slate-800/80 rounded-lg text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-200">
                          {def.metric} ({def.unit})
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono text-[10px]">
                          {def.provenanceType}
                        </span>
                      </div>
                      <div className="font-mono text-[11px] text-slate-400 mt-1">{def.formula}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Source: {def.source}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-4">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-400" /> Safety Validation, Monte Carlo &amp;
                  Stress Controls
                </h2>

                {validation && (
                  <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      Safety Validation: <strong>{validation.overallStatus}</strong>
                    </span>
                    <span className="font-mono text-slate-400">
                      Checks: {validation.checks?.length || 0}
                    </span>
                  </div>
                )}

                {monteCarlo && (
                  <div className="p-3 bg-indigo-950/30 border border-indigo-800/60 rounded-lg text-xs space-y-1">
                    <div className="font-semibold text-indigo-300">
                      Monte Carlo ({monteCarlo.runCount ?? 100} runs, seed {monteCarlo.seed ?? 20261107}) — SIMULATED
                    </div>
                    <div className="text-slate-300">
                      Nominal Completion:{" "}
                      <strong>
                        {monteCarlo.missionCompletionRatePercent ?? monteCarlo.successProbabilityPercent}%
                      </strong>{" "}
                      | Overall Survival (incl. Safe Recovery):{" "}
                      <strong>{monteCarlo.overallSurvivalRatePercent ?? "--"}%</strong> | Battery P50:{" "}
                      {monteCarlo.batteryReserveDistribution?.p50 ?? "--"}%
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {["BATTERY_CRITICAL", "SENSOR_DEGRADED", "COMM_OUTAGE"].map((ft) => (
                    <button
                      key={ft}
                      onClick={() => handleInjectFailure(ft)}
                      disabled={injectingFailure}
                      className="px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900/60 border border-rose-800/60 rounded-lg text-xs text-rose-200"
                    >
                      Simulate {ft}
                    </button>
                  ))}
                </div>

                {lastFailureResult && (
                  <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-amber-300">
                    Last Simulation: {lastFailureResult.failureType} on{" "}
                    {lastFailureResult.targetAgentId}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
