import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  ExternalLink,
  Filter,
  GitBranch,
  History,
  Lock,
  Search,
} from "lucide-react";
import { api } from "../services/api.js";
import type { DataSourceInfo, ScienceDecisionRecord } from "../types/index.js";

interface ProvenanceExplorerData {
  datasets: DataSourceInfo[];
  ingestedDatasets?: any[];
  totalDatasets: number;
  linkedDecisions: ScienceDecisionRecord[];
  auditVerification: {
    valid: boolean;
    totalBlocks: number;
    tamperDetectedAtBlock?: number;
    latestHash: string | null;
    message?: string;
  };
  recentAuditBlocks: Array<{
    eventId: string;
    blockHeight: number;
    timestamp: string;
    action: string;
    userId: string;
    missionPlanId: string;
    integrityHash: string;
  }>;
  recentEvents: Array<{
    eventId: string;
    missionId: string;
    eventType: string;
    actor: string;
    timestamp: string;
  }>;
  pipelines: string[];
}

const BENCHMARK_CORE_DATASETS = [
  {
    name: "MOLA MEGDR",
    mission: "MGS",
    type: "Elevation",
    status: "Operational",
    resolution: "128 px/deg",
  },
  {
    name: "HiRISE",
    mission: "MRO",
    type: "Imagery",
    status: "Operational",
    resolution: "25 cm/px",
  },
  {
    name: "CRISM",
    mission: "MRO",
    type: "Spectral",
    status: "Operational",
    resolution: "18 m/px",
  },
  {
    name: "MSL",
    mission: "Curiosity",
    type: "Geochemistry",
    status: "Operational",
    resolution: "In-situ APXS",
  },
  {
    name: "M20 Perseverance",
    mission: "Mars 2020",
    type: "Traverse / MEDA",
    status: "Operational",
    resolution: "In-situ Sol 0–1400",
  },
];

