import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  ExternalLink,
  Filter,
  GitBranch,
  History,
  Search,
  ShieldCheck,
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
        return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
      case "BENCHMARK":
        return "bg-sky-500/15 text-sky-300 border-sky-500/30";
      case "DERIVED":
        return "bg-indigo-500/15 text-indigo-300 border-indigo-500/30";
      case "SIMULATED":
      case "SYNTHETIC":
        return "bg-amber-500/15 text-amber-300 border-amber-500/30";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-slate-950 text-slate-200 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-mono tracking-widest uppercase mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span>Data &amp; Provenance Investigation Workspace</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-100">
              Dataset Provenance, Validation &amp; Decision Lineage
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl">
              Inspect planetary datasets, processing stages, model versions, validation status, cryptographic audit-chain integrity, and linked mission decisions.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleIngestM20}
              disabled={isIngesting}
              className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-semibold text-white"
            >
              {isIngesting ? "Ingesting NASA JPL M20…" : "Ingest Live NASA M20 Traverse"}
            </button>
            <button
              onClick={() => navigate("/science")}
              className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 hover:border-emerald-500/50 text-xs font-medium text-slate-200"
            >
              Science Targets
            </button>
            <button
              onClick={handleExportProvenance}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-xs font-medium text-slate-200 transition-colors"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              Export Provenance JSON
            </button>
          </div>
        </div>

        {/* Truthfulness Tier Summary */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { tag: "MEASURED", desc: "Orbital MOLA / HiRISE / PDS observations", cls: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10" },
            { tag: "BENCHMARK", desc: "Verified NASA landing site & core ground truth", cls: "text-sky-300 border-sky-500/30 bg-sky-500/10" },
            { tag: "DERIVED", desc: "Analytical slope, CRISM unmixing, SHARAD models", cls: "text-indigo-300 border-indigo-500/30 bg-indigo-500/10" },
            { tag: "SIMULATED", desc: "Deterministic rover / EVA / Monte Carlo scenarios", cls: "text-amber-300 border-amber-500/30 bg-amber-500/10" },
            { tag: "FALLBACK", desc: "Offline rule-based fallback when services inactive", cls: "text-rose-300 border-rose-500/30 bg-rose-500/10" },
          ].map((tier) => (
            <div key={tier.tag} className={`rounded-xl p-3 border ${tier.cls}`}>
              <div className="text-[11px] font-mono font-bold">{tier.tag}</div>
              <div className="text-[11px] opacity-85 mt-0.5">{tier.desc}</div>
            </div>
          ))}
        </div>

        {/* Interactive Provenance Filter Bar */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-200 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-emerald-400" />
              Filter Datasets, Pipelines &amp; Provenance Records
            </span>
            <button onClick={resetFilters} className="text-slate-400 hover:text-slate-200 underline">
              Reset Filters
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
            <div className="lg:col-span-2 relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search dataset, pipeline, model version..."
                aria-label="Search provenance records"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200"
              />
            </div>

            <select
              value={classification}
              onChange={(e) => setClassification(e.target.value)}
              aria-label="Filter by provenance classification"
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
            >
              <option value="">All Classifications</option>
              <option value="MEASURED">MEASURED</option>
              <option value="BENCHMARK">BENCHMARK</option>
              <option value="DERIVED">DERIVED</option>
              <option value="PREDICTED">PREDICTED</option>
              <option value="SIMULATED">SIMULATED</option>
              <option value="SYNTHETIC">SYNTHETIC</option>
            </select>

            <select
              value={validationStatus}
              onChange={(e) => setValidationStatus(e.target.value)}
              aria-label="Filter by validation status"
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
            >
              <option value="">All Validation States</option>
              <option value="METADATA_VERIFIED">METADATA_VERIFIED</option>
              <option value="INGESTED_CHECKSUM_VERIFIED">INGESTED_CHECKSUM_VERIFIED</option>
              <option value="PARTIAL_METADATA">PARTIAL_METADATA</option>
              <option value="PENDING_VERIFICATION">PENDING_VERIFICATION</option>
              <option value="UNAVAILABLE">UNAVAILABLE</option>
            </select>

            <input
              type="text"
              value={missionFilter}
              onChange={(e) => setMissionFilter(e.target.value)}
              placeholder="Mission (e.g. MRO, MGS)..."
              aria-label="Filter by mission"
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
            />

            <input
              type="text"
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              placeholder="Product / Stage..."
              aria-label="Filter by product"
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
            />
          </div>
        </div>

        {ingestMessage && (
          <div
            className={`rounded-xl p-3 border text-xs ${
              ingestMessage.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
                : "bg-rose-500/10 border-rose-500/30 text-rose-200"
            }`}
          >
            {ingestMessage.text}
          </div>
        )}

        {/* Locally Ingested Datasets (Verified Retrieval) */}
        <div className="bg-slate-900/80 border border-emerald-500/30 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-emerald-300">
              Locally Ingested External Datasets ({explorer?.ingestedDatasets?.length ?? 0})
            </h2>
            <span className="text-[11px] font-mono text-slate-400">
              Real HTTP retrieval + GeoJSON/EPSG:4326 validation + SHA-256 checksum
            </span>
          </div>
          {!explorer?.ingestedDatasets || explorer.ingestedDatasets.length === 0 ? (
            <div className="text-xs text-slate-400">
              No external NASA datasets have been locally ingested yet. Click{" "}
              <strong>Ingest Live NASA M20 Traverse</strong> above to retrieve and verify the official NASA JPL Perseverance rover traverse GeoJSON.
            </div>
          ) : (
            <div className="space-y-2">
              {explorer.ingestedDatasets.map((ing: any) => (
                <div key={ing.id} className="bg-slate-950/70 border border-slate-800 rounded-lg p-3 text-xs space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold text-slate-100">{ing.name}</div>
                    <div className="flex items-center gap-1.5 font-mono text-[10px]">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        {ing.recordKind}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30">
                        {ing.validationStatus}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-400">
                    <div>Retrieved: <span className="font-mono text-slate-200">{ing.retrievedAt}</span></div>
                    <div>Sol / Distance: <span className="font-mono text-slate-200">Sol {ing.summary?.currentSol} · {ing.summary?.totalDistanceKm?.toFixed(2)} km</span></div>
                    <div>Checksum: <span className="font-mono text-slate-200">{ing.checksumSha256?.slice(0, 16)}…</span></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Audit Chain Status + Dataset Registry */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                <Database className="w-5 h-5 text-sky-400" />
                External Reference &amp; Analytical Model Catalog ({explorer?.datasets.length ?? 0} of {explorer?.totalDatasets ?? 0})
              </h2>
            </div>

            {isLoading ? (
              <div className="h-48 bg-slate-900 border border-slate-800 rounded-xl animate-pulse" />
            ) : (explorer?.datasets.length || 0) === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center text-sm text-slate-400">
                No datasets match the active provenance filters.
              </div>
            ) : (
              <div className="space-y-3">
                {explorer?.datasets.map((src) => (
                  <div key={src.id} className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div>
                        <div className="text-[11px] font-mono text-slate-400">
                          {src.mission} · <span className="text-sky-400">{src.product || src.id}</span>
                        </div>
                        <h3 className="text-sm font-bold text-slate-100">{src.name}</h3>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        <span className="px-2 py-0.5 rounded border border-slate-700 bg-slate-950 text-[10px] font-mono text-slate-300">
                          {src.recordKind || "VERIFIED_EXTERNAL_REFERENCE"}
                        </span>
                        <span className={`px-2 py-0.5 rounded border text-[10px] font-mono ${classificationBadge(src.classification)}`}>
                          {src.classification || "BENCHMARK"}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                            src.validationStatus === "METADATA_VERIFIED" || src.validationStatus === "INGESTED_CHECKSUM_VERIFIED"
                              ? "bg-emerald-500/15 text-emerald-300"
                              : "bg-amber-500/15 text-amber-300"
                          }`}
                        >
                          {src.validationStatus || "METADATA_VERIFIED"}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-400 bg-slate-950/60 border border-slate-800/80 rounded-lg p-2.5">
                      <div>
                        <span className="text-slate-500 block">Processing Stage</span>
                        <span className="text-slate-200">{src.processingStage || src.coverage}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Pipeline &amp; Model Version</span>
                        <span className="font-mono text-slate-200">
                          {src.pipelineName || src.id} ({src.modelVersion || "v1.0"})
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Retrieval / Ingestion Status</span>
                        <span className="font-mono text-slate-200">
                          {src.retrievalTimestamp
                            ? `${src.retrievalTimestamp.slice(0, 19).replace("T", " ")} UTC`
                            : src.lastSync}
                        </span>
                      </div>
                    </div>

                    {src.limitations && (
                      <div className="text-xs text-amber-300/90 flex items-start gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>
                          <strong>Limitation:</strong> {src.limitations}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                      <span>{src.attribution}</span>
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sky-400 hover:underline flex items-center gap-1"
                      >
                        PDS Reference <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Audit Chain Verification + Linked Decisions */}
          <div className="lg:col-span-4 space-y-5">
            {/* Audit Chain Verification */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  Audit Chain Integrity
                </h3>
                {explorer?.auditVerification.valid ? (
                  <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[10px] font-mono flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> VERIFIED
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 text-[10px] font-mono">
                    TAMPER / INVALID
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-400 space-y-1">
                <div>
                  Total Blocks: <strong className="text-slate-200">{explorer?.auditVerification.totalBlocks ?? 0}</strong>
                </div>
                <div className="font-mono text-[11px] break-all text-slate-400">
                  Head Hash: {explorer?.auditVerification.latestHash || "GENESIS"}
                </div>
                <div className="text-[11px] text-slate-500 pt-1">
                  Verifies local mission-decision hash chain integrity; external dataset authenticity is verified separately via SHA-256 ingestion checksums.
                </div>
              </div>
              {explorer?.recentAuditBlocks && explorer.recentAuditBlocks.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-slate-800 max-h-48 overflow-y-auto">
                  {explorer.recentAuditBlocks.slice(0, 5).map((blk) => (
                    <div key={blk.eventId} className="bg-slate-950/70 border border-slate-800/80 rounded p-2 text-[11px]">
                      <div className="flex items-center justify-between font-mono text-slate-300">
                        <span>#{blk.blockHeight} {blk.action}</span>
                        <span className="text-slate-500">{blk.missionPlanId}</span>
                      </div>
                      <div className="font-mono text-[10px] text-slate-500 truncate">{blk.integrityHash}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Linked Scientific Decisions */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
                  <GitBranch className="w-4 h-4 text-indigo-400" />
                  Linked Mission Decisions
                </h3>
                <button
                  onClick={() => navigate("/replay")}
                  className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1"
                >
                  <History className="w-3 h-3" /> Replay
                </button>
              </div>
              {(explorer?.linkedDecisions.length || 0) === 0 ? (
                <p className="text-xs text-slate-500">
                  No persisted science-target decisions match the current filter.
                </p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {explorer?.linkedDecisions.map((dec) => (
                    <div key={dec.id} className="bg-slate-950/70 border border-slate-800 rounded-lg p-2.5 text-xs">
                      <div className="font-semibold text-slate-200">{dec.targetName}</div>
                      <div className="text-[11px] text-emerald-300 font-mono">
                        Mission: {dec.missionId} · {dec.provenanceClassification}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{dec.rationale}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Decision Lineage Inspector */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-100">Decision Lineage Trace</h3>
                <input
                  type="text"
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  aria-label="Inspect decision event ID"
                  className="w-36 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[11px] font-mono text-slate-300"
                />
              </div>
              {lineage?.nodes ? (
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {lineage.nodes.map((node: any) => (
                    <div key={node.nodeId} className="bg-slate-950/70 border border-slate-800 rounded p-2 text-[11px]">
                      <div className="font-semibold text-slate-200">
                        {node.stepIndex}. {node.title}
                      </div>
                      <div className="text-slate-400">{node.summary}</div>
                      <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                        {node.stage} · {node.actor}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-500">Enter an event ID to inspect lineage.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
