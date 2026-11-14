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

const CATEGORY_PILLS = [
  { id: "all", label: "All" },
  { id: "stratigraphy", label: "Stratigraphy" },
  { id: "mineralogy", label: "Mineralogy" },
  { id: "geomorphology", label: "Geomorphology" },
  { id: "paleohydrology", label: "Paleohydrology" },
  { id: "astrobiology", label: "Astrobiology" },
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
    <div className="min-h-screen bg-atlas-bg text-atlas-text font-sans antialiased pb-24">
      {/* Editorial Sub-Header matching Card 08 */}
      <div className="border-b border-atlas-border bg-atlas-surface/80 backdrop-blur-md sticky top-16 z-30 mb-8 px-6 md:px-8 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs uppercase tracking-widest text-atlas-muted">
              — Science Targets
            </span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-atlas-teal/10 text-atlas-teal border border-atlas-teal/20">
              NASA PDS &amp; CRISM SPECTROMETRY
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => navigate("/methodology")}
              className="px-3.5 py-1.5 rounded-lg border border-atlas-border hover:border-atlas-teal/40 bg-atlas-elevated text-xs font-mono text-atlas-text flex items-center gap-1.5 transition"
            >
              <Database className="w-3.5 h-3.5 text-atlas-teal" />
              Data &amp; Provenance
            </button>
            <button
              onClick={() => navigate("/map")}
              className="px-3.5 py-1.5 rounded-lg border border-atlas-border hover:border-atlas-orange/40 bg-atlas-elevated text-xs font-mono text-atlas-text flex items-center gap-1.5 transition"
            >
              <Compass className="w-3.5 h-3.5 text-atlas-orange" />
              Open Map
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-8 space-y-8">
        {/* Category Filter Pills matching Card 08 */}
        <div className="flex flex-wrap items-center gap-2">
          {CATEGORY_PILLS.map((p) => {
            const isSelected = selectedCategory === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedCategory(p.id)}
                className={`px-4 py-2 rounded-xl text-xs font-mono transition ${
                  isSelected
                    ? "bg-atlas-elevated border border-atlas-orange text-white font-bold shadow-md shadow-atlas-orange/10"
                    : "bg-atlas-surface border border-atlas-border text-atlas-muted hover:text-atlas-text hover:border-atlas-border/80"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Featured Target Cards Strip matching Card 08 Image: Kodiak Butte, South Séítah, Belva Crater */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              id: "SCI-001",
              name: "Kodiak Butte",
              type: "Delta Remnant",
              desc: "Prominent isolated scarp demonstrating bottomset and foreset deltaic bedding.",
            },
            {
              id: "SCI-002",
              name: "South Séítah",
              type: "Cumulate",
              desc: "Olivine-rich cumulate bedrock indicating early igneous Jezero floor emplacement.",
            },
            {
              id: "SCI-003",
              name: "Belva Crater",
              type: "Ejecta",
              desc: "Impact crater exposing deeper stratigraphic cross-sections and ancient megabreccia.",
            },
          ].map((item, idx) => (
            <div
              key={idx}
              onClick={() => {
                const targetMatch = targets.find((t) => t.name.toLowerCase().includes(item.name.toLowerCase().split(" ")[0]));
                if (targetMatch) handleSelectTarget(targetMatch);
              }}
              className="group cursor-pointer bg-atlas-surface border border-atlas-border hover:border-atlas-orange/60 rounded-2xl overflow-hidden transition-all duration-300 flex flex-col justify-between"
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-atlas-bg">
                <img
                  src="/mars-hero-bg.jpg"
                  alt={item.name}
                  className="w-full h-full object-cover filter contrast-125 brightness-90 group-hover:scale-105 transition duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-atlas-surface via-transparent to-transparent opacity-90" />
                <div className="absolute top-3 left-3 px-2 py-0.5 rounded bg-atlas-bg/80 backdrop-blur-sm border border-atlas-border text-[10px] font-mono text-atlas-teal">
                  FEATURED TARGET
                </div>
              </div>

              <div className="p-5 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold font-display text-white group-hover:text-atlas-orange transition">
                    {item.name}
                  </h3>
                  <p className="text-xs font-mono text-atlas-muted mt-0.5">{item.type}</p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-atlas-elevated border border-atlas-border flex items-center justify-center text-atlas-muted group-hover:text-atlas-orange group-hover:border-atlas-orange/40 transition">
                  <ExternalLink className="w-4 h-4" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Search & Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-atlas-surface border border-atlas-border rounded-2xl p-4">
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-atlas-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search target, formation, or NASA dataset..."
              aria-label="Search science targets"
              className="w-full bg-atlas-elevated border border-atlas-border rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-atlas-muted focus:outline-none focus:border-atlas-teal font-mono"
            />
          </div>

          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            aria-label="Filter by region"
            className="bg-atlas-elevated border border-atlas-border rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-atlas-teal"
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
            className="bg-atlas-elevated border border-atlas-border rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-atlas-teal"
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
            className="bg-atlas-elevated border border-atlas-border rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-atlas-teal"
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
              <div key={i} className="h-56 bg-atlas-surface border border-atlas-border rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Target Catalog List */}
            <div className="lg:col-span-5 space-y-3">
              <div className="flex items-center justify-between text-xs font-mono text-atlas-muted px-1">
                <span>
                  Showing <strong className="text-white">{filteredTargets.length}</strong> of {targets.length} targets
                </span>
                {compareIds.length > 0 && (
                  <button
                    onClick={() => setCompareIds([])}
                    className="text-atlas-orange hover:underline"
                  >
                    Clear Compare ({compareIds.length})
                  </button>
                )}
              </div>

              {filteredTargets.length === 0 ? (
                <div className="bg-atlas-surface border border-atlas-border rounded-2xl p-8 text-center text-sm font-mono text-atlas-muted">
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
                        className={`cursor-pointer rounded-2xl p-4 border transition-all ${
                          isSelected
                            ? "bg-atlas-elevated border-atlas-orange shadow-lg shadow-atlas-orange/10"
                            : "bg-atlas-surface border border-atlas-border hover:border-atlas-border/80"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <div className="text-[11px] font-mono text-atlas-teal uppercase tracking-wider">
                              {tgt.region || "Mars"} · {tgt.category}
                            </div>
                            <h3 className="text-sm font-bold font-display text-white mt-0.5">{tgt.name}</h3>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                              tgt.scientificValue === "high"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : tgt.scientificValue === "medium"
                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                : "bg-atlas-surface border border-atlas-border text-atlas-muted"
                            }`}
                          >
                            {tgt.scientificValue}
                          </span>
                        </div>

                        <p className="text-xs text-atlas-muted line-clamp-2 mb-3 leading-relaxed">{tgt.description}</p>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] pt-2 border-t border-atlas-border">
                          <div className="flex items-center gap-1.5">
                            <span className={`px-2 py-0.5 rounded border text-[10px] font-mono ${evidenceBadge(tgt.evidenceStatus)}`}>
                              {(tgt.evidenceStatus || "orbital_only").replace(/_/g, " ")}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-atlas-elevated border border-atlas-border text-[10px] font-mono text-atlas-muted">
                              {tgt.provenanceClassification || "BENCHMARK"}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCompare(tgt.id);
                            }}
                            className={`px-2 py-0.5 rounded text-[10px] font-mono border flex items-center gap-1 transition ${
                              isCompared
                                ? "bg-purple-500/20 border-purple-400 text-purple-300"
                                : "bg-atlas-elevated border-atlas-border text-atlas-muted hover:text-white"
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
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-atlas-border pb-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-atlas-muted mb-1">
                        <span className="text-atlas-teal">{activeTarget.region || "Mars"}</span>
                        <span>•</span>
                        <span>
                          {activeTarget.coordinate.latitude.toFixed(3)}°N, {activeTarget.coordinate.longitude.toFixed(3)}°E
                        </span>
                        <span>•</span>
                        <span>{activeTarget.associatedFormation || activeTarget.category}</span>
                      </div>
                      <h2 className="text-xl font-bold font-display text-white">{activeTarget.name}</h2>
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
                        className="px-3.5 py-1.5 rounded-xl border border-atlas-border bg-atlas-elevated hover:bg-atlas-surface text-xs font-mono text-atlas-teal flex items-center gap-1.5 transition"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        Plot on Map
                      </button>
                      <button
                        onClick={() => handleRunFullInvestigation(activeTarget)}
                        disabled={isEvaluating}
                        className="px-4 py-1.5 rounded-xl bg-atlas-orange hover:bg-atlas-orange-hover disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-md shadow-atlas-orange/20"
                      >
                        <Sparkles className="w-3.5 h-3.5 fill-white" />
                        {isEvaluating ? "Evaluating…" : "Investigate Target"}
                      </button>
                    </div>
                  </div>

                  <p className="text-sm text-atlas-text leading-relaxed">{activeTarget.description}</p>

                  {/* Evidence, Samples & Missing Evidence Disclosure */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-atlas-elevated border border-atlas-border rounded-xl p-4 space-y-2">
                      <div className="text-[11px] font-mono uppercase text-atlas-muted">
                        Available Samples &amp; Source
                      </div>
                      <div className="text-xs font-mono text-atlas-text">{activeTarget.dataSource}</div>
                      {activeTarget.potentialSamples && activeTarget.potentialSamples.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {activeTarget.potentialSamples.map((s) => (
                            <span
                              key={s}
                              className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-mono text-emerald-400"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-amber-300/90 flex items-center gap-1.5 pt-1 font-mono">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                          <span>No in-situ surface samples available (orbital reconnaissance only).</span>
                        </div>
                      )}
                    </div>

                    <div className="bg-atlas-elevated border border-atlas-border rounded-xl p-4 space-y-2">
                      <div className="text-[11px] font-mono uppercase text-amber-400 flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        Missing Evidence &amp; Uncertainty
                      </div>
                      {activeTarget.missingEvidence && activeTarget.missingEvidence.length > 0 ? (
                        <ul className="space-y-1 text-xs text-atlas-muted list-disc pl-4 font-mono">
                          {activeTarget.missingEvidence.map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs font-mono text-atlas-muted">No major observational gaps flagged for catalog scope.</p>
                      )}
                    </div>
                  </div>

                  {activeTarget.references && activeTarget.references.length > 0 && (
                    <div className="text-xs text-atlas-muted bg-atlas-elevated border border-atlas-border rounded-xl p-4">
                      <span className="font-mono uppercase text-[10px] text-atlas-muted block mb-1">
                        Published References
                      </span>
                      <ul className="space-y-0.5">
                        {activeTarget.references.map((ref, idx) => (
                          <li key={idx} className="text-atlas-text font-mono">
                            • {ref}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {evalError && (
                    <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl p-3 text-xs font-mono">
                      {evalError}
                    </div>
                  )}

                  {/* Assessment Results */}
                  {(targetEval || mineralResult || iceResult || coordAssessment) && (
                    <div className="space-y-4 border-t border-atlas-border pt-4">
                      {/* Provenance & Fallback Banner */}
                      <div
                        className={`rounded-xl p-3.5 border text-xs font-mono flex flex-col gap-1 ${
                          targetEval?.fallbackUsed
                            ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                            : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 font-bold">
                          <span>
                            {targetEval?.fallbackUsed
                              ? "Analytical Fallback Active (Local Deterministic Planetary Rules)"
                              : "External Python Science Engine Active"}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-atlas-bg border border-atlas-border">
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
                          <div className="bg-atlas-elevated border border-atlas-border rounded-xl p-4 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 font-mono">
                                <FlaskConical className="w-3.5 h-3.5" />
                                Target Evaluation
                              </span>
                              <span className="text-xs font-mono text-white font-bold">
                                Yield: {targetEval.scientific_yield_score}/100
                              </span>
                            </div>
                            <div className="text-xs font-mono text-atlas-text">
                              Epoch: <strong>{targetEval.geological_epoch}</strong> · Biosignature:{" "}
                              <strong>{targetEval.biosignature_preservation_potential}</strong> · Priority:{" "}
                              <strong>{targetEval.sample_return_priority}</strong>
                            </div>
                            <div className="text-[11px] font-mono text-atlas-muted">{targetEval.justification}</div>
                            <div className="flex flex-wrap gap-1 pt-1">
                              {targetEval.recommended_instruments.map((inst) => (
                                <span
                                  key={inst}
                                  className="px-2 py-0.5 rounded bg-atlas-surface border border-atlas-border text-[10px] font-mono text-atlas-muted"
                                >
                                  {inst}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {iceResult && (
                          <div className="bg-atlas-elevated border border-atlas-border rounded-xl p-4 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-atlas-teal flex items-center gap-1.5 font-mono">
                                <Droplets className="w-3.5 h-3.5" />
                                Subsurface Ice Stability (SHARAD/SWIM)
                              </span>
                              <span className="text-xs font-mono text-white font-bold">
                                {(iceResult.subsurface_ice_probability * 100).toFixed(0)}% est.
                              </span>
                            </div>
                            <div className="text-xs font-mono text-atlas-text">
                              Zone: <strong>{iceResult.ice_stability_zone}</strong> · ISRU:{" "}
                              <strong>{iceResult.isru_accessibility_rating}</strong>
                            </div>
                            <div className="text-[11px] font-mono text-atlas-muted">{iceResult.scientific_rationale}</div>
                          </div>
                        )}
                      </div>

                      {mineralResult && (
                        <div className="bg-atlas-elevated border border-atlas-border rounded-xl p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-purple-400 flex items-center gap-1.5 font-mono">
                              <Layers className="w-3.5 h-3.5" />
                              Mineralogy &amp; Aqueous History ({mineralResult.crism_analog_unit})
                            </span>
                            <span className="text-[11px] font-mono text-atlas-muted">{mineralResult.pH_regime}</span>
                          </div>
                          <p className="text-xs font-mono text-atlas-muted">{mineralResult.aqueous_history_implication}</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                            {mineralResult.primary_minerals.map((m, idx) => (
                              <div key={idx} className="bg-atlas-surface border border-atlas-border rounded-lg p-2 text-[11px]">
                                <div className="font-bold text-white">
                                  {m.name} <span className="text-atlas-muted font-normal">({m.category})</span>
                                </div>
                                <div className="text-atlas-muted mt-0.5">{m.astrobiological_relevance}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {objectiveEval && (
                        <div className="bg-atlas-elevated border border-atlas-border rounded-xl p-4 text-xs font-mono space-y-1">
                          <div className="flex items-center justify-between font-bold text-white">
                            <span>Objective Alignment ({objectiveEval.objective_id})</span>
                            <span className="text-atlas-teal">
                              MEPAG {objectiveEval.mepag_alignment_score}% · Diversity {objectiveEval.scientific_diversity_score}%
                            </span>
                          </div>
                          <p className="text-atlas-muted">{objectiveEval.evaluation_summary}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Assign Target to Mission Plan (Persisted & Guarded) */}
                  <form
                    onSubmit={handleAssignToMission}
                    className="bg-atlas-elevated border border-atlas-border rounded-2xl p-5 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5 font-mono">
                        <PlusCircle className="w-4 h-4 text-atlas-orange" />
                        Add Target to Mission Plan (Audited)
                      </span>
                      <span className="text-[10px] font-mono text-atlas-muted">
                        Approved/locked missions are protected
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-mono text-atlas-muted mb-1">Mission Plan</label>
                        {missions.length > 0 ? (
                          <select
                            value={selectedMissionId}
                            onChange={(e) => setSelectedMissionId(e.target.value)}
                            aria-label="Select mission plan"
                            className="w-full bg-atlas-surface border border-atlas-border rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-atlas-teal"
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
                            className="w-full bg-atlas-surface border border-atlas-border rounded-xl px-3 py-2 text-xs font-mono text-white"
                          />
                        )}
                      </div>

                      <div>
                        <label className="block text-[11px] font-mono text-atlas-muted mb-1">MEPAG Objective</label>
                        <select
                          value={selectedObjectiveId}
                          onChange={(e) => setSelectedObjectiveId(e.target.value as ScienceObjectiveId)}
                          aria-label="Select science objective"
                          className="w-full bg-atlas-surface border border-atlas-border rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-atlas-teal"
                        >
                          {OBJECTIVE_OPTIONS.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                      <input
                        type="text"
                        value={assignmentRationale}
                        onChange={(e) => setAssignmentRationale(e.target.value)}
                        placeholder="Scientific rationale for mission inclusion..."
                        className="flex-1 bg-atlas-surface border border-atlas-border rounded-xl px-3 py-2 text-xs font-mono text-white placeholder:text-atlas-muted focus:outline-none focus:border-atlas-teal"
                      />
                      <button
                        type="submit"
                        disabled={isAssigning}
                        className="px-5 py-2 rounded-xl bg-atlas-orange hover:bg-atlas-orange-hover disabled:opacity-50 text-white text-xs font-bold transition shrink-0 shadow-md shadow-atlas-orange/20"
                      >
                        {isAssigning ? "Saving…" : "Assign Target"}
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
                <div className="bg-atlas-surface border border-purple-500/40 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-purple-300 flex items-center gap-2 font-display">
                      <GitCompare className="w-4 h-4" />
                      Target Comparison ({comparedTargets.length} selected)
                    </h3>
                    <button
                      onClick={() => setCompareIds([])}
                      className="text-xs font-mono text-atlas-muted hover:text-white"
                    >
                      Close
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left font-mono">
                      <thead>
                        <tr className="border-b border-atlas-border text-atlas-muted">
                          <th className="py-2.5 pr-3 font-semibold">Target</th>
                          <th className="py-2.5 pr-3 font-semibold">Region</th>
                          <th className="py-2.5 pr-3 font-semibold">Category</th>
                          <th className="py-2.5 pr-3 font-semibold">Value</th>
                          <th className="py-2.5 pr-3 font-semibold">Evidence</th>
                          <th className="py-2.5 font-semibold">Missing Evidence</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-atlas-border">
                        {comparedTargets.map((t) => (
                          <tr key={t.id} className="hover:bg-atlas-elevated/40">
                            <td className="py-2.5 pr-3 font-bold text-white font-sans">{t.name}</td>
                            <td className="py-2.5 pr-3 text-atlas-muted">{t.region || "Mars"}</td>
                            <td className="py-2.5 pr-3 uppercase text-[11px] text-atlas-teal">{t.category}</td>
                            <td className="py-2.5 pr-3 uppercase font-semibold text-atlas-orange">{t.scientificValue}</td>
                            <td className="py-2.5 pr-3 text-[11px] text-atlas-muted">{t.evidenceStatus || "orbital_only"}</td>
                            <td className="py-2.5 text-atlas-muted font-sans text-[11px]">
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
        <div className="bg-atlas-surface border border-atlas-border rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold font-display text-white">
                Persisted Scientific Target Assignments &amp; Decision Traceability
              </h3>
              <p className="text-xs text-atlas-muted mt-0.5">
                Every target-to-mission assignment is persisted with an audit hash and recorded in Mission Replay.
              </p>
            </div>
            <button
              onClick={() => navigate("/replay")}
              className="text-xs font-mono text-atlas-teal hover:underline flex items-center gap-1"
            >
              View in Replay <ExternalLink className="w-3 h-3" />
            </button>
          </div>
          {decisions.length === 0 ? (
            <div className="text-xs font-mono text-atlas-muted py-4 border border-dashed border-atlas-border rounded-xl text-center">
              No scientific target assignments persisted yet. Assign a target above to create an audited decision record.
            </div>
          ) : (
            <div className="space-y-2">
              {decisions.slice(0, 6).map((d) => (
                <div
                  key={d.id}
                  className="bg-atlas-elevated border border-atlas-border rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono"
                >
                  <div>
                    <span className="font-bold text-white">{d.targetName}</span>
                    <span className="text-atlas-muted mx-2">→</span>
                    <span className="text-atlas-teal">{d.missionId}</span>
                    <div className="text-[11px] text-atlas-muted mt-0.5 font-sans">{d.rationale}</div>
                  </div>
                  <div className="text-[10px] text-atlas-muted shrink-0 text-right">
                    <div>Hash: {d.auditBlockHash.slice(0, 14)}…</div>
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
