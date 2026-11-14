import React, { useState } from "react";
import {
  ScienceTarget,
  MarsRoute,
  RoutePoint,
  MarsCoordinate,
  RouteCandidate,
  ScienceObjective,
  ScienceObjectiveId,
} from "../types/index.js";
import { formatMarsCoordinate } from "../utils/marsCoordinates.js";
import { ElevationProfileChart } from "./ElevationProfileChart.js";
import {
  Navigation,
  Plus,
  Trash2,
  Clock,
  Activity,
  AlertTriangle,
  Send,
  Flag,
  Target,
  Sparkles,
  TrendingUp,
  Cpu,
} from "lucide-react";

interface RoutePlannerProps {
  scienceTargets: ScienceTarget[];
  activeRoute: MarsRoute | null;
  points: RoutePoint[];
  setPoints: React.Dispatch<React.SetStateAction<RoutePoint[]>>;
  onGenerateRoute: (points: RoutePoint[]) => Promise<void>;
  onInspectMission: (route: MarsRoute) => void;
  onTogglePickMode: (isPicking: boolean) => void;
  isPickingOnMap: boolean;
  clickedCoord: MarsCoordinate | null;
  onHoverProfilePoint?: (pt: { coordinate: MarsCoordinate } | null) => void;
  candidates?: RouteCandidate[];
  selectedCandidateId?: string;
  onSelectCandidate?: (candidate: RouteCandidate) => void;
  objectives?: ScienceObjective[];
  selectedObjectiveId?: ScienceObjectiveId;
  onSelectObjective?: (objId: ScienceObjectiveId) => void;
  onRunCopilotOptimizer?: () => Promise<void>;
  isOptimizing?: boolean;
}

