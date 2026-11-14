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
import { api } from "../services/api.js";
import {
  Navigation,
  Plus,
  Trash2,
  Clock,
  Send,
  Cpu,
  ShieldCheck,
  X,
  MapPin,
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
  onClose?: () => void;
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
  onClose,
}) => {
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [selectedScienceTargetId, setSelectedScienceTargetId] = useState<string>("");
  const [isReroutingSafe, setIsReroutingSafe] = useState<boolean>(false);
  const [hazardAvoidanceMsg, setHazardAvoidanceMsg] = useState<string | null>(null);

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

  const handleApplyHazardAvoidance = async () => {
    if (points.length < 2) return;
    try {
      setIsReroutingSafe(true);
      setHazardAvoidanceMsg(null);
      const start = points[0].coordinate;
      const dest = points[points.length - 1].coordinate;

      const res = await api.getSafeHazardAvoidanceRoute(
        start.latitude,
        start.longitude,
        dest.latitude,
        dest.longitude,
        150
      );

      if (res && res.routePoints && res.routePoints.length > 2) {
        const intermediatePoints = res.routePoints.slice(1, -1);
        const newPts: RoutePoint[] = [
          points[0],
          ...intermediatePoints.map((pt: MarsCoordinate, idx: number) => ({
            id: `pt-detour-${idx + 1}`,
            coordinate: pt,
            type: "waypoint" as const,
            label: `A* Detour Pass ${idx + 1}`,
          })),
          points[points.length - 1],
        ];
        setPoints(newPts);
        await onGenerateRoute(newPts);
        setHazardAvoidanceMsg(
          `A* Safe Reroute: Bypassed ${res.hazardsBypassed?.length || 1} obstacle envelope(s) with >=100m buffer.`
        );
      } else {
        setHazardAvoidanceMsg("Direct path verified safe: Zero scarp or obstacle conflicts detected.");
      }
    } catch (err: any) {
      setHazardAvoidanceMsg(err?.message || "Failed to compute hazard avoidance path.");
    } finally {
      setIsReroutingSafe(false);
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
    <aside
      aria-label="EVA Route Planner"
      className="w-full sm:w-[420px] md:w-[440px] max-w-full h-full bg-atlas-surface border-l border-atlas-border flex flex-col z-30 shadow-2xl overflow-hidden font-mono text-xs"
    >
      {/* Header */}
      <div className="p-4 border-b border-atlas-border bg-atlas-elevated/70 flex items-center justify-between shrink-0">
        <div className="space-y-1">
          <div className="text-[11px] text-atlas-muted tracking-wider flex items-center space-x-1.5 uppercase font-medium">
            <Navigation className="w-3.5 h-3.5 text-atlas-accent" />
            <span>Operational Navigation</span>
          </div>
          <h2 className="text-base font-semibold text-atlas-text font-display">Route Planner</h2>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onTogglePickMode(!isPickingOnMap)}
            className={`px-3 py-1.5 text-xs font-semibold border transition-all ${
              isPickingOnMap
                ? "bg-atlas-accent text-white border-atlas-accent ring-2 ring-atlas-accent/40 animate-pulse"
                : "bg-atlas-surface hover:bg-atlas-elevated text-atlas-text border-atlas-border"
            }`}
            title="Click to place waypoints directly on the Mars surface"
          >
            <span className="flex items-center space-x-1">
              <MapPin className="w-3.5 h-3.5" />
              <span>{isPickingOnMap ? "Selecting..." : "+ Surface Pin"}</span>
            </span>
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-atlas-elevated text-atlas-muted hover:text-atlas-text border border-transparent hover:border-atlas-border transition-colors"
              title="Close Route Planner"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 5-Step Vertical Workflow Flow */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Step 1: Select Geological Science Target */}
        <section className="bg-atlas-bg/60 border border-atlas-border p-3.5 space-y-3">
          <div className="flex items-center justify-between border-b border-atlas-border pb-2">
            <div className="flex items-center space-x-2">
              <span className="w-5 h-5 rounded-full bg-atlas-accent/20 text-atlas-accent flex items-center justify-center text-[10px] font-bold">
                01
              </span>
              <span className="text-xs font-bold text-atlas-text uppercase tracking-wide">
                Select Target
              </span>
            </div>
            <span className="text-[10px] text-atlas-muted">CRISM Outcrops</span>
          </div>

          <div className="flex space-x-2">
            <select
              value={selectedScienceTargetId}
              onChange={(e) => setSelectedScienceTargetId(e.target.value)}
              className="flex-1 bg-atlas-surface border border-atlas-border text-atlas-text text-xs p-2 focus:outline-none focus:border-atlas-accent"
            >
              <option value="">Choose Science Outcrop...</option>
              {scienceTargets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.category})
                </option>
              ))}
            </select>

            <button
              onClick={handleAddScienceTarget}
              disabled={!selectedScienceTargetId}
              className="px-3.5 bg-atlas-accent hover:bg-atlas-accent-hover text-white font-bold disabled:opacity-30 transition-colors flex items-center justify-center"
              title="Add Target to Traverse"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </section>

        {/* Step 2: Define Traverse Sequence */}
        <section className="bg-atlas-bg/60 border border-atlas-border p-3.5 space-y-3">
          <div className="flex items-center justify-between border-b border-atlas-border pb-2">
            <div className="flex items-center space-x-2">
              <span className="w-5 h-5 rounded-full bg-atlas-accent/20 text-atlas-accent flex items-center justify-center text-[10px] font-bold">
                02
              </span>
              <span className="text-xs font-bold text-atlas-text uppercase tracking-wide">
                Define Traverse
              </span>
            </div>
            <span className="text-[10px] text-atlas-muted">
              {points.length} Pts · {scienceStopsCount} Science
            </span>
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
                      ? "bg-atlas-surface border-atlas-teal/50"
                      : isDest
                      ? "bg-atlas-surface border-atlas-accent/50"
                      : isScience
                      ? "bg-atlas-surface border-atlas-blue/50"
                      : "bg-atlas-surface border-atlas-border"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`w-5 h-5 flex items-center justify-center text-[10px] font-bold rounded-sm ${
                          isStart
                            ? "bg-atlas-teal text-white"
                            : isDest
                            ? "bg-atlas-accent text-white"
                            : isScience
                            ? "bg-atlas-blue text-white"
                            : "bg-atlas-elevated text-atlas-text border border-atlas-border"
                        }`}
                      >
                        {isStart ? "S" : isDest ? "D" : `W${index}`}
                      </span>
                      <span className="font-semibold text-atlas-text truncate max-w-[210px] text-xs">
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
        </section>

        {/* Step 3: Validate Science & Pareto Optimizer */}
        {objectives.length > 0 && onSelectObjective && onRunCopilotOptimizer && (
          <section className="bg-atlas-bg/60 border border-atlas-border p-3.5 space-y-3">
            <div className="flex items-center justify-between border-b border-atlas-border pb-2">
              <div className="flex items-center space-x-2">
                <span className="w-5 h-5 rounded-full bg-atlas-accent/20 text-atlas-accent flex items-center justify-center text-[10px] font-bold">
                  03
                </span>
                <span className="text-xs font-bold text-atlas-text uppercase tracking-wide">
                  Validate Science
                </span>
              </div>
              <span className="text-[10px] text-atlas-teal font-mono">Pareto Copilot</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] text-atlas-muted block">Primary Science Objective:</label>
              <select
                value={selectedObjectiveId}
                onChange={(e) => onSelectObjective(e.target.value as ScienceObjectiveId)}
                className="w-full bg-atlas-surface border border-atlas-border text-atlas-text text-xs p-2 focus:outline-none focus:border-atlas-accent"
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
              className="w-full py-2.5 bg-atlas-elevated hover:bg-atlas-surface text-atlas-text border border-atlas-border font-bold flex items-center justify-center space-x-2 text-xs transition-all disabled:opacity-40 shadow-sm"
            >
              <Cpu className="w-3.5 h-3.5 text-atlas-teal" />
              <span>{isOptimizing ? "Synthesizing Pareto Frontiers..." : "Synthesize Pareto Candidates"}</span>
            </button>

            {candidates.length > 0 && onSelectCandidate && (
              <div className="space-y-1.5 pt-2 border-t border-atlas-border">
                <div className="text-[10px] text-atlas-muted uppercase flex items-center justify-between">
                  <span>Candidate Route Profiles:</span>
                  <span className="text-atlas-muted">Risk-Adjusted</span>
                </div>

                <div className="space-y-1.5">
                  {candidates.map((cand) => {
                    const isSelected = cand.id === selectedCandidateId;
                    const isPareto = cand.multiObjectiveScore?.isParetoEfficient;
                    const riskAdj = cand.riskAdjustedScore ?? cand.overallScore;

                    return (
                      <div
                        key={cand.id}
                        onClick={() => onSelectCandidate(cand)}
                        className={`p-2.5 border cursor-pointer transition-all ${
                          isSelected
                            ? "bg-atlas-elevated border-atlas-accent shadow-md"
                            : "bg-atlas-surface/80 border-atlas-border hover:border-atlas-border-light"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-atlas-text text-xs capitalize">
                            {cand.profileType.replace("_", " ")}
                          </span>
                          <div className="flex items-center space-x-1.5">
                            {cand.hardConstraintViolations && cand.hardConstraintViolations.length > 0 ? (
                              <span
                                className="px-1.5 py-0.5 text-[9px] font-bold bg-atlas-surface text-atlas-accent border border-atlas-accent uppercase"
                                title={cand.hardConstraintViolations.join(", ")}
                              >
                                Rejected
                              </span>
                            ) : isPareto ? (
                              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-atlas-elevated text-atlas-amber border border-atlas-border uppercase">
                                Pareto
                              </span>
                            ) : null}
                            <span className="font-bold text-atlas-accent text-xs">
                              {riskAdj} pts
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-1 text-[10px] text-atlas-muted mt-2 pt-1.5 border-t border-atlas-border">
                          <div>Dist: <b className="text-atlas-text">{cand.distanceKm.toFixed(1)}k</b></div>
                          <div>Dur: <b className="text-atlas-text">{cand.estimatedDurationMin}m</b></div>
                          <div>Safe: <b className="text-atlas-teal">{cand.safetyScore}</b></div>
                          <div>Sci: <b className="text-atlas-blue">{cand.scienceScore}</b></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Step 4: Build Mission Plan & Pathfinding */}
        <section className="bg-atlas-bg/60 border border-atlas-border p-3.5 space-y-3">
          <div className="flex items-center justify-between border-b border-atlas-border pb-2">
            <div className="flex items-center space-x-2">
              <span className="w-5 h-5 rounded-full bg-atlas-accent/20 text-atlas-accent flex items-center justify-center text-[10px] font-bold">
                04
              </span>
              <span className="text-xs font-bold text-atlas-text uppercase tracking-wide">
                Build Mission Plan
              </span>
            </div>
            <span className="text-[10px] text-atlas-muted">A* Pathfinding</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleGenerate}
              disabled={isGenerating || points.length < 2}
              className="w-full py-2.5 bg-atlas-surface hover:bg-atlas-elevated text-atlas-text border border-atlas-border font-bold flex items-center justify-center space-x-1.5 transition-all disabled:opacity-40 shadow-sm text-xs"
            >
              <Navigation className="w-3.5 h-3.5 text-atlas-accent" />
              <span>{isGenerating ? "Evaluating..." : "Custom Route"}</span>
            </button>

            <button
              onClick={handleApplyHazardAvoidance}
              disabled={isReroutingSafe || points.length < 2}
              className="w-full py-2.5 bg-atlas-surface hover:bg-atlas-elevated text-atlas-text border border-atlas-border hover:border-atlas-teal font-bold flex items-center justify-center space-x-1.5 transition-all disabled:opacity-40 shadow-sm text-xs"
              title="Compute A* Terrain Detour to bypass scarps, boulder fields, and steep inclines"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-atlas-teal" />
              <span>{isReroutingSafe ? "Routing A*..." : "Avoid Hazards (A*)"}</span>
            </button>
          </div>

          {hazardAvoidanceMsg && (
            <div className="p-2.5 bg-atlas-elevated border border-atlas-border text-[11px] font-mono text-atlas-teal flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-atlas-teal shrink-0" />
              <span>{hazardAvoidanceMsg}</span>
            </div>
          )}
        </section>

        {/* Step 5: Execute & Inspect Mission Plan */}
        {activeRoute && (
          <section className="bg-atlas-surface border border-atlas-border p-4 space-y-3.5 shadow-xl">
            <div className="flex items-center justify-between border-b border-atlas-border pb-2.5">
              <div className="flex items-center space-x-2">
                <span className="w-5 h-5 rounded-full bg-atlas-accent text-white flex items-center justify-center text-[10px] font-bold">
                  05
                </span>
                <span className="text-xs font-bold text-atlas-text uppercase tracking-wide">
                  Execute / Export
                </span>
              </div>
              <span className="text-[10px] text-atlas-teal uppercase font-bold px-2 py-0.5 bg-atlas-teal/10 border border-atlas-teal/30">
                {activeRoute.overallDifficulty} Terrain
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 bg-atlas-elevated border border-atlas-border space-y-1">
                <div className="text-[10px] text-atlas-muted">Total Distance</div>
                <div className="font-bold text-atlas-text text-base font-mono">
                  {activeRoute.totalDistanceKm} km
                </div>
              </div>

              <div className="p-2.5 bg-atlas-elevated border border-atlas-border space-y-1">
                <div className="text-[10px] text-atlas-muted flex items-center space-x-1">
                  <Clock className="w-3 h-3 text-atlas-amber" />
                  <span>Duration</span>
                </div>
                <div className="font-bold text-atlas-text text-base font-mono">
                  {activeRoute.estimatedDurationMinutes} min
                </div>
              </div>

              <div className="p-2.5 bg-atlas-elevated border border-atlas-border space-y-1">
                <div className="text-[10px] text-atlas-muted">Avg Slope</div>
                <div className="font-bold text-atlas-text font-mono">{avgSlope}°</div>
              </div>

              <div className="p-2.5 bg-atlas-elevated border border-atlas-border space-y-1">
                <div className="text-[10px] text-atlas-muted">Max Incline</div>
                <div className="font-bold text-atlas-amber font-mono">{activeRoute.maxSlopeDegrees}°</div>
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
              className="w-full py-3 bg-atlas-accent hover:bg-atlas-accent-hover text-white font-bold flex items-center justify-center space-x-2 transition-all shadow-lg text-sm tracking-wide"
            >
              <Send className="w-4 h-4" />
              <span>Assess EVA & Mission Score</span>
            </button>
          </section>
        )}
      </div>
    </aside>
  );
};
