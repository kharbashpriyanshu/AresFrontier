import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Compass,
  Database,
  Droplets,
  ExternalLink,
  FlaskConical,
  GitCompare,
  Layers,
  MapPin,
  Microscope,
  PlusCircle,
  Search,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { api } from "../services/api.js";
import type {
  IceAssessmentResult,
  MineralClassificationResult,
  ObjectivesEvaluationResult,
  ScienceDecisionRecord,
  ScienceObjectiveId,
  ScienceTarget,
  ScientificAssessment,
  TargetEvaluationResult,
} from "../types/index.js";

interface MissionSummary {
  id: string;
  name: string;
  status?: string;
}

const OBJECTIVE_OPTIONS: { id: ScienceObjectiveId; label: string }[] = [
  { id: "ANCIENT_WATER_ACTIVITY", label: "Ancient Water Activity" },
  { id: "PAST_HABITABILITY", label: "Past Habitability" },
  { id: "MINERALOGICAL_DIVERSITY", label: "Mineralogical Diversity" },
  { id: "VOLCANIC_HISTORY", label: "Volcanic History" },
  { id: "SEDIMENTARY_HISTORY", label: "Sedimentary History" },
  { id: "ASTROBIOLOGY_RELEVANCE", label: "Astrobiology Relevance" },
];

