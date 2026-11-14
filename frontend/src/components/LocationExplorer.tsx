import React from "react";
import { LocationData, ScienceTarget } from "../types/index.js";
import { formatMarsCoordinate } from "../utils/marsCoordinates.js";
import { getMepagGoalForCategory } from "../utils/mepag.js";
import {
  X,
  Compass,
  Mountain,
  Layers,
  Activity,
  AlertTriangle,
  CheckCircle,
  FileText,
  Navigation,
  Flag,
  Target,
  Plus,
} from "lucide-react";

interface LocationExplorerProps {
  location: LocationData | null;
  onClose: () => void;
  onSetStart: (location: LocationData) => void;
  onSetDestination: (location: LocationData) => void;
  onAddScienceStop: (target: ScienceTarget | LocationData) => void;
  onPlanMission: (location: LocationData) => void;
}

export const LocationExplorer: React.FC<LocationExplorerProps> = ({
  location,
  onClose,
  onSetStart,
  onSetDestination,
  onAddScienceStop,
  onPlanMission,
}) => {
  if (!location) return null;

  const getRatingBadge = (rating: LocationData["suitability"]["evaRating"]) => {
    switch (rating) {
      case "optimal":
        return {
          bg: "bg-atlas-elevated border-atlas-teal text-atlas-teal",
          icon: CheckCircle,
          label: "EVA Optimal",
        };
      case "acceptable":
        return {
          bg: "bg-atlas-elevated border-atlas-blue text-atlas-blue",
          icon: CheckCircle,
          label: "EVA Acceptable",
        };
      case "restricted":
        return {
          bg: "bg-atlas-elevated border-atlas-amber text-atlas-amber",
          icon: AlertTriangle,
          label: "EVA Restricted",
        };
      case "hazardous":
        return {
          bg: "bg-atlas-elevated border-atlas-red text-atlas-red",
          icon: AlertTriangle,
          label: "EVA Hazardous",
        };
    }
  };

  const badge = getRatingBadge(location.suitability.evaRating);
  const BadgeIcon = badge.icon;

  return (
    <div className="w-96 max-w-full h-full bg-atlas-surface border-l border-atlas-border flex flex-col z-30 shadow-2xl overflow-hidden font-mono text-xs transition-colors">
      {/* Drawer Header */}
      <div className="p-4 border-b border-atlas-border bg-atlas-elevated/60 flex items-start justify-between">
        <div className="space-y-1">
          <div className="text-[10px] text-atlas-muted tracking-wider flex items-center space-x-1.5 uppercase">
            <Compass className="w-3.5 h-3.5 text-atlas-accent" />
            <span>Planetary Site Recon</span>
          </div>
          <h2 className="text-sm font-bold text-atlas-text font-display">{location.name}</h2>
          <div className="text-atlas-blue font-mono text-[11px]">
            {formatMarsCoordinate(location.coordinate)}
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-atlas-muted hover:text-atlas-text p-1 transition-colors"
          title="Close Inspector"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Verification Status */}
        {location.isMockData ? (
          <div className="p-3 bg-atlas-elevated border border-atlas-amber/40 text-atlas-amber text-[11px] flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-atlas-amber shrink-0" />
            <span>Awaiting NASA in-situ telemetry — Topography evaluated from MOLA laser altimetry grid.</span>
          </div>
        ) : (
          <div className="p-2.5 bg-atlas-elevated border border-atlas-border text-atlas-text text-[11px] flex items-center space-x-2">
            <CheckCircle className="w-3.5 h-3.5 text-atlas-teal shrink-0" />
            <span>PDS Benchmark Reference Site (Static Catalog)</span>
          </div>
        )}

        {/* Topography & Rating Metrics */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-3 bg-atlas-elevated border border-atlas-border space-y-1">
            <div className="text-[10px] text-atlas-muted flex items-center space-x-1 uppercase">
              <Mountain className="w-3 h-3 text-atlas-blue" />
              <span>Elevation</span>
            </div>
            <div className="text-sm font-bold text-atlas-text font-mono">
              {location.elevationM !== undefined
                ? `${location.elevationM > 0 ? `+${location.elevationM}` : location.elevationM} m`
                : "Data unavailable"}
            </div>
            <div className="text-[10px] text-atlas-muted">Mars Datum 0m</div>
          </div>

          <div className="p-3 bg-atlas-elevated border border-atlas-border space-y-1">
            <div className="text-[10px] text-atlas-muted flex items-center space-x-1 uppercase">
              <Activity className="w-3 h-3 text-atlas-amber" />
              <span>Slope Incline</span>
            </div>
            <div className="text-sm font-bold text-atlas-text font-mono">
              {location.suitability?.slopeIndex !== undefined
                ? `${location.suitability.slopeIndex}°`
                : "Data unavailable"}
            </div>
            <div className="text-[10px] text-atlas-muted">Local terrain gradient</div>
          </div>
        </div>

        {/* Suitability Badge */}
        <div className={`p-2.5 border ${badge.bg} flex items-center justify-between`}>
          <div className="flex items-center space-x-2">
            <BadgeIcon className="w-4 h-4" />
            <span className="font-bold tracking-wider uppercase text-[11px]">{badge.label}</span>
          </div>
          <span className="text-[10px] uppercase text-atlas-muted font-mono">
            Dust: {location.suitability.dustHazard}
          </span>
        </div>

        {/* Geological Unit */}
        <div className="space-y-1.5">
          <div className="text-[10px] text-atlas-muted flex items-center space-x-1 uppercase tracking-wider">
            <Layers className="w-3.5 h-3.5 text-atlas-blue" />
            <span>Geological Unit & Stratigraphy</span>
          </div>
          <div className="p-2.5 bg-atlas-elevated border border-atlas-border text-atlas-text text-xs leading-relaxed font-sans">
            {location.geologicalUnit}
          </div>
        </div>

        {/* Terrain Classification */}
        <div className="space-y-1.5">
          <div className="text-[10px] text-atlas-muted uppercase tracking-wider">Terrain Morphology</div>
          <div className="p-2.5 bg-atlas-elevated border border-atlas-border text-atlas-muted text-xs leading-relaxed font-sans">
            {location.terrainType}
          </div>
        </div>

        {/* NASA In-Situ Observations */}
        {location.nasaObservations && location.nasaObservations.length > 0 && (
          <div className="space-y-2">
            <div className="text-[10px] text-atlas-muted flex items-center space-x-1 uppercase tracking-wider">
              <FileText className="w-3.5 h-3.5 text-atlas-teal" />
              <span>NASA In-Situ Ground Observations</span>
            </div>
            <div className="space-y-1.5">
              {location.nasaObservations.map((obs, idx) => (
                <div key={idx} className="p-2.5 bg-atlas-elevated border border-atlas-border space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-bold text-atlas-accent">
                    <span>{obs.mission} ({obs.instrument})</span>
                    {obs.landingDate && <span className="text-atlas-muted">{obs.landingDate}</span>}
                  </div>
                  <div className="text-atlas-text text-[11px] leading-relaxed font-sans">{obs.summary}</div>
                  <div className="text-[9px] text-atlas-muted font-mono">Observation: {obs.observationId}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Nearby Science Targets */}
        {location.nearbyScienceTargets && location.nearbyScienceTargets.length > 0 && (
          <div className="space-y-2">
            <div className="text-[10px] text-atlas-muted flex items-center space-x-1 uppercase tracking-wider">
              <Target className="w-3.5 h-3.5 text-atlas-accent" />
              <span>Nearby Science Targets ({location.nearbyScienceTargets.length})</span>
            </div>
            <div className="space-y-1.5">
              {location.nearbyScienceTargets.map((target) => {
                const mepag = getMepagGoalForCategory(target.category || target.name);
                return (
                  <div
                    key={target.id}
                    className="p-2.5 bg-atlas-elevated border border-atlas-border flex items-center justify-between"
                  >
                    <div className="space-y-1 max-w-[200px]">
                      <div className="font-bold text-atlas-text truncate text-xs font-sans">
                        {target.name}
                      </div>
                      <div className="flex items-center space-x-1.5 flex-wrap">
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded border font-mono font-bold ${mepag.badgeClass}`}
                        >
                          {mepag.shortLabel}
                        </span>
                        <span className="text-[10px] text-atlas-muted capitalize font-sans">
                          {target.category}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => onAddScienceStop(target)}
                      className="p-1.5 bg-atlas-surface hover:bg-atlas-elevated text-atlas-accent border border-atlas-border transition-colors text-[10px] flex items-center space-x-1 shrink-0 ml-2"
                      title="Add to Traverse Sequence"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Action Button Strip */}
        <div className="space-y-2 pt-2 border-t border-atlas-border">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onSetStart(location)}
              className="py-2 px-3 bg-atlas-elevated hover:bg-atlas-surface text-atlas-teal border border-atlas-border font-bold flex items-center justify-center space-x-1.5 text-xs transition-colors"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Set as Start</span>
            </button>

            <button
              onClick={() => onSetDestination(location)}
              className="py-2 px-3 bg-atlas-elevated hover:bg-atlas-surface text-atlas-accent border border-atlas-border font-bold flex items-center justify-center space-x-1.5 text-xs transition-colors"
            >
              <Flag className="w-3.5 h-3.5" />
              <span>Set as Dest</span>
            </button>
          </div>

          <button
            onClick={() => onPlanMission(location)}
            className="w-full py-2.5 bg-atlas-accent hover:bg-atlas-accent-dark text-white font-bold flex items-center justify-center space-x-2 text-xs transition-all shadow-md"
          >
            <Compass className="w-4 h-4" />
            <span>Plan EVA Mission from Here</span>
          </button>
        </div>
      </div>
    </div>
  );
};
