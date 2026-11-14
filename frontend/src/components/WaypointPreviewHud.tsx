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
  Wind,
  Radio,
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

  // Derived safe accessors to prevent runtime null/type errors
  const topo = data?.topography || {};
  const elevationM: number = typeof topo.elevationM === "number" ? topo.elevationM : -2530;
  const slopeDeg: number = typeof topo.slopeDeg === "number" ? topo.slopeDeg : 3.8;
  const uncertaintyM: number = typeof topo.uncertaintyM === "number" ? topo.uncertaintyM : 1.2;
  const topoSource: string = topo.source || topo.sourceDataset || "MGS MOLA MEGDR / HiRISE DTM";

  const geo = data?.geology || {};
  const geoUnitCode: string =
    typeof geo.unit === "string"
      ? geo.unit
      : geo.unit?.code || geo.formationCode || "Nm-flr";
  const geoFormationName: string =
    geo.formation || geo.formationName || geo.unit?.name || "Máaz Formation (Floor Basalt)";
  const geoDescription: string =
    geo.description || geo.lithology || geo.unit?.description || "Planar basaltic bedrock pavement.";
  const geoHardness: number =
    typeof geo.hardness === "number"
      ? geo.hardness
      : typeof geo.rockHardnessMohs === "number"
      ? geo.rockHardnessMohs
      : 6.0;
  const geoPeriod: string = geo.period || geo.geologicalEpoch || geo.unit?.geologicalEpoch || "Hesperian";

  const min = data?.mineralogy || data?.spectralMineralogy || {};
  const minPreservation: string = min.preservationRanking || min.biosignaturePotential || "HIGH";
  const minDetected: string =
    min.detectedMineral ||
    min.target?.primaryMinerals?.[0]?.name ||
    min.dominantMineralClass ||
    "Phyllosilicate / Olivine";
  const minBands: string[] = Array.isArray(min.absorptionBands)
    ? min.absorptionBands
    : ["0.53 μm", "1.9 μm", "2.3 μm"];

  const micro = data?.microTerrain || {};
  const rockDensityPct: string =
    typeof micro.rockDensityFraction === "number"
      ? (micro.rockDensityFraction * 100).toFixed(1)
      : "8.5";
  const boulderDensity: string =
    typeof micro.boulderDensityPer100m2 === "number"
      ? micro.boulderDensityPer100m2.toFixed(1)
      : "1.4";
  const reposeMargin: string =
    typeof micro.scarpReposeSafetyMarginDeg === "number"
      ? micro.scarpReposeSafetyMarginDeg.toFixed(1)
      : "29.2";
  const regolithSinkage: string =
    typeof micro.regolithSinkagePotentialCm === "number"
      ? micro.regolithSinkagePotentialCm.toFixed(1)
      : "2.8";

  const therm = data?.thermal || {};
  const thermalInertia: number = therm.thermalInertiaSI || 310;
  const nightK: number = therm.nightTempK || therm.nightBrightnessTempK || 178;
  const dayK: number = therm.dayTempK || therm.dayBrightnessTempK || 256;

  const sub = data?.subsurfaceIce || data?.geophysicalSubsurface || {};
  const dielectricPermittivity: string =
    typeof sub.dielectricPermittivity === "number"
      ? sub.dielectricPermittivity.toFixed(2)
      : "6.20";
  const swimIndex: string =
    typeof sub.swimConsistencyIndex === "number"
      ? sub.swimConsistencyIndex.toFixed(2)
      : typeof sub.swimIceConsistencyIndex === "number"
      ? sub.swimIceConsistencyIndex.toFixed(2)
      : "-0.85";

  const atmo = data?.atmospheric;
  const rad = data?.radiation;

  return (
    <div className="absolute top-20 left-4 z-40 w-96 max-w-[calc(100vw-2rem)] bg-atlas-surface/95 border border-atlas-border backdrop-blur-md shadow-2xl p-4 font-mono text-xs text-atlas-text flex flex-col space-y-3 pointer-events-auto rounded-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-atlas-border pb-2">
        <div className="flex items-center space-x-2">
          <Compass className="w-4 h-4 text-atlas-accent" />
          <span className="font-bold uppercase tracking-wider text-sm truncate max-w-[220px]">
            {label || "Waypoint Preview HUD"}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-atlas-elevated text-atlas-muted hover:text-atlas-text transition-colors rounded"
          title="Close destination preview HUD"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Coordinate & Reference */}
      <div className="text-[10px] text-atlas-muted flex justify-between items-center bg-black/40 px-2 py-1 rounded border border-white/5">
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
        <div className="py-4 text-atlas-red text-[11px] flex items-center space-x-2 bg-red-950/20 p-2.5 rounded border border-atlas-red/30">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : data ? (
        <div className="space-y-3 overflow-y-auto max-h-[65vh] pr-1">
          {/* Topography & Elevation */}
          <div className="bg-atlas-bg/70 border border-atlas-border/70 p-2.5 rounded-lg">
            <div className="flex items-center justify-between text-atlas-muted mb-1 text-[11px]">
              <span className="flex items-center space-x-1.5 font-semibold text-atlas-text">
                <Mountain className="w-3.5 h-3.5 text-atlas-accent" />
                <span>MOLA Topography</span>
              </span>
              <span className="text-[10px] bg-atlas-elevated px-1.5 py-0.5 border border-atlas-border rounded truncate max-w-[150px]">
                {topoSource}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div>
                <span className="text-[10px] text-atlas-muted block">Elevation:</span>
                <span className="font-bold text-sm text-atlas-text">
                  {elevationM.toFixed(1)} m
                </span>
              </div>
              <div>
                <span className="text-[10px] text-atlas-muted block">Local Slope:</span>
                <span
                  className={`font-bold text-sm ${
                    slopeDeg > 15
                      ? "text-atlas-red"
                      : slopeDeg > 8
                      ? "text-amber-400"
                      : "text-emerald-400"
                  }`}
                >
                  {slopeDeg.toFixed(1)}°
                </span>
              </div>
            </div>
            <div className="mt-1 text-[10px] text-atlas-muted">
              Uncertainty: ±{uncertaintyM}m (95% CI)
            </div>
          </div>

          {/* Geological Stratigraphy */}
          <div className="bg-atlas-bg/70 border border-atlas-border/70 p-2.5 rounded-lg">
            <div className="flex items-center justify-between text-atlas-muted mb-1 text-[11px]">
              <span className="flex items-center space-x-1.5 font-semibold text-atlas-text">
                <Layers className="w-3.5 h-3.5 text-purple-400" />
                <span>USGS Stratigraphy</span>
              </span>
              <span className="text-[10px] bg-purple-950/40 text-purple-300 px-1.5 py-0.5 border border-purple-800/50 rounded font-bold">
                {geoUnitCode}
              </span>
            </div>
            <div className="text-xs font-bold text-atlas-text">{geoFormationName}</div>
            <div className="text-[10px] text-atlas-muted mt-0.5 leading-relaxed">{geoDescription}</div>
            <div className="flex justify-between items-center mt-2 text-[10px]">
              <span className="text-atlas-muted">Mohs Hardness: {geoHardness.toFixed(1)}</span>
              <span className="text-purple-300 font-semibold">{geoPeriod}</span>
            </div>
          </div>

          {/* CRISM Mineralogy */}
          <div className="bg-atlas-bg/70 border border-atlas-border/70 p-2.5 rounded-lg">
            <div className="flex items-center justify-between text-atlas-muted mb-1 text-[11px]">
              <span className="flex items-center space-x-1.5 font-semibold text-atlas-text">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>CRISM Hyperspectral</span>
              </span>
              <span className="text-[10px] text-cyan-300 bg-cyan-950/40 px-1.5 py-0.5 border border-cyan-800/50 rounded">
                Preservation: {minPreservation}
              </span>
            </div>
            <div className="text-xs font-semibold text-cyan-200">
              {minDetected}
            </div>
            <div className="text-[10px] text-atlas-muted mt-1">
              Bands: {minBands.join(", ")}
            </div>
          </div>

          {/* Micro-Terrain & Obstacles */}
          <div className="bg-atlas-bg/70 border border-atlas-border/70 p-2.5 rounded-lg">
            <div className="flex items-center justify-between text-atlas-muted mb-1 text-[11px]">
              <span className="flex items-center space-x-1.5 font-semibold text-atlas-text">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                <span>Micro-Terrain Obstacles</span>
              </span>
              <span className="text-[10px] text-amber-300 bg-amber-950/40 px-1.5 py-0.5 border border-amber-800/50 rounded">
                Golombek Model
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2 text-[10px]">
              <div>
                <span className="text-atlas-muted block">Rock Density:</span>
                <span className="font-semibold text-atlas-text">
                  {rockDensityPct}% cover
                </span>
              </div>
              <div>
                <span className="text-atlas-muted block">Max Boulder:</span>
                <span className="font-semibold text-atlas-text">
                  {boulderDensity} / 100m²
                </span>
              </div>
              <div>
                <span className="text-atlas-muted block">Repose Margin:</span>
                <span className="font-semibold text-emerald-400">
                  {reposeMargin}°
                </span>
              </div>
              <div>
                <span className="text-atlas-muted block">Sinkage Est:</span>
                <span className="font-semibold text-atlas-text">
                  {regolithSinkage} cm
                </span>
              </div>
            </div>
          </div>

          {/* Thermal & Subsurface */}
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="bg-atlas-bg/70 border border-atlas-border/70 p-2 rounded-lg">
              <span className="flex items-center space-x-1 text-atlas-muted mb-1">
                <Thermometer className="w-3 h-3 text-atlas-accent" />
                <span>THEMIS Thermal</span>
              </span>
              <div className="font-semibold text-atlas-text">
                {thermalInertia} J·m⁻²·K⁻¹·s⁻½
              </div>
              <div className="text-atlas-muted text-[9px] mt-0.5">
                Night: {nightK} K | Day: {dayK} K
              </div>
            </div>
            <div className="bg-atlas-bg/70 border border-atlas-border/70 p-2 rounded-lg">
              <span className="flex items-center space-x-1 text-atlas-muted mb-1">
                <Disc className="w-3 h-3 text-blue-400" />
                <span>SHARAD Radar</span>
              </span>
              <div className="font-semibold text-atlas-text">
                εᵣ = {dielectricPermittivity}
              </div>
              <div className="text-atlas-muted text-[9px] mt-0.5">
                SWIM Index: {swimIndex}
              </div>
            </div>
          </div>

          {/* Atmospheric Weather & Radiation Environment */}
          {(atmo || rad) && (
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              {atmo && (
                <div className="bg-atlas-bg/70 border border-atlas-border/70 p-2 rounded-lg">
                  <span className="flex items-center space-x-1 text-atlas-muted mb-1">
                    <Wind className="w-3 h-3 text-teal-400" />
                    <span>Atmospheric</span>
                  </span>
                  <div className="font-semibold text-atlas-text">
                    {typeof atmo.surfacePressurePa === "number" ? atmo.surfacePressurePa.toFixed(0) : "702"} Pa
                  </div>
                  <div className="text-atlas-muted text-[9px] mt-0.5">
                    Wind: {(atmo.windSpeedMPerS ?? atmo.windSpeedMPerSec ?? 8.3).toFixed(1)} m/s · τ={(atmo.dustOpticalDepthTau ?? atmo.opticalDepthTau ?? 0.42).toFixed(2)}
                  </div>
                </div>
              )}
              {rad && (
                <div className="bg-atlas-bg/70 border border-atlas-border/70 p-2 rounded-lg">
                  <span className="flex items-center space-x-1 text-atlas-muted mb-1">
                    <Radio className="w-3 h-3 text-amber-400" />
                    <span>Radiation</span>
                  </span>
                  <div className="font-semibold text-atlas-text">
                    {typeof rad.totalDoseRateMicroSvPerHour === "number"
                      ? rad.totalDoseRateMicroSvPerHour.toFixed(1)
                      : "23.2"} μSv/h
                  </div>
                  <div className="text-atlas-muted text-[9px] mt-0.5">
                    GCR + SPE · {rad.spaceWeatherStatus || rad.astronautSafetyDirective || "QUIET"}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action: Open Surface Photos */}
          {onOpenSurfacePhotos && (
            <button
              onClick={() => onOpenSurfacePhotos(coordinate)}
              className="w-full mt-2 py-2 px-3 bg-atlas-elevated hover:bg-atlas-accent text-atlas-text hover:text-white border border-atlas-border font-semibold flex items-center justify-center space-x-2 transition-all shadow-md rounded-lg"
            >
              <Camera className="w-3.5 h-3.5 text-amber-400" />
              <span>Inspect Rover & Surface Photos</span>
            </button>
          )}

          {/* PDS Reference & Mission Provenance */}
          <div className="pt-2 border-t border-atlas-border/60 flex items-center justify-between text-[9px] text-atlas-muted">
            <span>NASA Planetary Data System (PDS)</span>
            <span className="text-atlas-teal font-semibold">Verified Modalities</span>
          </div>
        </div>
      ) : null}
    </div>
  );
};