export const SciencePage: React.FC = () => {
  const navigate = useNavigate();
  const [targets, setTargets] = useState<ScienceTarget[]>([]);
  const [missions, setMissions] = useState<MissionSummary[]>([]);
  const [decisions, setDecisions] = useState<ScienceDecisionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRegion, setSelectedRegion] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedValue, setSelectedValue] = useState<string>("all");

  const [activeTarget, setActiveTarget] = useState<ScienceTarget | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  // Live scientific assessments for activeTarget
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalError, setEvalError] = useState<string | null>(null);
  const [coordAssessment, setCoordAssessment] = useState<ScientificAssessment | null>(null);
  const [targetEval, setTargetEval] = useState<TargetEvaluationResult | null>(null);
  const [mineralResult, setMineralResult] = useState<MineralClassificationResult | null>(null);
  const [iceResult, setIceResult] = useState<IceAssessmentResult | null>(null);
  const [objectiveEval, setObjectiveEval] = useState<ObjectivesEvaluationResult | null>(null);

  // Mission assignment state
  const [selectedMissionId, setSelectedMissionId] = useState<string>("MARSWALK-001");
  const [selectedObjectiveId, setSelectedObjectiveId] = useState<ScienceObjectiveId>("ANCIENT_WATER_ACTIVITY");
  const [assignmentRationale, setAssignmentRationale] = useState<string>("");
  const [assignStatus, setAssignStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);

  useEffect(() => {
    Promise.all([
      api.getScienceTargets(),
      api.getAllMissions().catch(() => []),
      api.getScienceDecisions().catch(() => []),
    ])
      .then(([tgtList, missionList, decisionList]) => {
        setTargets(tgtList);
        if (tgtList.length > 0) {
          setActiveTarget(tgtList[0]);
        }
        const mappedMissions = (missionList as any[]).map((m) => ({
          id: m.id,
          name: m.name || m.id,
          status: m.status,
        }));
        setMissions(mappedMissions);
        if (mappedMissions.length > 0) {
          setSelectedMissionId(mappedMissions[0].id);
        }
        setDecisions(decisionList);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const regions = useMemo(() => {
    const set = new Set<string>();
    targets.forEach((t) => {
      if (t.region) set.add(t.region);
    });
    return Array.from(set);
  }, [targets]);

  const filteredTargets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return targets.filter((t) => {
      const matchRegion = selectedRegion === "all" || (t.region || "").toLowerCase() === selectedRegion.toLowerCase();
      const matchCat = selectedCategory === "all" || t.category.toLowerCase() === selectedCategory.toLowerCase();
      const matchVal = selectedValue === "all" || t.scientificValue.toLowerCase() === selectedValue.toLowerCase();
      const matchSearch =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        (t.region || "").toLowerCase().includes(q) ||
        (t.associatedFormation || "").toLowerCase().includes(q) ||
        t.dataSource.toLowerCase().includes(q);
      return matchRegion && matchCat && matchVal && matchSearch;
    });
  }, [targets, selectedRegion, selectedCategory, selectedValue, searchQuery]);

  const comparedTargets = useMemo(
    () => targets.filter((t) => compareIds.includes(t.id)),
    [targets, compareIds]
  );

  const toggleCompare = (id: string) => {
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : prev.length < 3 ? [...prev, id] : [...prev.slice(1), id]
    );
  };

  const handleSelectTarget = (tgt: ScienceTarget) => {
    setActiveTarget(tgt);
    setTargetEval(null);
    setCoordAssessment(null);
    setMineralResult(null);
    setIceResult(null);
    setObjectiveEval(null);
    setEvalError(null);
    setAssignStatus(null);
  };

  const handleRunFullInvestigation = async (tgt: ScienceTarget) => {
    setIsEvaluating(true);
    setEvalError(null);
    try {
      const [assessRes, targetRes, mineralRes, iceRes, objRes] = await Promise.all([
        api.getScientificAssessment(tgt.coordinate.latitude, tgt.coordinate.longitude),
        api.evaluateScienceTarget({
          targetId: tgt.id,
          name: tgt.name,
          latitude: tgt.coordinate.latitude,
          longitude: tgt.coordinate.longitude,
          targetType: tgt.category,
          description: tgt.description,
          primaryObjective: selectedObjectiveId,
        }),
        api.classifyMineralogy({
          latitude: tgt.coordinate.latitude,
          longitude: tgt.coordinate.longitude,
          geologicalContext: tgt.associatedFormation || tgt.description,
        }),
        api.assessIceStability({
          latitude: tgt.coordinate.latitude,
          longitude: tgt.coordinate.longitude,
        }),
        api.evaluateScienceObjectives({
          objectiveId: selectedObjectiveId,
          targetTypes: [tgt.category],
          waypointsCount: 2,
          routeLengthKm: 3.4,
        }),
      ]);
      setCoordAssessment(assessRes);
      setTargetEval(targetRes);
      setMineralResult(mineralRes);
      setIceResult(iceRes);
      setObjectiveEval(objRes);
    } catch (err) {
      setEvalError(err instanceof Error ? err.message : "Failed to run scientific assessment.");
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleAssignToMission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTarget) return;
    setIsAssigning(true);
    setAssignStatus(null);
    try {
      const created = await api.assignScienceTargetToMission(activeTarget.id, {
        missionId: selectedMissionId.trim() || "MARSWALK-001",
        objectiveId: selectedObjectiveId,
        rationale:
          assignmentRationale.trim() ||
          `Investigate ${activeTarget.name} (${activeTarget.region || "Mars"}) for ${selectedObjectiveId}.`,
      });
      setDecisions((prev) => [created, ...prev]);
      setAssignmentRationale("");
      setAssignStatus({
        type: "success",
        message: `Persisted target assignment (${created.id}) with audit hash ${created.auditBlockHash.slice(0, 12)}…`,
      });
    } catch (err) {
      setAssignStatus({
        type: "error",
        message: err instanceof Error ? err.message : "Target assignment rejected.",
      });
    } finally {
      setIsAssigning(false);
    }
  };

  const evidenceBadge = (status?: string) => {
    switch (status) {
      case "verified_in_situ":
        return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
      case "partial_coverage":
        return "bg-amber-500/15 text-amber-300 border-amber-500/30";
      case "orbital_only":
      default:
        return "bg-sky-500/15 text-sky-300 border-sky-500/30";
    }
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-slate-950 text-slate-200 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-mono tracking-widest uppercase mb-1">
              <Microscope className="w-4 h-4" />
              <span>Science Intelligence &amp; Target Evaluation</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-100">
              Martian Planetary Science Targets
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl">
              Investigate NASA &amp; ESA-referenced targets across Jezero Crater, Gale Crater, Olympus Mons, Valles Marineris, Oxia Planum, and Utopia Planitia. All model outputs disclose provenance, fallback status, and missing evidence.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => navigate("/methodology")}
              className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 hover:border-emerald-500/50 text-xs font-medium text-slate-200 flex items-center gap-1.5"
            >
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              Data &amp; Provenance
            </button>
            <button
              onClick={() => navigate("/map")}
              className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 hover:border-sky-500/50 text-xs font-medium text-slate-200 flex items-center gap-1.5"
            >
              <Compass className="w-3.5 h-3.5 text-sky-400" />
              Open Map
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-slate-900/70 border border-slate-800 rounded-xl p-4">
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search target, formation, or NASA dataset..."
              aria-label="Search science targets"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            aria-label="Filter by region"
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Mars Regions</option>
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            aria-label="Filter by category"
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Categories</option>
            <option value="stratigraphy">Stratigraphy</option>
            <option value="mineralogy">Mineralogy</option>
            <option value="paleohydrology">Paleohydrology</option>
            <option value="geomorphology">Geomorphology</option>
            <option value="volcanology">Volcanology</option>
            <option value="astrobiology">Astrobiology</option>
          </select>

          <select
            value={selectedValue}
            onChange={(e) => setSelectedValue(e.target.value)}
            aria-label="Filter by scientific value"
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Value Tiers</option>
            <option value="high">High Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="low">Low Priority</option>
          </select>
        </div>

        {/* Main Split Workspace */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-56 bg-slate-900 border border-slate-800 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Target Catalog List */}
            <div className="lg:col-span-5 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span>
                  Showing <strong className="text-slate-200">{filteredTargets.length}</strong> of {targets.length} targets
                </span>
                {compareIds.length > 0 && (
                  <button
                    onClick={() => setCompareIds([])}
                    className="text-amber-400 hover:text-amber-300 underline"
                  >
                    Clear Compare ({compareIds.length})
                  </button>
                )}
              </div>

              {filteredTargets.length === 0 ? (
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 text-center text-sm text-slate-400">
                  No science targets match the current filters.
                </div>
              ) : (
                <div className="space-y-3 max-h-[760px] overflow-y-auto pr-1">
                  {filteredTargets.map((tgt) => {
                    const isSelected = activeTarget?.id === tgt.id;
                    const isCompared = compareIds.includes(tgt.id);
                    return (
                      <div
                        key={tgt.id}
                        onClick={() => handleSelectTarget(tgt)}
                        className={`cursor-pointer rounded-xl p-4 border transition-all ${
                          isSelected
                            ? "bg-slate-900 border-emerald-500/70 shadow-lg shadow-emerald-950/30"
                            : "bg-slate-900/70 border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <div className="text-[11px] font-mono text-emerald-400 uppercase tracking-wider">
                              {tgt.region || "Mars"} · {tgt.category}
                            </div>
                            <h3 className="text-sm font-semibold text-slate-100 mt-0.5">{tgt.name}</h3>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              tgt.scientificValue === "high"
                                ? "bg-emerald-500/20 text-emerald-300"
                                : tgt.scientificValue === "medium"
                                ? "bg-amber-500/20 text-amber-300"
                                : "bg-slate-700 text-slate-300"
                            }`}
                          >
                            {tgt.scientificValue}
                          </span>
                        </div>

                        <p className="text-xs text-slate-400 line-clamp-2 mb-3">{tgt.description}</p>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] pt-2 border-t border-slate-800/80">
                          <div className="flex items-center gap-1.5">
                            <span className={`px-2 py-0.5 rounded border text-[10px] font-mono ${evidenceBadge(tgt.evidenceStatus)}`}>
                              {(tgt.evidenceStatus || "orbital_only").replace(/_/g, " ")}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-300">
                              {tgt.provenanceClassification || "BENCHMARK"}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCompare(tgt.id);
                            }}
                            className={`px-2 py-0.5 rounded text-[10px] font-medium border flex items-center gap-1 ${
                              isCompared
                                ? "bg-indigo-500/20 border-indigo-400 text-indigo-300"
                                : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            <GitCompare className="w-3 h-3" />
                            {isCompared ? "Comparing" : "Compare"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Active Target Investigation Panel */}
            <div className="lg:col-span-7 space-y-5">
              {activeTarget ? (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-800 pb-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-400 mb-1">
                        <span className="text-emerald-400">{activeTarget.region || "Mars"}</span>
                        <span>•</span>
                        <span>
                          {activeTarget.coordinate.latitude.toFixed(3)}°N, {activeTarget.coordinate.longitude.toFixed(3)}°E
                        </span>
                        <span>•</span>
                        <span>{activeTarget.associatedFormation || activeTarget.category}</span>
                      </div>
                      <h2 className="text-xl font-bold text-slate-100">{activeTarget.name}</h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() =>
                          navigate(
                            `/map?lat=${activeTarget.coordinate.latitude}&lon=${activeTarget.coordinate.longitude}&addScience=${encodeURIComponent(
                              activeTarget.id
                            )}`
                          )
                        }
                        className="px-3 py-1.5 rounded-lg bg-sky-500/15 border border-sky-500/40 text-sky-300 hover:bg-sky-500/25 text-xs font-medium flex items-center gap-1.5"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        View &amp; Add on Map
                      </button>
                      <button
                        onClick={() => handleRunFullInvestigation(activeTarget)}
                        disabled={isEvaluating}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        {isEvaluating ? "Evaluating…" : "Run Scientific Assessment"}
                      </button>
                    </div>
                  </div>

                  <p className="text-sm text-slate-300 leading-relaxed">{activeTarget.description}</p>

                  {/* Evidence, Samples & Missing Evidence Disclosure */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3.5 space-y-2">
                      <div className="text-[11px] font-mono uppercase text-slate-400">
                        Available Samples &amp; Source
                      </div>
                      <div className="text-xs text-slate-300">{activeTarget.dataSource}</div>
                      {activeTarget.potentialSamples && activeTarget.potentialSamples.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {activeTarget.potentialSamples.map((s) => (
                            <span
                              key={s}
                              className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-300"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-amber-300/90 flex items-center gap-1.5 pt-1">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>No in-situ surface samples available (orbital reconnaissance only).</span>
                        </div>
                      )}
                    </div>

                    <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3.5 space-y-2">
                      <div className="text-[11px] font-mono uppercase text-amber-400 flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        Missing Evidence &amp; Uncertainty
                      </div>
                      {activeTarget.missingEvidence && activeTarget.missingEvidence.length > 0 ? (
                        <ul className="space-y-1 text-xs text-slate-300 list-disc pl-4">
                          {activeTarget.missingEvidence.map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-slate-400">No major observational gaps flagged for catalog scope.</p>
                      )}
                    </div>
                  </div>

                  {activeTarget.references && activeTarget.references.length > 0 && (
                    <div className="text-xs text-slate-400 bg-slate-950/50 border border-slate-800/80 rounded-lg p-3">
                      <span className="font-mono uppercase text-[10px] text-slate-500 block mb-1">
                        Published References
                      </span>
                      <ul className="space-y-0.5">
                        {activeTarget.references.map((ref, idx) => (
                          <li key={idx} className="text-slate-300">
                            • {ref}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {evalError && (
                    <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg p-3 text-xs">
                      {evalError}
                    </div>
                  )}

                  {/* Assessment Results */}
                  {(targetEval || mineralResult || iceResult || coordAssessment) && (
                    <div className="space-y-4 border-t border-slate-800 pt-4">
                      {/* Provenance & Fallback Banner */}
                      <div
                        className={`rounded-lg p-3 border text-xs flex flex-col gap-1 ${
                          targetEval?.fallbackUsed
                            ? "bg-amber-500/10 border-amber-500/30 text-amber-200"
                            : "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 font-semibold">
                          <span>
                            {targetEval?.fallbackUsed
                              ? "Analytical Fallback Active (Local Deterministic Planetary Rules)"
                              : "External Python Science Engine Active"}
                          </span>
                          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-950/70 border border-slate-700">
                            Provenance: {targetEval?.provenanceClassification || "DERIVED"}
                          </span>
                        </div>
                        <div className="text-[11px] opacity-90">{targetEval?.methodology}</div>
                        {targetEval?.limitations && targetEval.limitations.length > 0 && (
                          <div className="text-[11px] opacity-80">
                            Limitation: {targetEval.limitations[0]}
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {targetEval && (
                          <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3.5 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
                                <FlaskConical className="w-3.5 h-3.5" />
                                MEPAG Target Evaluation
                              </span>
                              <span className="text-xs font-mono text-slate-200">
                                Yield: {targetEval.scientific_yield_score}/100
                              </span>
                            </div>
                            <div className="text-xs text-slate-300">
                              Epoch: <strong>{targetEval.geological_epoch}</strong> · Biosignature Potential:{" "}
                              <strong>{targetEval.biosignature_preservation_potential}</strong> · Priority:{" "}
                              <strong>{targetEval.sample_return_priority}</strong>
                            </div>
                            <div className="text-[11px] text-slate-400">{targetEval.justification}</div>
                            <div className="flex flex-wrap gap-1 pt-1">
                              {targetEval.recommended_instruments.map((inst) => (
                                <span
                                  key={inst}
                                  className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] text-slate-300"
                                >
                                  {inst}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {iceResult && (
                          <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3.5 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-sky-300 flex items-center gap-1.5">
                                <Droplets className="w-3.5 h-3.5" />
                                Subsurface Ice Stability (SHARAD/SWIM)
                              </span>
                              <span className="text-xs font-mono text-slate-200">
                                {(iceResult.subsurface_ice_probability * 100).toFixed(0)}% est.
                              </span>
                            </div>
                            <div className="text-xs text-slate-300">
                              Zone: <strong>{iceResult.ice_stability_zone}</strong> · ISRU:{" "}
                              <strong>{iceResult.isru_accessibility_rating}</strong>
                            </div>
                            <div className="text-[11px] text-slate-400">{iceResult.scientific_rationale}</div>
                          </div>
                        )}
                      </div>

                      {mineralResult && (
                        <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3.5 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5">
                              <Layers className="w-3.5 h-3.5" />
                              Mineralogy &amp; Aqueous History ({mineralResult.crism_analog_unit})
                            </span>
                            <span className="text-[11px] font-mono text-slate-400">{mineralResult.pH_regime}</span>
                          </div>
                          <p className="text-xs text-slate-300">{mineralResult.aqueous_history_implication}</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                            {mineralResult.primary_minerals.map((m, idx) => (
                              <div key={idx} className="bg-slate-900 border border-slate-800 rounded p-2 text-[11px]">
                                <div className="font-semibold text-slate-200">
                                  {m.name} <span className="text-slate-500">({m.category})</span>
                                </div>
                                <div className="text-slate-400 mt-0.5">{m.astrobiological_relevance}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {objectiveEval && (
                        <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3.5 text-xs space-y-1">
                          <div className="flex items-center justify-between font-semibold text-slate-200">
                            <span>Objective Alignment ({objectiveEval.objective_id})</span>
                            <span className="font-mono text-emerald-300">
                              MEPAG {objectiveEval.mepag_alignment_score}% · Diversity {objectiveEval.scientific_diversity_score}%
                            </span>
                          </div>
                          <p className="text-slate-400">{objectiveEval.evaluation_summary}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Assign Target to Mission Plan (Persisted & Guarded) */}
                  <form
                    onSubmit={handleAssignToMission}
                    className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                        <PlusCircle className="w-4 h-4 text-emerald-400" />
                        Add Target to Mission Plan (Audited)
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        Approved/locked missions are protected
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Mission Plan</label>
                        {missions.length > 0 ? (
                          <select
                            value={selectedMissionId}
                            onChange={(e) => setSelectedMissionId(e.target.value)}
                            aria-label="Select mission plan"
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                          >
                            {missions.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name} ({m.status || "DRAFT"})
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={selectedMissionId}
                            onChange={(e) => setSelectedMissionId(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                          />
                        )}
                      </div>

                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">MEPAG Objective</label>
                        <select
                          value={selectedObjectiveId}
                          onChange={(e) => setSelectedObjectiveId(e.target.value as ScienceObjectiveId)}
                          aria-label="Select science objective"
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                        >
                          {OBJECTIVE_OPTIONS.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={assignmentRationale}
                        onChange={(e) => setAssignmentRationale(e.target.value)}
                        placeholder="Scientific rationale for mission inclusion..."
                        className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500"
                      />
                      <button
                        type="submit"
                        disabled={isAssigning}
                        className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shrink-0"
                      >
                        {isAssigning ? "Saving…" : "Assign to Mission"}
                      </button>
                    </div>

                    {assignStatus && (
                      <div
                        className={`text-xs rounded-lg p-2.5 border flex items-center gap-2 ${
                          assignStatus.type === "success"
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                            : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                        }`}
                      >
                        {assignStatus.type === "success" ? (
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                        )}
                        <span>{assignStatus.message}</span>
                      </div>
                    )}
                  </form>
                </div>
              ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-sm text-slate-400">
                  Select a target from the catalog to inspect evidence and run scientific evaluations.
                </div>
              )}

              {/* Side-by-Side Target Comparison */}
              {comparedTargets.length >= 2 && (
                <div className="bg-slate-900 border border-indigo-500/40 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-indigo-300 flex items-center gap-2">
                      <GitCompare className="w-4 h-4" />
                      Target Comparison ({comparedTargets.length} selected)
                    </h3>
                    <button
                      onClick={() => setCompareIds([])}
                      className="text-xs text-slate-400 hover:text-slate-200"
                    >
                      Close
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400">
                          <th className="py-2 pr-3">Target</th>
                          <th className="py-2 pr-3">Region</th>
                          <th className="py-2 pr-3">Category</th>
                          <th className="py-2 pr-3">Value</th>
                          <th className="py-2 pr-3">Evidence</th>
                          <th className="py-2">Missing Evidence</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/70">
                        {comparedTargets.map((t) => (
                          <tr key={t.id}>
                            <td className="py-2 pr-3 font-medium text-slate-200">{t.name}</td>
                            <td className="py-2 pr-3 text-slate-400">{t.region || "Mars"}</td>
                            <td className="py-2 pr-3 uppercase font-mono text-[11px]">{t.category}</td>
                            <td className="py-2 pr-3 uppercase font-semibold">{t.scientificValue}</td>
                            <td className="py-2 pr-3 font-mono text-[11px]">{t.evidenceStatus || "orbital_only"}</td>
                            <td className="py-2 text-slate-400">
                              {t.missingEvidence && t.missingEvidence.length > 0 ? t.missingEvidence[0] : "None flagged"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Persisted Science Decision Traceability Log */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                Persisted Scientific Target Assignments &amp; Decision Traceability
              </h3>
              <p className="text-xs text-slate-400">
                Every target-to-mission assignment is persisted with an audit hash and recorded in Mission Replay.
              </p>
            </div>
            <button
              onClick={() => navigate("/replay")}
              className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
            >
              View in Replay <ExternalLink className="w-3 h-3" />
            </button>
          </div>
          {decisions.length === 0 ? (
            <div className="text-xs text-slate-500 py-2">
              No scientific target assignments persisted yet. Assign a target above to create an audited decision record.
            </div>
          ) : (
            <div className="space-y-2">
              {decisions.slice(0, 6).map((d) => (
                <div
                  key={d.id}
                  className="bg-slate-950/70 border border-slate-800 rounded-lg px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <span className="font-semibold text-slate-200">{d.targetName}</span>
                    <span className="text-slate-500 mx-1.5">→</span>
                    <span className="font-mono text-emerald-300">{d.missionId}</span>
                    <div className="text-[11px] text-slate-400 mt-0.5">{d.rationale}</div>
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 shrink-0 text-right">
                    <div>Audit: {d.auditBlockHash.slice(0, 14)}…</div>
                    <div>Event: {d.eventId}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
