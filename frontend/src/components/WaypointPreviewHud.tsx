import React, { useEffect, useState } from "react";
import { api } from "../services/api.js";
import { MarsCoordinate } from "../types/index.js";
import {
  Compass,
  Mountain,
  Layers,
  Sparkles,
  AlertTriangle,
  Camera,
  X,
  ShieldAlert,
  Thermometer,
  Disc,
} from "lucide-react";

interface WaypointPreviewHudProps {
  coordinate: MarsCoordinate;
  label?: string;
  targetId?: string;
  onClose: () => void;
  onOpenSurfacePhotos?: (coord: MarsCoordinate) => void;
}

export const WaypointPreviewHud: React.FC<WaypointPreviewHudProps> = ({
  coordinate,
  label,
  onClose,
  onOpenSurfacePhotos,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    api
      .getUnifiedScienceLayer(coordinate.latitude, coordinate.longitude)
      .then((res) => {
        if (isMounted) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || "Failed to load destination preview");
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [coordinate.latitude, coordinate.longitude]);

  return (
    <div className="absolute top-16 left-4 z-30 w-96 max-w-[calc(100vw-2rem)] bg-atlas-surface/95 border border-atlas-border backdrop-blur-md shadow-2xl p-4 font-mono text-xs text-atlas-text flex flex-col space-y-3 pointer-events-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-atlas-border pb-2">
        <div className="flex items-center space-x-2">
          <Compass className="w-4 h-4 text-atlas-accent" />
          <span className="font-bold uppercase tracking-wider text-sm truncate max-w-[200px]">
            {label || "Waypoint Preview"}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-atlas-elevated text-atlas-muted hover:text-atlas-text transition-colors"
          title="Close destination preview"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Coordinate & Reference */}
      <div className="text-[10px] text-atlas-muted flex justify-between">
        <span>
          LAT: {coordinate.latitude.toFixed(4)}°N | LON: {coordinate.longitude.toFixed(4)}°E
        </span>
        <span className="text-atlas-teal font-semibold">IAU 2000 Mars</span>
      </div>

      {loading ? (
        <div className="py-8 flex flex-col items-center justify-center space-y-2 text-atlas-muted">
          <div className="w-5 h-5 border-2 border-atlas-accent border-t-transparent animate-spin rounded-full" />
          <span className="text-[11px]">Querying Multi-Mission Science Data...</span>
        </div>
      ) : error ? (
        <div className="py-4 text-atlas-red text-[11px] flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : data ? (
        <div className="space-y-3 overflow-y-auto max-h-[70vh] pr-1">
          {/* Topography & Elevation */}
          <div className="bg-atlas-bg/60 border border-atlas-border/60 p-2.5">
            <div className="flex items-center justify-between text-atlas-muted mb-1 text-[11px]">
              <span className="flex items-center space-x-1.5 font-semibold text-atlas-text">
                <Mountain className="w-3.5 h-3.5 text-atlas-accent" />
                <span>MOLA Topography</span>
              </span>
              <span className="text-[10px] bg-atlas-elevated px-1.5 py-0.5 border border-atlas-border">
                {data.topography.source}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div>
                <span className="text-[10px] text-atlas-muted block">Elevation:</span>
                <span className="font-bold text-sm text-atlas-text">
                  {data.topography.elevationM.toFixed(1)} m
                </span>
              </div>
              <div>
                <span className="text-[10px] text-atlas-muted block">Local Slope:</span>
                <span
                  className={`font-bold text-sm ${
                    data.topography.slopeDeg > 15
                      ? "text-atlas-red"
                      : data.topography.slopeDeg > 8
                      ? "text-amber-400"
                      : "text-emerald-400"
                  }`}
                >
                  {data.topography.slopeDeg.toFixed(1)}°
                </span>
              </div>
            </div>
            <div className="mt-1 text-[10px] text-atlas-muted">
              Uncertainty: ±{data.topography.uncertaintyM}m (95% CI)
            </div>
          </div>

          {/* Geological Stratigraphy */}
          <div className="bg-atlas-bg/60 border border-atlas-border/60 p-2.5">
            <div className="flex items-center justify-between text-atlas-muted mb-1 text-[11px]">
              <span className="flex items-center space-x-1.5 font-semibold text-atlas-text">
                <Layers className="w-3.5 h-3.5 text-purple-400" />
                <span>USGS Stratigraphy</span>
              </span>
              <span className="text-[10px] bg-purple-950/40 text-purple-300 px-1.5 py-0.5 border border-purple-800/50">
                {data.geology.unit}
              </span>
            </div>
            <div className="text-xs font-bold text-atlas-text">{data.geology.formation}</div>
            <div className="text-[10px] text-atlas-muted mt-0.5">{data.geology.description}</div>
            <div className="flex justify-between items-center mt-2 text-[10px]">
              <span className="text-atlas-muted">Mohs Hardness: {data.geology.hardness}</span>
              <span className="text-purple-300 font-semibold">{data.geology.period}</span>
            </div>
          </div>

          {/* CRISM Mineralogy */}
          <div className="bg-atlas-bg/60 border border-atlas-border/60 p-2.5">
            <div className="flex items-center justify-between text-atlas-muted mb-1 text-[11px]">
              <span className="flex items-center space-x-1.5 font-semibold text-atlas-text">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>CRISM Hyperspectral</span>
              </span>
              <span className="text-[10px] text-cyan-300 bg-cyan-950/40 px-1.5 py-0.5 border border-cyan-800/50">
                Preservation: {data.mineralogy.preservationRanking}
              </span>
            </div>
            <div className="text-xs font-semibold text-cyan-200">
              {data.mineralogy.detectedMineral}
            </div>
            <div className="text-[10px] text-atlas-muted mt-1">
              Bands: {data.mineralogy.absorptionBands.join(", ")}
            </div>
          </div>

          {/* Micro-Terrain & Obstacles */}
          <div className="bg-atlas-bg/60 border border-atlas-border/60 p-2.5">
            <div className="flex items-center justify-between text-atlas-muted mb-1 text-[11px]">
              <span className="flex items-center space-x-1.5 font-semibold text-atlas-text">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                <span>Micro-Terrain Obstacles</span>
              </span>
              <span className="text-[10px] text-amber-300 bg-amber-950/40 px-1.5 py-0.5 border border-amber-800/50">
                Golombek Model
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2 text-[10px]">
              <div>
                <span className="text-atlas-muted block">Rock Density:</span>
                <span className="font-semibold text-atlas-text">
                  {(data.microTerrain.rockDensityFraction * 100).toFixed(1)}% cover
                </span>
              </div>
              <div>
                <span className="text-atlas-muted block">Max Boulder:</span>
                <span className="font-semibold text-atlas-text">
                  {data.microTerrain.boulderDensityPer100m2.toFixed(1)} / 100m²
                </span>
              </div>
              <div>
                <span className="text-atlas-muted block">Repose Margin:</span>
                <span className="font-semibold text-emerald-400">
                  {data.microTerrain.scarpReposeSafetyMarginDeg.toFixed(1)}°
                </span>
              </div>
              <div>
                <span className="text-atlas-muted block">Sinkage Est:</span>
                <span className="font-semibold text-atlas-text">
                  {data.microTerrain.regolithSinkagePotentialCm.toFixed(1)} cm
                </span>
              </div>
            </div>
          </div>

          {/* Thermal & Subsurface */}
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="bg-atlas-bg/60 border border-atlas-border/60 p-2">
              <span className="flex items-center space-x-1 text-atlas-muted mb-1">
                <Thermometer className="w-3 h-3 text-atlas-accent" />
                <span>THEMIS Thermal</span>
              </span>
              <div className="font-semibold text-atlas-text">
                {data.thermal.thermalInertiaSI} J·m⁻²·K⁻¹·s⁻½
              </div>
              <div className="text-atlas-muted text-[9px] mt-0.5">
                Night: {data.thermal.nightTempK} K | Day: {data.thermal.dayTempK} K
              </div>
            </div>
            <div className="bg-atlas-bg/60 border border-atlas-border/60 p-2">
              <span className="flex items-center space-x-1 text-atlas-muted mb-1">
                <Disc className="w-3 h-3 text-blue-400" />
                <span>SHARAD Radar</span>
              </span>
              <div className="font-semibold text-atlas-text">
                εᵣ = {data.subsurfaceIce.dielectricPermittivity.toFixed(2)}
              </div>
              <div className="text-atlas-muted text-[9px] mt-0.5">
                SWIM Index: {data.subsurfaceIce.swimConsistencyIndex.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Action: Open Surface Photos */}
          {onOpenSurfacePhotos && (
            <button
              onClick={() => onOpenSurfacePhotos(coordinate)}
              className="w-full mt-2 py-2 px-3 bg-atlas-elevated hover:bg-atlas-accent text-atlas-text hover:text-white border border-atlas-border font-semibold flex items-center justify-center space-x-2 transition-all shadow-md"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Inspect Rover & Surface Photos</span>
            </button>
          )}

          {/* PDS Reference & Mission Provenance */}
          <div className="pt-2 border-t border-atlas-border/60 flex items-center justify-between text-[9px] text-atlas-muted">
            <span>NASA Planetary Data System (PDS)</span>
            <span className="text-atlas-teal font-semibold">Validated</span>
          </div>
        </div>
      ) : null}
    </div>
  );
};
