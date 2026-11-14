import React from "react";
import { LocationData, ScienceTarget } from "../types/index.js";
import { formatMarsCoordinate } from "../utils/marsCoordinates.js";
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
          bg: "bg-emerald-950/80 border-emerald-500/50 text-emerald-300",
          icon: CheckCircle,
          label: "EVA OPTIMAL",
        };
      case "acceptable":
        return {
          bg: "bg-cyan-950/80 border-cyan-500/50 text-cyan-300",
          icon: CheckCircle,
          label: "EVA ACCEPTABLE",
        };
      case "restricted":
        return {
          bg: "bg-amber-950/80 border-amber-500/50 text-amber-300",
          icon: AlertTriangle,
          label: "EVA RESTRICTED",
        };
      case "hazardous":
        return {
          bg: "bg-rose-950/80 border-rose-500/50 text-rose-300",
          icon: AlertTriangle,
          label: "EVA HAZARDOUS",
        };
    }
  };

  const badge = getRatingBadge(location.suitability.evaRating);
  const BadgeIcon = badge.icon;

  return (
    <div className="w-96 max-w-full h-full bg-space-900 border-l border-space-800 flex flex-col z-30 shadow-2xl overflow-hidden font-mono text-xs">
      {/* Drawer Header */}
      <div className="p-4 border-b border-space-800 bg-space-950/60 flex items-start justify-between">
        <div className="space-y-1">
          <div className="text-[10px] text-slate-400 tracking-wider flex items-center space-x-1.5 uppercase">
            <Compass className="w-3.5 h-3.5 text-mars-accent" />
            <span>PLANETARY SITE RECON</span>
          </div>
          <h2 className="text-sm font-bold text-slate-100 font-sans">{location.name}</h2>
          <div className="text-telemetry-cyan font-mono text-[11px]">
            {formatMarsCoordinate(location.coordinate)}
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded hover:bg-space-800 transition-colors"
          title="Close Inspector"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Mock/Sample Data Notice */}
        {location.isMockData ? (
          <div className="p-2.5 rounded bg-amber-950/40 border border-amber-500/30 text-amber-200 text-[11px] flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Awaiting NASA in-situ dataset — Topography evaluated from MOLA laser altimetry grid.</span>
          </div>
        ) : (
          <div className="p-2 rounded bg-space-850 border border-space-800 text-slate-300 text-[10px] flex items-center space-x-2">
            <CheckCircle className="w-3.5 h-3.5 text-telemetry-emerald shrink-0" />
            <span>Verified NASA Ground Truth Site (PDS Analyst's Notebook)</span>
          </div>
        )}

        {/* Topography & Rating Metrics */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-3 bg-space-850 rounded border border-space-800 space-y-1">
            <div className="text-[10px] text-slate-400 flex items-center space-x-1">
              <Mountain className="w-3 h-3 text-telemetry-cyan" />
              <span>ELEVATION</span>
            </div>
            <div className="text-sm font-bold text-slate-100">
              {location.elevationM !== undefined
                ? `${location.elevationM > 0 ? `+${location.elevationM}` : location.elevationM} m`
                : "Data unavailable"}
            </div>
            <div className="text-[10px] text-slate-500">Mars Datum 0m</div>
          </div>

          <div className="p-3 bg-space-850 rounded border border-space-800 space-y-1">
            <div className="text-[10px] text-slate-400 flex items-center space-x-1">
              <Activity className="w-3 h-3 text-telemetry-amber" />
              <span>SLOPE INDEX</span>
            </div>
            <div className="text-sm font-bold text-slate-100">
              {location.suitability?.slopeIndex !== undefined
                ? `${location.suitability.slopeIndex}°`
                : "Data unavailable"}
            </div>
            <div className="text-[10px] text-slate-500">Local incline</div>
          </div>
        </div>

        {/* Suitability Badge */}
        <div className={`p-2.5 rounded border ${badge.bg} flex items-center justify-between`}>
          <div className="flex items-center space-x-2">
            <BadgeIcon className="w-4 h-4" />
            <span className="font-bold tracking-wider">{badge.label}</span>
          </div>
          <span className="text-[10px] uppercase text-slate-400">
            DUST: {location.suitability.dustHazard}
          </span>
        </div>

        {/* Geological Unit */}
        <div className="space-y-1.5">
          <div className="text-[10px] text-slate-400 flex items-center space-x-1 uppercase tracking-wider">
            <Layers className="w-3 h-3 text-mars-accent" />
            <span>Stratigraphic / Geological Unit</span>
          </div>
          <div className="p-2.5 bg-space-850 rounded border border-space-800 text-slate-200 text-[11px] leading-relaxed">
            {location.geologicalUnit || "Data unavailable"}
          </div>
        </div>

        {/* Terrain Characterization */}
        <div className="space-y-1.5">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider">Terrain Morphology</div>
          <div className="p-2.5 bg-space-850 rounded border border-space-800 text-slate-300 text-[11px] leading-relaxed">
            {location.terrainType || "Data unavailable"}
          </div>
        </div>

        {/* Nearby Science Targets */}
        {location.nearbyScienceTargets && location.nearbyScienceTargets.length > 0 && (
          <div className="space-y-2">
            <div className="text-[10px] text-slate-400 flex items-center space-x-1 uppercase tracking-wider">
              <Target className="w-3 h-3 text-telemetry-cyan" />
              <span>Nearby Science Targets ({location.nearbyScienceTargets.length})</span>
            </div>

            <div className="space-y-1.5">
              {location.nearbyScienceTargets.map((tgt) => (
                <div
                  key={tgt.id}
                  className="p-2.5 bg-space-850 rounded border border-space-800 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-slate-200 truncate">{tgt.name}</div>
                    <div className="text-[10px] text-telemetry-cyan uppercase">
                      {tgt.category} • {tgt.scientificValue} priority
                    </div>
                  </div>
                  <button
                    onClick={() => onAddScienceStop(tgt)}
                    className="px-2 py-1 bg-space-800 hover:bg-space-700 text-slate-200 rounded border border-space-700 flex items-center space-x-1 shrink-0 text-[10px]"
                    title="Add to current Marswalk route"
                  >
                    <Plus className="w-3 h-3 text-mars-accent" />
                    <span>ADD STOP</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* NASA Observations */}
        <div className="space-y-2">
          <div className="text-[10px] text-slate-400 flex items-center space-x-1 uppercase tracking-wider">
            <FileText className="w-3 h-3 text-telemetry-cyan" />
            <span>NASA Mission Context ({location.nasaObservations?.length || 0})</span>
          </div>

          {location.nasaObservations && location.nasaObservations.length > 0 ? (
            location.nasaObservations.map((obs, idx) => (
              <div key={idx} className="p-2.5 bg-space-850 rounded border border-space-800 space-y-1">
                <div className="flex items-center justify-between text-mars-accent font-semibold text-[11px]">
                  <span>{obs.mission}</span>
                  <span className="text-[10px] text-slate-500">{obs.instrument}</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-snug">{obs.summary}</p>
                <div className="text-[9px] text-slate-500 font-mono">ID: {obs.observationId}</div>
              </div>
            ))
          ) : (
            <div className="p-3 bg-space-850 rounded border border-space-800 text-slate-400 text-[11px]">
              Awaiting NASA in-situ observations. MOLA and Viking orbital basemaps active.
            </div>
          )}
        </div>
      </div>

      {/* Action Footer (Phase 4 requirement: Set as Start, Set as Destination, Add Science Stop, Plan Mission) */}
      <div className="p-4 border-t border-space-800 bg-space-950/90 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onSetStart(location)}
            className="py-2 px-3 bg-space-850 hover:bg-space-800 text-slate-200 border border-space-700 rounded font-semibold flex items-center justify-center space-x-1.5 transition-colors"
          >
            <Flag className="w-3.5 h-3.5 text-telemetry-emerald" />
            <span>SET AS START</span>
          </button>

          <button
            onClick={() => onSetDestination(location)}
            className="py-2 px-3 bg-space-850 hover:bg-space-800 text-slate-200 border border-space-700 rounded font-semibold flex items-center justify-center space-x-1.5 transition-colors"
          >
            <Flag className="w-3.5 h-3.5 text-telemetry-rose" />
            <span>SET AS DEST</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onAddScienceStop(location)}
            className="py-2 px-3 bg-space-850 hover:bg-space-800 text-slate-200 border border-space-700 rounded font-semibold flex items-center justify-center space-x-1.5 transition-colors"
          >
            <Target className="w-3.5 h-3.5 text-telemetry-cyan" />
            <span>ADD SCIENCE STOP</span>
          </button>

          <button
            onClick={() => onPlanMission(location)}
            className="py-2 px-3 bg-gradient-to-r from-mars-rust to-mars-accent hover:from-mars-accent hover:to-orange-500 text-white font-bold rounded flex items-center justify-center space-x-1.5 shadow-md shadow-mars-rust/20 transition-all"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>PLAN MISSION</span>
          </button>
        </div>
      </div>
    </div>
  );
};
