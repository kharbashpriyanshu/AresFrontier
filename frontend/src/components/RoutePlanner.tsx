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
  Send,
  Target,
  Sparkles,
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
    if (points.length <= 2) return;
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
    <div className="w-96 max-w-full h-full bg-atlas-surface border-l border-atlas-border flex flex-col z-30 shadow-2xl overflow-hidden font-mono text-xs transition-colors">
      {/* Header */}
      <div className="p-4 border-b border-atlas-border bg-atlas-elevated/60 flex items-center justify-between">
        <div className="space-y-1">
          <div className="text-[10px] text-atlas-muted tracking-wider flex items-center space-x-1.5 uppercase">
            <Navigation className="w-3.5 h-3.5 text-atlas-blue" />
            <span>EVA Traverse Route Planner</span>
          </div>
          <h2 className="text-sm font-bold text-atlas-text font-display">Marswalk Navigator</h2>
        </div>
        <button
          onClick={() => onTogglePickMode(!isPickingOnMap)}
          className={`px-3 py-1.5 text-[11px] font-semibold border transition-colors ${
            isPickingOnMap
              ? "bg-atlas-accent text-white border-atlas-accent animate-pulse"
              : "bg-atlas-elevated hover:bg-atlas-surface text-atlas-text border-atlas-border"
          }`}
          title="Click to place waypoints on the Mars surface"
        >
          {isPickingOnMap ? "Picking..." : "+ Map Pin"}
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Waypoints Sequence List */}
        <div className="space-y-2">
          <div className="text-[10px] text-atlas-muted uppercase tracking-wider flex items-center justify-between">
            <span>Traverse Sequence ({points.length} waypoints, {scienceStopsCount} science)</span>
            <span className="text-atlas-muted">Tobler Mars Model</span>
          </div>

          <div className="space-y-2">
            {points.map((point, index) => {
              const isStart = index === 0;
              const isDest = index === points.length - 1;
              const isScience = point.type === "science";

              return (
                <div
                  key={point.id}
                  className={`p-2.5 border transition-all ${
                    isStart
                      ? "bg-atlas-elevated border-atlas-teal/50"
                      : isDest
                      ? "bg-atlas-elevated border-atlas-accent/50"
                      : isScience
                      ? "bg-atlas-elevated border-atlas-blue/50"
                      : "bg-atlas-elevated border-atlas-border"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`w-5 h-5 flex items-center justify-center text-[10px] font-bold ${
                          isStart
                            ? "bg-atlas-teal text-white"
                            : isDest
                            ? "bg-atlas-accent text-white"
                            : isScience
                            ? "bg-atlas-blue text-white"
                            : "bg-atlas-surface text-atlas-text border border-atlas-border"
                        }`}
                      >
                        {isStart ? "S" : isDest ? "D" : `W${index}`}
                      </span>
                      <span className="font-semibold text-atlas-text truncate max-w-[190px]">
                        {point.label || `Waypoint ${index}`}
                      </span>
                    </div>

                    {!isStart && !isDest && (
                      <button
                        onClick={() => handleRemovePoint(index)}
                        className="text-atlas-muted hover:text-atlas-red p-1 transition-colors"
                        title="Remove Waypoint"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="text-[10px] text-atlas-muted mt-1.5 flex items-center justify-between">
                    <span>{formatMarsCoordinate(point.coordinate)}</span>
                    <span className="capitalize text-atlas-muted">{point.type}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Add Science Stop Selector */}
        <div className="p-3 bg-atlas-elevated border border-atlas-border space-y-2">
          <div className="text-[10px] text-atlas-muted uppercase tracking-wider flex items-center space-x-1">
            <Target className="w-3.5 h-3.5 text-atlas-accent" />
            <span>Add Geological Target</span>
          </div>

          <div className="flex space-x-2">
            <select
              value={selectedScienceTargetId}
              onChange={(e) => setSelectedScienceTargetId(e.target.value)}
              className="flex-1 bg-atlas-surface border border-atlas-border text-atlas-text text-xs p-1.5 focus:outline-none focus:border-atlas-accent"
            >
              <option value="">Select Science Outcrop...</option>
              {scienceTargets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.category})
                </option>
              ))}
            </select>

            <button
              onClick={handleAddScienceTarget}
              disabled={!selectedScienceTargetId}
              className="px-3 bg-atlas-accent hover:bg-atlas-accent-dark text-white font-bold disabled:opacity-40 transition-colors"
              title="Add Target to Route"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Phase 2 Copilot Multi-Objective Optimizer & Science Objective */}
        {objectives.length > 0 && onSelectObjective && onRunCopilotOptimizer && (
          <div className="p-3 bg-atlas-elevated border border-atlas-border space-y-2.5">
            <div className="flex items-center justify-between border-b border-atlas-border pb-1.5">
              <div className="flex items-center space-x-1.5 text-atlas-text font-bold text-[11px]">
                <Sparkles className="w-3.5 h-3.5 text-atlas-blue" />
                <span>Mission Copilot Optimizer</span>
              </div>
              <span className="text-[9px] text-atlas-teal font-mono uppercase">Multi-Criteria</span>
            </div>

            <div className="space-y-1">
              <div className="text-[10px] text-atlas-muted">Primary Science Objective:</div>
              <select
                value={selectedObjectiveId}
                onChange={(e) => onSelectObjective(e.target.value as ScienceObjectiveId)}
                className="w-full bg-atlas-surface border border-atlas-border text-atlas-text text-xs p-1.5 focus:outline-none focus:border-atlas-accent"
              >
                {objectives.map((obj) => (
                  <option key={obj.id} value={obj.id}>
                    {obj.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={onRunCopilotOptimizer}
              disabled={isOptimizing || points.length < 2}
              className="w-full py-2 bg-atlas-surface hover:bg-atlas-elevated text-atlas-text border border-atlas-border font-bold flex items-center justify-center space-x-2 text-xs transition-all disabled:opacity-40 shadow-sm"
            >
              <Cpu className="w-3.5 h-3.5 text-atlas-teal" />
              <span>{isOptimizing ? "Optimizing Pareto Candidates..." : "Synthesize Pareto Routes"}</span>
            </button>

            {/* Generated Candidates Drawer List */}
            {candidates.length > 0 && onSelectCandidate && (
              <div className="space-y-1.5 pt-2 border-t border-atlas-border">
                <div className="text-[10px] text-atlas-muted uppercase flex items-center justify-between">
                  <span>Candidate Route Profiles:</span>
                  <span className="text-atlas-muted">Risk-Adjusted</span>
                </div>

                <div className="space-y-1">
                  {candidates.map((cand) => {
                    const isSelected = cand.id === selectedCandidateId;
                    const isPareto = cand.multiObjectiveScore?.isParetoEfficient;
                    const riskAdj = cand.riskAdjustedScore ?? cand.overallScore;

                    return (
                      <div
                        key={cand.id}
                        onClick={() => onSelectCandidate(cand)}
                        className={`p-2 border cursor-pointer transition-all ${
                          isSelected
                            ? "bg-atlas-surface border-atlas-accent shadow-md"
                            : "bg-atlas-surface/60 border-atlas-border hover:border-atlas-border-light"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-atlas-text text-[11px] capitalize">
                            {cand.profileType.replace("_", " ")}
                          </span>
                          <div className="flex items-center space-x-1.5">
                            {cand.hardConstraintViolations && cand.hardConstraintViolations.length > 0 ? (
                              <span className="px-1 py-0.2 text-[8px] font-bold bg-atlas-surface text-atlas-accent border border-atlas-accent uppercase" title={cand.hardConstraintViolations.join(", ")}>
                                Rejected
                              </span>
                            ) : isPareto ? (
                              <span className="px-1 py-0.2 text-[8px] font-bold bg-atlas-elevated text-atlas-amber border border-atlas-border uppercase">
                                Pareto
                              </span>
                            ) : null}
                            <span className="font-bold text-atlas-accent text-[11px]">
                              {riskAdj} pts
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-1 text-[9px] text-atlas-muted mt-1 pt-1 border-t border-atlas-border">
                          <div>Dist: <b className="text-atlas-text">{cand.distanceKm.toFixed(1)}k</b></div>
                          <div>Dur: <b className="text-atlas-text">{cand.estimatedDurationMin}m</b></div>
                          <div>Safe: <b className="text-atlas-teal">{cand.safetyScore}</b></div>
                          <div>Sci: <b className="text-atlas-blue">{cand.scienceScore}</b></div>
                        </div>

                        {(cand.communicationScore !== undefined || cand.projectedBatteryPercent !== undefined) && (
                          <div className="grid grid-cols-2 gap-1 text-[8px] text-atlas-muted mt-0.5 pt-0.5 border-t border-atlas-border/50">
                            <div>Comms: <b className="text-atlas-text">{cand.communicationScore ?? 80}%</b></div>
                            <div>Batt SoC: <b className="text-atlas-teal">{cand.projectedBatteryPercent ?? 85}%</b></div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Generate Route Action Button */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating || points.length < 2}
          className="w-full py-2.5 bg-atlas-surface hover:bg-atlas-elevated text-atlas-text border border-atlas-border font-bold flex items-center justify-center space-x-2 transition-all disabled:opacity-40 shadow-sm"
        >
          <Navigation className="w-4 h-4 text-atlas-accent" />
          <span>{isGenerating ? "Evaluating Terrain Grids..." : "Compute Custom Route"}</span>
        </button>

        {/* Calculated Route Summary Card */}
        {activeRoute && (
          <div className="p-3.5 bg-atlas-surface border border-atlas-border space-y-3 shadow-lg">
            <div className="flex items-center justify-between border-b border-atlas-border pb-2">
              <span className="font-display font-bold text-atlas-text">Plan Evaluation</span>
              <span className="text-[10px] text-atlas-teal uppercase font-bold">
                {activeRoute.overallDifficulty} Terrain
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2 bg-atlas-elevated border border-atlas-border space-y-0.5">
                <div className="text-[10px] text-atlas-muted">Total Distance</div>
                <div className="font-bold text-atlas-text text-sm">
                  {activeRoute.totalDistanceKm} km
                </div>
              </div>

              <div className="p-2 bg-atlas-elevated border border-atlas-border space-y-0.5">
                <div className="text-[10px] text-atlas-muted flex items-center space-x-1">
                  <Clock className="w-3 h-3 text-atlas-amber" />
                  <span>Duration</span>
                </div>
                <div className="font-bold text-atlas-text text-sm">
                  {activeRoute.estimatedDurationMinutes} min
                </div>
              </div>

              <div className="p-2 bg-atlas-elevated border border-atlas-border space-y-0.5">
                <div className="text-[10px] text-atlas-muted">Avg Slope</div>
                <div className="font-bold text-atlas-text">{avgSlope}°</div>
              </div>

              <div className="p-2 bg-atlas-elevated border border-atlas-border space-y-0.5">
                <div className="text-[10px] text-atlas-muted">Max Incline</div>
                <div className="font-bold text-atlas-amber">{activeRoute.maxSlopeDegrees}°</div>
              </div>
            </div>

            {/* Elevation Profile Mini-Chart */}
            <div className="pt-1">
              <ElevationProfileChart
                profile={activeRoute.elevationProfile}
                totalDistanceKm={activeRoute.totalDistanceKm}
                onHoverPoint={onHoverProfilePoint}
              />
            </div>

            {/* Inspect Mission CTA */}
            <button
              onClick={() => onInspectMission(activeRoute)}
              className="w-full py-2.5 bg-atlas-accent hover:bg-atlas-accent-dark text-white font-bold flex items-center justify-center space-x-2 transition-all shadow-md text-xs"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Assess EVA & Mission Score</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