export const RoutePlanner: React.FC<RoutePlannerProps> = ({
  scienceTargets,
  activeRoute,
  points,
  setPoints,
  onGenerateRoute,
  onInspectMission,
  onTogglePickMode,
  isPickingOnMap,
  onHoverProfilePoint,
  candidates = [],
  selectedCandidateId,
  onSelectCandidate,
  objectives = [],
  selectedObjectiveId,
  onSelectObjective,
  onRunCopilotOptimizer,
  isOptimizing = false,
}) => {
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [selectedScienceTargetId, setSelectedScienceTargetId] = useState<string>("");

  // Add science target as stop
  const handleAddScienceTarget = () => {
    if (!selectedScienceTargetId) return;
    const tgt = scienceTargets.find((t) => t.id === selectedScienceTargetId);
    if (!tgt) return;

    const newPoint: RoutePoint = {
      id: `pt-sci-${Date.now()}`,
      coordinate: tgt.coordinate,
      type: "science",
      label: tgt.name,
      targetId: tgt.id,
    };

    // Insert before destination point
    const updated = [...points];
    if (updated.length >= 2) {
      updated.splice(updated.length - 1, 0, newPoint);
    } else {
      updated.push(newPoint);
    }
    setPoints(updated);
    setSelectedScienceTargetId("");
  };

  const handleRemovePoint = (index: number) => {
    if (points.length <= 2) return; // Keep at least start & destination
    const updated = points.filter((_, i) => i !== index);
    setPoints(updated);
  };

  const handleGenerate = async () => {
    try {
      setIsGenerating(true);
      await onGenerateRoute(points);
    } finally {
      setIsGenerating(false);
    }
  };

  const scienceStopsCount = points.filter((p) => p.type === "science").length;
  const avgSlope =
    activeRoute && activeRoute.segments.length > 0
      ? (
          activeRoute.segments.reduce((acc, s) => acc + s.averageSlopeDegrees, 0) /
          activeRoute.segments.length
        ).toFixed(1)
      : null;

  return (
    <div className="w-96 max-w-full h-full bg-space-900 border-l border-space-800 flex flex-col z-30 shadow-2xl overflow-hidden font-mono text-xs">
      {/* Header */}
      <div className="p-4 border-b border-space-800 bg-space-950/60 flex items-center justify-between">
        <div className="space-y-1">
          <div className="text-[10px] text-slate-400 tracking-wider flex items-center space-x-1.5 uppercase">
            <Navigation className="w-3.5 h-3.5 text-telemetry-cyan" />
            <span>EVA TRAVERSE ROUTE PLANNER</span>
          </div>
          <h2 className="text-sm font-bold text-slate-100 font-sans">Marswalk Navigator</h2>
        </div>
        <button
          onClick={() => onTogglePickMode(!isPickingOnMap)}
          className={`px-2.5 py-1 rounded text-[11px] font-bold border transition-colors ${
            isPickingOnMap
              ? "bg-amber-500 text-space-950 border-amber-400 animate-pulse"
              : "bg-space-850 hover:bg-space-800 text-slate-300 border-space-700"
          }`}
          title="Click to place waypoints on the Mars surface"
        >
          {isPickingOnMap ? "PICKING..." : "+ MAP PIN"}
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Waypoints Sequence List */}
        <div className="space-y-2">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Traverse Sequence ({points.length} waypoints)</span>
            <span className="text-slate-500">Tobler Mars Model</span>
          </div>

          <div className="space-y-2">
            {points.map((pt, idx) => {
              const isStart = idx === 0;
              const isDest = idx === points.length - 1;
              const isSci = pt.type === "science";

              return (
                <div
                  key={pt.id || idx}
                  className="p-2.5 bg-space-850 rounded border border-space-800 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <div
                      className={`w-6 h-6 rounded flex items-center justify-center shrink-0 text-[10px] font-bold font-mono text-space-950 ${
                        isStart
                          ? "bg-telemetry-emerald"
                          : isDest
                          ? "bg-telemetry-rose"
                          : isSci
                          ? "bg-telemetry-cyan"
                          : "bg-amber-400"
                      }`}
                    >
                      {isStart ? "S" : isDest ? "D" : `W${idx}`}
                    </div>
                    <div className="truncate">
                      <div className="font-semibold text-slate-200 truncate">{pt.label || `Waypoint ${idx}`}</div>
                      <div className="text-[10px] text-slate-400">{formatMarsCoordinate(pt.coordinate)}</div>
                    </div>
                  </div>

                  {!isStart && !isDest && (
                    <button
                      onClick={() => handleRemovePoint(idx)}
                      className="text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-space-800"
                      title="Remove Waypoint"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Add Science Stop Selector */}
        <div className="p-3 bg-space-850/80 rounded border border-space-800 space-y-2">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
            <Target className="w-3.5 h-3.5 text-telemetry-cyan" />
            <span>Insert Science Target Stop</span>
          </div>
          <div className="flex space-x-2">
            <select
              value={selectedScienceTargetId}
              onChange={(e) => setSelectedScienceTargetId(e.target.value)}
              className="flex-1 bg-space-900 border border-space-700 rounded px-2.5 py-1.5 text-slate-200 text-xs focus:ring-1 focus:ring-mars-accent focus:outline-none"
            >
              <option value="">Select Science Outcrop...</option>
              {scienceTargets.map((tgt) => (
                <option key={tgt.id} value={tgt.id}>
                  {tgt.name} ({tgt.scientificValue.toUpperCase()})
                </option>
              ))}
            </select>
            <button
              onClick={handleAddScienceTarget}
              disabled={!selectedScienceTargetId}
              className="px-3 py-1.5 bg-space-800 hover:bg-space-700 disabled:opacity-50 text-slate-200 rounded border border-space-700 font-semibold flex items-center space-x-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>ADD</span>
            </button>
          </div>
        </div>

        {/* Mission Intelligence & Multi-Candidate Optimizer (Phase 2) */}
        <div className="p-3 bg-space-950/70 border border-space-800 rounded space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="text-[10px] text-telemetry-cyan uppercase tracking-wider flex items-center space-x-1.5 font-bold">
              <Cpu className="w-3.5 h-3.5" />
              <span>Mission Intelligence Engine</span>
            </div>
            <span className="text-[9px] bg-space-800 text-slate-400 px-1.5 py-0.5 rounded border border-space-700">
              MEPAG Aligned
            </span>
          </div>

          {/* Science Objective Selector */}
          {objectives.length > 0 && onSelectObjective && (
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 uppercase">Science Exploration Goal:</label>
              <select
                value={selectedObjectiveId || "ANCIENT_WATER_ACTIVITY"}
                onChange={(e) => onSelectObjective(e.target.value as ScienceObjectiveId)}
                className="w-full bg-space-900 border border-space-700 rounded px-2 py-1 text-slate-200 text-xs focus:ring-1 focus:ring-telemetry-cyan focus:outline-none truncate"
              >
                {objectives.map((obj) => (
                  <option key={obj.id} value={obj.id}>
                    {obj.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Trigger 4-Candidate Optimization */}
          {onRunCopilotOptimizer && (
            <button
              onClick={onRunCopilotOptimizer}
              disabled={isOptimizing}
              className="w-full py-1.5 px-3 bg-space-850 hover:bg-space-800 text-telemetry-cyan border border-telemetry-cyan/40 hover:border-telemetry-cyan rounded text-[11px] font-bold flex items-center justify-center space-x-1.5 transition-colors disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isOptimizing ? "SOLVING CANDIDATES..." : "EVALUATE 4 ROUTE CANDIDATES"}</span>
            </button>
          )}

          {/* Candidate Comparison Matrix */}
          {candidates.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-space-800/80">
              <div className="text-[9px] text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Select Candidate Profile</span>
                <span className="text-telemetry-emerald font-bold">{candidates.length} Available</span>
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                {candidates.map((cand) => {
                  const isSelected = selectedCandidateId === cand.id || (!selectedCandidateId && cand.profileType === "balanced");
                  return (
                    <div
                      key={cand.id}
                      onClick={() => onSelectCandidate && onSelectCandidate(cand)}
                      className={`p-2 rounded border cursor-pointer transition-all ${
                        isSelected
                          ? "bg-space-800 border-telemetry-cyan shadow-sm"
                          : "bg-space-900/60 border-space-800 hover:border-space-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5 flex-wrap gap-1">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                              cand.profileType === "balanced"
                                ? "bg-emerald-950 text-emerald-300 border border-emerald-500/40"
                                : cand.profileType === "safest"
                                ? "bg-cyan-950 text-cyan-300 border border-cyan-500/40"
                                : cand.profileType === "highest_science"
                                ? "bg-purple-950 text-purple-300 border border-purple-500/40"
                                : "bg-blue-950 text-blue-300 border border-blue-500/40"
                            }`}
                          >
                            {cand.profileType}
                          </span>
                          {cand.multiObjectiveScore?.isParetoEfficient && (
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-amber-950 text-amber-300 border border-amber-500/40 tracking-wider">
                              ★ PARETO
                            </span>
                          )}
                          <span className="font-bold text-slate-200 text-[11px] truncate">{cand.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-slate-100 text-[11px]">
                            {cand.riskAdjustedScore !== undefined ? cand.riskAdjustedScore : cand.overallScore}
                          </span>
                          <span className="text-[9px] text-slate-400">
                            {cand.riskAdjustedScore !== undefined ? " risk-adj" : "/100"}
                          </span>
                        </div>
                      </div>

                      <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                        <span>{cand.distanceKm.toFixed(2)} km • {cand.estimatedDurationMin} min</span>
                        <span className="text-slate-300">
                          Sci: <b className="text-telemetry-cyan">{cand.scienceScore}</b> | Safe: <b className="text-telemetry-emerald">{cand.safetyScore}</b>
                        </span>
                      </div>

                      <div className="mt-1 text-[10px] text-slate-400 italic line-clamp-1">
                        {cand.recommendationReason}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Generate Route Action Button */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating || points.length < 2}
          className="w-full py-2.5 px-4 bg-gradient-to-r from-space-800 to-space-700 hover:from-mars-rust hover:to-mars-accent text-slate-100 rounded font-bold border border-space-700 flex items-center justify-center space-x-2 transition-all disabled:opacity-50 shadow-md"
        >
          <Sparkles className="w-4 h-4 text-mars-accent" />
          <span>{isGenerating ? "CALCULATING TRAVERSE..." : "COMPUTE MOLA ROUTE"}</span>
        </button>

        {/* Generated Route Details & Profile */}
        {activeRoute && (
          <div className="space-y-3 pt-2 border-t border-space-800">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Traverse Metrics</span>
              <span className="text-telemetry-emerald font-bold">CALCULATED</span>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 bg-space-850 rounded border border-space-800 space-y-0.5">
                <div className="text-[10px] text-slate-400 flex items-center space-x-1">
                  <Flag className="w-3 h-3 text-telemetry-cyan" />
                  <span>TOTAL DISTANCE</span>
                </div>
                <div className="text-sm font-bold text-slate-100">{activeRoute.totalDistanceKm} km</div>
              </div>

              <div className="p-2.5 bg-space-850 rounded border border-space-800 space-y-0.5">
                <div className="text-[10px] text-slate-400 flex items-center space-x-1">
                  <Clock className="w-3 h-3 text-telemetry-amber" />
                  <span>EST. DURATION</span>
                </div>
                <div className="text-sm font-bold text-slate-100">{activeRoute.estimatedDurationMinutes} min</div>
              </div>

              <div className="p-2.5 bg-space-850 rounded border border-space-800 space-y-0.5">
                <div className="text-[10px] text-slate-400 flex items-center space-x-1">
                  <TrendingUp className="w-3 h-3 text-telemetry-cyan" />
                  <span>ELEV GAIN</span>
                </div>
                <div className="text-sm font-bold text-slate-100">+{activeRoute.elevationGainM} m</div>
              </div>

              <div className="p-2.5 bg-space-850 rounded border border-space-800 space-y-0.5">
                <div className="text-[10px] text-slate-400 flex items-center space-x-1">
                  <Activity className="w-3 h-3 text-telemetry-rose" />
                  <span>MAX / AVG SLOPE</span>
                </div>
                <div className="text-sm font-bold text-slate-100">
                  {activeRoute.maxSlopeDegrees}° <span className="text-[10px] text-slate-400 font-normal">/ {avgSlope}°</span>
                </div>
              </div>
            </div>

            <div className="p-2.5 bg-space-850 rounded border border-space-800 flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-[10px] text-slate-400">TERRAIN & STOPS</div>
                <div className="font-bold uppercase text-slate-200">
                  {activeRoute.overallDifficulty} • {scienceStopsCount} Science Stop{scienceStopsCount !== 1 ? "s" : ""}
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                activeRoute.overallDifficulty === "high"
                  ? "bg-rose-950/80 text-rose-300 border border-rose-500/40"
                  : activeRoute.overallDifficulty === "moderate"
                  ? "bg-amber-950/80 text-amber-300 border border-amber-500/40"
                  : "bg-emerald-950/80 text-emerald-300 border border-emerald-500/40"
              }`}>
                {activeRoute.overallDifficulty}
              </span>
            </div>

            {/* Elevation Profile Chart */}
            <ElevationProfileChart
              profile={activeRoute.elevationProfile}
              totalDistanceKm={activeRoute.totalDistanceKm}
              onHoverPoint={(pt) => {
                if (onHoverProfilePoint) onHoverProfilePoint(pt);
              }}
            />

            {/* Hazards / Warnings if any */}
            {activeRoute.maxSlopeDegrees > 15 && (
              <div className="p-2.5 rounded bg-rose-950/40 border border-rose-500/30 text-rose-300 text-[11px] flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Caution: Traverse contains steep sections exceeding 15° slope angle.</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Footer */}
      {activeRoute && (
        <div className="p-4 border-t border-space-800 bg-space-950/80">
          <button
            onClick={() => onInspectMission(activeRoute)}
            className="w-full py-2.5 px-4 bg-gradient-to-r from-mars-rust to-mars-accent hover:from-mars-accent hover:to-orange-500 text-white rounded font-bold flex items-center justify-center space-x-2 shadow-lg shadow-mars-rust/30 transition-all text-xs"
          >
            <Send className="w-4 h-4" />
            <span>ASSESS EVA & MISSION SCORE</span>
          </button>
        </div>
      )}
    </div>
  );
};