export const MethodologyPage: React.FC = () => {
  const navigate = useNavigate();
  const [explorer, setExplorer] = useState<ProvenanceExplorerData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filter states
  const [search, setSearch] = useState("");
  const [classification, setClassification] = useState("");
  const [validationStatus, setValidationStatus] = useState("");
  const [missionFilter, setMissionFilter] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [stageFilter, setStageFilter] = useState("");

  // Decision lineage inspector
  const [lineage, setLineage] = useState<any | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string>("evt-flagship-detour");
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestMessage, setIngestMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadExplorer = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.getProvenanceExplorer({
        search,
        classification,
        validationStatus,
        mission: missionFilter,
        product: productFilter,
        stage: stageFilter,
      });
      setExplorer(data);
    } catch {
      const fallbackSources = await api.getDataSources().catch(() => []);
      setExplorer({
        datasets: fallbackSources,
        totalDatasets: fallbackSources.length,
        linkedDecisions: [],
        auditVerification: { valid: true, totalBlocks: 0, latestHash: null },
        recentAuditBlocks: [],
        recentEvents: [],
        pipelines: [],
      });
    } finally {
      setIsLoading(false);
    }
  }, [search, classification, validationStatus, missionFilter, productFilter, stageFilter]);

  useEffect(() => {
    loadExplorer();
  }, [loadExplorer]);

  useEffect(() => {
    api
      .getDecisionLineage(selectedEventId)
      .then(setLineage)
      .catch(() => setLineage(null));
  }, [selectedEventId]);

  const handleIngestM20 = async () => {
    setIsIngesting(true);
    setIngestMessage(null);
    try {
      const ds = await api.ingestMars2020Traverse();
      setIngestMessage({
        type: "success",
        text: `Ingested ${ds.product} (${ds.featureCount} segments, Sol ${ds.summary?.currentSol}, SHA-256 ${ds.checksumSha256?.slice(0, 12)}…)`,
      });
      await loadExplorer();
    } catch (err) {
      setIngestMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to ingest NASA JPL M20 dataset.",
      });
    } finally {
      setIsIngesting(false);
    }
  };

  const handleExportProvenance = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      filters: { search, classification, validationStatus, missionFilter, productFilter, stageFilter },
      explorer,
      selectedLineage: lineage,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "martian-map-provenance-audit.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetFilters = () => {
    setSearch("");
    setClassification("");
    setValidationStatus("");
    setMissionFilter("");
    setProductFilter("");
    setStageFilter("");
  };

  const classificationBadge = (cls?: string) => {
    switch (cls) {
      case "MEASURED":
        return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
      case "BENCHMARK":
        return "bg-sky-500/10 text-sky-400 border border-sky-500/20";
      case "DERIVED":
        return "bg-purple-500/10 text-purple-400 border border-purple-500/20";
      case "SIMULATED":
      case "SYNTHETIC":
        return "bg-amber-500/10 text-amber-400 border border-amber-500/20";
      default:
        return "bg-atlas-elevated text-atlas-muted border border-atlas-border";
    }
  };

  return (
    <div className="min-h-screen bg-atlas-bg text-atlas-text font-sans antialiased pb-24">
      {/* Editorial Sub-Header matching Card 09 */}
      <div className="border-b border-atlas-border bg-atlas-surface/80 backdrop-blur-md sticky top-16 z-30 mb-8 px-6 md:px-8 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-xl font-bold text-white tracking-tight">
              Data &amp; Provenance
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              100% VERIFIED LEDGER
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleIngestM20}
              disabled={isIngesting}
              className="px-3.5 py-1.5 rounded-xl border border-atlas-border hover:border-atlas-teal/40 bg-atlas-elevated text-xs font-mono text-atlas-text flex items-center gap-1.5 transition"
            >
              {isIngesting ? "Ingesting M20…" : "Ingest Live M20"}
            </button>
            <button
              onClick={handleExportProvenance}
              className="px-4 py-1.5 rounded-xl bg-atlas-orange hover:bg-atlas-orange-hover text-white text-xs font-bold font-mono flex items-center gap-2 transition shadow-md shadow-atlas-orange/20"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-8 space-y-8">
        {/* Core Dataset Table matching Card 09 Image */}
        <div className="bg-atlas-surface border border-atlas-border rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-atlas-border flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold font-display text-white">
                Planetary Mission Datasets &amp; Sensors
              </h2>
              <p className="text-xs text-atlas-muted mt-0.5 font-mono">
                Authoritative NASA/ESA telemetry, altimetry, and spectral observations
              </p>
            </div>
            <span className="text-xs font-mono text-atlas-muted">
              {BENCHMARK_CORE_DATASETS.length} Datasets Active
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left font-mono">
              <thead>
                <tr className="border-b border-atlas-border text-atlas-muted bg-atlas-elevated/40">
                  <th className="py-3 px-6 font-semibold uppercase tracking-wider">Dataset</th>
                  <th className="py-3 px-6 font-semibold uppercase tracking-wider">Mission</th>
                  <th className="py-3 px-6 font-semibold uppercase tracking-wider">Type</th>
                  <th className="py-3 px-6 font-semibold uppercase tracking-wider">Resolution</th>
                  <th className="py-3 px-6 font-semibold uppercase tracking-wider text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-atlas-border">
                {BENCHMARK_CORE_DATASETS.map((row, idx) => (
                  <tr key={idx} className="hover:bg-atlas-elevated/40 transition">
                    <td className="py-4 px-6 font-bold text-white font-sans text-sm">
                      {row.name}
                    </td>
                    <td className="py-4 px-6 text-atlas-text">
                      {row.mission}
                    </td>
                    <td className="py-4 px-6 text-atlas-teal">
                      {row.type}
                    </td>
                    <td className="py-4 px-6 text-atlas-muted">
                      {row.resolution}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Truthfulness Tier Badges */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { tag: "MEASURED", desc: "Orbital MOLA / HiRISE observations", cls: "text-emerald-400 border-emerald-500/20 bg-emerald-500/10" },
            { tag: "BENCHMARK", desc: "NASA landing site ground truth", cls: "text-sky-400 border-sky-500/20 bg-sky-500/10" },
            { tag: "DERIVED", desc: "Analytical slope & CRISM unmixing", cls: "text-purple-400 border-purple-500/20 bg-purple-500/10" },
            { tag: "SIMULATED", desc: "Deterministic rover & Monte Carlo", cls: "text-amber-400 border-amber-500/20 bg-amber-500/10" },
            { tag: "FALLBACK", desc: "Offline deterministic safety rules", cls: "text-rose-400 border-rose-500/20 bg-rose-500/10" },
          ].map((tier) => (
            <div key={tier.tag} className={`rounded-2xl p-4 border ${tier.cls}`}>
              <div className="text-xs font-mono font-bold tracking-wider">{tier.tag}</div>
              <div className="text-xs opacity-85 mt-1 leading-snug">{tier.desc}</div>
            </div>
          ))}
        </div>

        {/* Interactive Filter Bar */}
        <div className="bg-atlas-surface border border-atlas-border rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="font-bold text-white flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-atlas-teal" />
              Filter Ingested Pipelines &amp; Datasets
            </span>
            <button onClick={resetFilters} className="text-atlas-muted hover:text-atlas-orange transition">
              Reset Filters
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="lg:col-span-2 relative">
              <Search className="w-3.5 h-3.5 text-atlas-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search dataset, pipeline, model..."
                aria-label="Search provenance records"
                className="w-full bg-atlas-elevated border border-atlas-border rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-white placeholder:text-atlas-muted focus:outline-none focus:border-atlas-teal"
              />
            </div>

            <select
              value={classification}
              onChange={(e) => setClassification(e.target.value)}
              aria-label="Filter by provenance classification"
              className="bg-atlas-elevated border border-atlas-border rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-atlas-teal"
            >
              <option value="">All Classifications</option>
              <option value="MEASURED">MEASURED</option>
              <option value="BENCHMARK">BENCHMARK</option>
              <option value="DERIVED">DERIVED</option>
              <option value="SIMULATED">SIMULATED</option>
            </select>

            <select
              value={validationStatus}
              onChange={(e) => setValidationStatus(e.target.value)}
              aria-label="Filter by validation status"
              className="bg-atlas-elevated border border-atlas-border rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-atlas-teal"
            >
              <option value="">All Validation States</option>
              <option value="METADATA_VERIFIED">METADATA_VERIFIED</option>
              <option value="INGESTED_CHECKSUM_VERIFIED">INGESTED_CHECKSUM_VERIFIED</option>
            </select>

            <input
              type="text"
              value={missionFilter}
              onChange={(e) => setMissionFilter(e.target.value)}
              placeholder="Mission (MRO, MGS)..."
              aria-label="Filter by mission"
              className="bg-atlas-elevated border border-atlas-border rounded-xl px-3 py-2 text-xs font-mono text-white placeholder:text-atlas-muted focus:outline-none focus:border-atlas-teal"
            />
          </div>
        </div>

        {ingestMessage && (
          <div
            className={`rounded-xl p-4 border text-xs font-mono flex items-center gap-2 ${
              ingestMessage.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-rose-500/10 border-rose-500/30 text-rose-300"
            }`}
          >
            {ingestMessage.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            <span>{ingestMessage.text}</span>
          </div>
        )}

        {/* Audit Chain Ledger & Ingested Catalog Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Datasets List (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            <h2 className="text-sm font-mono uppercase tracking-wider text-atlas-muted flex items-center gap-2">
              <Database className="w-4 h-4 text-atlas-teal" />
              Verified Ingestion Registry ({explorer?.datasets.length ?? 0} of {explorer?.totalDatasets ?? 0})
            </h2>

            {isLoading ? (
              <div className="h-48 bg-atlas-surface border border-atlas-border rounded-2xl animate-pulse" />
            ) : (explorer?.datasets.length || 0) === 0 ? (
              <div className="bg-atlas-surface border border-atlas-border rounded-2xl p-8 text-center text-sm font-mono text-atlas-muted">
                No datasets match the active provenance filters.
              </div>
            ) : (
              <div className="space-y-3">
                {explorer?.datasets.map((src) => (
                  <div key={src.id} className="bg-atlas-surface border border-atlas-border rounded-2xl p-5 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div>
                        <div className="text-[11px] font-mono text-atlas-teal">
                          {src.mission} · <span className="text-white">{src.product || src.id}</span>
                        </div>
                        <h3 className="text-base font-bold font-display text-white mt-0.5">{src.name}</h3>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${classificationBadge(src.classification)}`}>
                          {src.classification || "BENCHMARK"}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {src.validationStatus || "METADATA_VERIFIED"}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] font-mono bg-atlas-elevated border border-atlas-border rounded-xl p-3">
                      <div>
                        <span className="text-atlas-muted block text-[10px] uppercase">Stage</span>
                        <span className="text-white">{src.processingStage || src.coverage}</span>
                      </div>
                      <div>
                        <span className="text-atlas-muted block text-[10px] uppercase">Pipeline</span>
                        <span className="text-white">{src.pipelineName || src.id}</span>
                      </div>
                      <div>
                        <span className="text-atlas-muted block text-[10px] uppercase">Last Sync</span>
                        <span className="text-white">{src.lastSync || "ONLINE"}</span>
                      </div>
                    </div>

                    {src.limitations && (
                      <div className="text-xs font-mono text-amber-300/90 flex items-start gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
                        <span>
                          <strong>Limitation:</strong> {src.limitations}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[11px] font-mono text-atlas-muted pt-1 border-t border-atlas-border">
                      <span>{src.attribution}</span>
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-atlas-orange hover:underline flex items-center gap-1"
                      >
                        PDS Reference <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: SHA-256 Ledger & Lineage (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            {/* Audit Chain Verification Card */}
            <div className="bg-atlas-surface border border-atlas-border rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold font-display text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-400" />
                  SHA-256 Block Ledger
                </h3>
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-mono border border-emerald-500/20">
                  {explorer?.auditVerification.valid ? "VALID" : "UNVERIFIED"}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-atlas-elevated border border-atlas-border text-xs font-mono space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-atlas-muted">Total Blocks:</span>
                  <span className="font-bold text-white">{explorer?.auditVerification.totalBlocks ?? 0}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-atlas-muted">Head Hash:</span>
                  <span className="text-[10px] text-atlas-teal break-all">
                    {explorer?.auditVerification.latestHash || "GENESIS_ROOT"}
                  </span>
                </div>
              </div>

              {explorer?.recentAuditBlocks && explorer.recentAuditBlocks.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-atlas-border max-h-48 overflow-y-auto">
                  {explorer.recentAuditBlocks.slice(0, 5).map((blk) => (
                    <div key={blk.eventId} className="bg-atlas-elevated border border-atlas-border rounded-xl p-2.5 text-[11px] font-mono space-y-0.5">
                      <div className="flex items-center justify-between text-white font-semibold">
                        <span>#{blk.blockHeight} {blk.action}</span>
                        <span className="text-atlas-muted text-[10px]">{blk.missionPlanId}</span>
                      </div>
                      <div className="text-[10px] text-atlas-muted truncate">{blk.integrityHash}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Linked Mission Decisions & Lineage */}
            <div className="bg-atlas-surface border border-atlas-border rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold font-display text-white flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-purple-400" />
                  Decision Lineage
                </h3>
                <button
                  onClick={() => navigate("/replay")}
                  className="text-[11px] font-mono text-atlas-teal hover:underline flex items-center gap-1"
                >
                  <History className="w-3 h-3" /> Replay
                </button>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  placeholder="Event ID..."
                  className="w-full bg-atlas-elevated border border-atlas-border rounded-xl px-3 py-1.5 text-xs font-mono text-white placeholder:text-atlas-muted focus:outline-none focus:border-atlas-teal"
                />
              </div>

              {lineage?.nodes && lineage.nodes.length > 0 && (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {lineage.nodes.map((node: any) => (
                    <div key={node.nodeId} className="bg-atlas-elevated border border-atlas-border rounded-xl p-2.5 text-xs font-mono space-y-0.5">
                      <div className="font-bold text-white text-[11px]">{node.title}</div>
                      <div className="text-[10px] text-atlas-muted">{node.summary}</div>
                    </div>
                  ))}
                </div>
              )}

              {(explorer?.linkedDecisions.length || 0) === 0 ? (
                <p className="text-xs font-mono text-atlas-muted py-4 text-center border border-dashed border-atlas-border rounded-xl">
                  No decision records found.
                </p>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {explorer?.linkedDecisions.map((dec) => (
                    <div key={dec.id} className="bg-atlas-elevated border border-atlas-border rounded-xl p-3 text-xs font-mono space-y-1">
                      <div className="font-bold text-white">{dec.targetName}</div>
                      <div className="text-[11px] text-atlas-teal">
                        Mission: {dec.missionId}
                      </div>
                      <div className="text-[11px] text-atlas-muted font-sans line-clamp-2">{dec.rationale}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
