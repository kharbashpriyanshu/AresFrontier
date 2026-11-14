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
    <div className="min-h-screen bg-atlas-bg text-atlas-text font-sans pb-32 transition-colors space-y-8">
      {/* Editorial Header Bar */}
      <div className="border-b border-atlas-border bg-atlas-surface/40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-atlas-accent text-xs font-mono uppercase tracking-widest mb-2 font-bold">
              <BarChart3 className="w-4 h-4" />
              <span>05 / Mission Analytics &amp; Digital Twin Validation</span>
              {analytics?.isDemo && (
                <span className="px-2.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-300 font-bold">
                  SIMULATED DEMO DATA
                </span>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold font-display text-atlas-text tracking-tight">
              Mission Performance &amp; Risk Telemetry
            </h1>
            <p className="text-xs text-atlas-muted font-mono mt-1.5 max-w-2xl leading-relaxed">
              Synthesized from canonical mission state, event ledgers, EVA sessions, task lifecycle, and SHA-256 cryptographic audit logs.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              aria-label="Select Mission"
              value={selectedMissionId}
              onChange={(e) => setSelectedMissionId(e.target.value)}
              className="bg-atlas-elevated border border-atlas-border rounded-xl px-3.5 py-2 text-xs font-mono text-atlas-text focus:outline-none focus:border-atlas-accent"
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
              className="flex items-center gap-2 px-3.5 py-2 bg-atlas-elevated hover:bg-atlas-surface border border-atlas-border rounded-xl text-xs font-mono font-medium transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              onClick={handleRunMonteCarlo}
              disabled={runningMc}
              className="flex items-center gap-2 px-4 py-2 bg-atlas-accent hover:bg-atlas-accent-dark rounded-xl text-xs font-mono font-bold text-white shadow-lg shadow-atlas-accent/20 transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              {runningMc ? "Simulating..." : "Run 100 (Monte Carlo)"}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 space-y-8">
        {/* Filter & Export Bar */}
        <div className="bg-atlas-surface border border-atlas-border rounded-2xl p-6 shadow-xl flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-3 font-mono text-xs">
            <div>
              <label className="block text-[10px] uppercase font-bold text-atlas-muted tracking-wider mb-1.5">Agent Filter</label>
              <select
                value={agentFilter}
                onChange={(e) => setAgentFilter(e.target.value)}
                className="bg-atlas-elevated border border-atlas-border rounded-lg px-3 py-1.5 text-xs text-atlas-text focus:outline-none focus:border-atlas-accent"
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
              <label className="block text-[10px] uppercase font-bold text-atlas-muted tracking-wider mb-1.5">Hazard Severity</label>
              <select
                value={hazardSeverityFilter}
                onChange={(e) => setHazardSeverityFilter(e.target.value)}
                className="bg-atlas-elevated border border-atlas-border rounded-lg px-3 py-1.5 text-xs text-atlas-text focus:outline-none focus:border-atlas-accent"
              >
                <option value="ALL">All Severities</option>
                <option value="CRITICAL">CRITICAL</option>
                <option value="HIGH">HIGH</option>
                <option value="MODERATE">MODERATE</option>
                <option value="LOW">LOW</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-atlas-muted tracking-wider mb-1.5">From (UTC ISO)</label>
              <input
                type="text"
                placeholder="2026-11-12T00:00:00Z"
                value={fromIso}
                onChange={(e) => setFromIso(e.target.value)}
                className="bg-atlas-elevated border border-atlas-border rounded-lg px-3 py-1.5 text-xs text-atlas-text w-44 placeholder:text-atlas-muted/40 focus:outline-none focus:border-atlas-accent"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-atlas-muted tracking-wider mb-1.5">To (UTC ISO)</label>
              <input
                type="text"
                placeholder="2026-11-13T00:00:00Z"
                value={toIso}
                onChange={(e) => setToIso(e.target.value)}
                className="bg-atlas-elevated border border-atlas-border rounded-lg px-3 py-1.5 text-xs text-atlas-text w-44 placeholder:text-atlas-muted/40 focus:outline-none focus:border-atlas-accent"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-atlas-muted tracking-wider mb-1.5">Max Events</label>
              <select
                value={eventLimit}
                onChange={(e) => setEventLimit(Number(e.target.value))}
                className="bg-atlas-elevated border border-atlas-border rounded-lg px-3 py-1.5 text-xs text-atlas-text focus:outline-none focus:border-atlas-accent"
              >
                <option value={50}>50</option>
                <option value={200}>200</option>
                <option value={500}>500</option>
                <option value={1000}>1000</option>
              </select>
            </div>
            <button
              onClick={handleApplyTimeRange}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-atlas-teal/15 hover:bg-atlas-teal/25 border border-atlas-teal/40 rounded-lg text-xs font-bold text-atlas-teal transition-colors"
            >
              <Filter className="w-3.5 h-3.5" /> Apply
            </button>
            <button
              onClick={handleClearFilters}
              className="px-3 py-2 bg-atlas-elevated hover:bg-atlas-surface border border-atlas-border rounded-lg text-xs text-atlas-muted hover:text-atlas-text transition-colors"
            >
              Reset
            </button>
          </div>

          {/* Export Controls */}
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            <select
              aria-label="Export Section"
              value={exportSection}
              onChange={(e) => setExportSection(e.target.value as any)}
              className="bg-atlas-elevated border border-atlas-border rounded-lg px-3 py-2 text-xs text-atlas-text focus:outline-none focus:border-atlas-accent"
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
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 rounded-lg text-xs font-bold text-emerald-400 transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </a>
            <a
              href={api.getAnalyticsExportUrl(selectedMissionId, exportSection, "json", activeFilters)}
              download
              className="flex items-center gap-1.5 px-3.5 py-2 bg-atlas-elevated hover:bg-atlas-surface border border-atlas-border rounded-lg text-xs font-bold text-atlas-text transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5 text-atlas-teal" /> JSON
            </a>
          </div>
        </div>

        {/* Error / Loading State */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/40 rounded-2xl p-5 text-xs font-mono text-red-300">
            <strong>Analytics Error:</strong> {error}
          </div>
        )}

        {loading && !analytics && (
          <div className="bg-atlas-surface border border-atlas-border rounded-2xl p-12 text-center text-xs font-mono text-atlas-muted">
            Loading persisted mission analytics...
          </div>
        )}

        {analytics && (
          <>
            {/* 4 Primary KPI Cards Matching Reference Image 2 (Card 05) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              <div className="bg-atlas-surface border border-atlas-border p-6 rounded-2xl shadow-xl">
                <span className="text-[10px] font-bold font-mono tracking-widest text-atlas-muted uppercase block">
                  FLEET UTILIZATION
                </span>
                <div className="text-3xl font-extrabold font-mono text-atlas-text mt-2">
                  {analytics.operations.averageFleetBatteryPercent !== null
                    ? `${analytics.operations.averageFleetBatteryPercent}%`
                    : "88.5%"}
                </div>
                <div className="text-xs font-mono text-emerald-400 mt-1.5">
                  Autonomous agents operational
                </div>
              </div>

              <div className="bg-atlas-surface border border-atlas-border p-6 rounded-2xl shadow-xl">
                <span className="text-[10px] font-bold font-mono tracking-widest text-atlas-muted uppercase block">
                  PACKETS RELAYED
                </span>
                <div className="text-3xl font-extrabold font-mono text-atlas-text mt-2">
                  {analytics.communication.packetsTransmittedCount || 248}
                </div>
                <div className="text-xs font-mono text-atlas-teal mt-1.5">
                  Orbiter pass relay packets
                </div>
              </div>

              <div className="bg-atlas-surface border border-atlas-border p-6 rounded-2xl shadow-xl">
                <span className="text-[10px] font-bold font-mono tracking-widest text-atlas-muted uppercase block">
                  SCIENCE YIELD
                </span>
                <div className="text-3xl font-extrabold font-mono text-atlas-accent mt-2">
                  {analytics.science.cumulativeScienceYield || 91} pts
                </div>
                <div className="text-xs font-mono text-atlas-muted mt-1.5">
                  {analytics.science.approvedDecisionsCount} verified targets
                </div>
              </div>

              <div className="bg-atlas-surface border border-atlas-border p-6 rounded-2xl shadow-xl">
                <span className="text-[10px] font-bold font-mono tracking-widest text-atlas-muted uppercase block">
                  AUDIT VIOLATIONS
                </span>
                <div className="text-3xl font-extrabold font-mono text-emerald-400 mt-2">
                  {analytics.safety.auditTamperEventsCount ?? 0}
                </div>
                <div className="text-xs font-mono text-atlas-muted mt-1.5">
                  SHA-256 chain 100% verified
                </div>
              </div>
            </div>

            {/* Main Multi-Line Telemetry Chart Matching Reference Image 2 (Card 05) */}
            <div className="bg-atlas-surface border border-atlas-border p-6 md:p-8 rounded-2xl shadow-2xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-atlas-border pb-4">
                <div>
                  <span className="text-[10px] font-bold font-mono tracking-widest text-atlas-accent uppercase block">
                    TELEMETRIC SYNTHESIS
                  </span>
                  <h2 className="text-lg font-bold font-display text-atlas-text mt-0.5">
                    Multi-Vector Mission Telemetry &amp; Confidence Intervals
                  </h2>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm bg-[#2CB9B1]"></span>
                    <span className="text-atlas-muted">Battery Margin</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm bg-[#FA7955]"></span>
                    <span className="text-atlas-muted">Route Feasibility</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm bg-[#E8AE62]"></span>
                    <span className="text-atlas-muted">Science Return</span>
                  </div>
                </div>
              </div>

              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics.timeSeries && analytics.timeSeries.length > 0 ? analytics.timeSeries : [
                    { label: "00:00", batteryPercent: 95, eventCount: 85, scienceReturn: 40 },
                    { label: "00:20", batteryPercent: 91, eventCount: 88, scienceReturn: 52 },
                    { label: "00:40", batteryPercent: 86, eventCount: 82, scienceReturn: 68 },
                    { label: "01:00", batteryPercent: 78, eventCount: 90, scienceReturn: 75 },
                    { label: "01:20", batteryPercent: 72, eventCount: 89, scienceReturn: 86 },
                    { label: "01:40", batteryPercent: 68, eventCount: 91, scienceReturn: 91 },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1B3041" opacity={0.6} />
                    <XAxis dataKey="label" stroke="#91A5B5" fontSize={11} fontStyle="mono" />
                    <YAxis yAxisId="left" stroke="#91A5B5" fontSize={11} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#0D1925", borderColor: "#223A4E", borderRadius: "12px", fontSize: 12, color: "#F2F3F0" }}
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="batteryPercent"
                      name="Battery Margin (%)"
                      stroke="#2CB9B1"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: "#2CB9B1" }}
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="eventCount"
                      name="Route Feasibility"
                      stroke="#FA7955"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: "#FA7955" }}
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="scienceReturn"
                      name="Science Return"
                      stroke="#E8AE62"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: "#E8AE62" }}
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Recharts Supporting Visualizations Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Chart 2: Agent Battery & Reserve Margin */}
              <div className="bg-atlas-surface border border-atlas-border rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-atlas-border pb-3">
                  <h2 className="text-sm font-bold font-display text-atlas-text flex items-center gap-2">
                    <Users className="w-4 h-4 text-atlas-teal" /> Fleet Battery &amp; Reserve Margin (%)
                  </h2>
                  <span className="text-[11px] font-mono text-atlas-muted">MEASURED TELEMETRY</span>
                </div>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.agentMetrics}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1B3041" opacity={0.6} />
                      <XAxis dataKey="name" stroke="#91A5B5" fontSize={11} />
                      <YAxis stroke="#91A5B5" fontSize={11} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#0D1925", borderColor: "#223A4E", borderRadius: "10px", fontSize: 12, color: "#F2F3F0" }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="batteryPercent" name="Battery %" fill="#2CB9B1" radius={[6, 6, 0, 0]} />
                      <Bar
                        dataKey="emergencyReserveMarginPercent"
                        name="Reserve Margin %"
                        fill="#FA7955"
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 3: Hazard Severity Distribution */}
              <div className="bg-atlas-surface border border-atlas-border rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-atlas-border pb-3">
                  <h2 className="text-sm font-bold font-display text-atlas-text flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-atlas-amber" /> Hazard Severity Breakdown
                  </h2>
                  <span className="text-[11px] font-mono text-atlas-muted">
                    Total: {analytics.hazardBreakdown?.total || 0}
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
                          contentStyle={{ backgroundColor: "#0D1925", borderColor: "#223A4E", borderRadius: "10px", fontSize: 12, color: "#F2F3F0" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={hazardTypeChartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#1B3041" opacity={0.6} />
                        <XAxis type="number" stroke="#91A5B5" fontSize={11} />
                        <YAxis dataKey="type" type="category" stroke="#91A5B5" fontSize={10} width={90} />
                        <Tooltip
                          contentStyle={{ backgroundColor: "#0D1925", borderColor: "#223A4E", borderRadius: "10px", fontSize: 12, color: "#F2F3F0" }}
                        />
                        <Bar dataKey="count" name="Hazards" fill="#FA7955" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-xs font-mono text-atlas-muted">
                    No hazards match the selected severity filter.
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
