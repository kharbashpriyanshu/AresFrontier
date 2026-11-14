import React, { useState, useEffect } from "react";
import { api } from "../services/api.js";
import { MarsCoordinate } from "../types/index.js";
import {
  CloudSun,
  Thermometer,
  Sun,
  ShieldAlert,
  AlertTriangle,
  X,
  CheckCircle,
  Radio,
} from "lucide-react";

interface EnvironmentalDashboardProps {
  coordinate: MarsCoordinate;
  onClose: () => void;
}

export const EnvironmentalDashboard: React.FC<EnvironmentalDashboardProps> = ({
  coordinate,
  onClose,
}) => {
  const [sol, setSol] = useState<number>(350);
  const [hour, setHour] = useState<number>(14);
  const [mode, setMode] = useState<"MEASURED" | "FORECAST">("MEASURED");
  const [loading, setLoading] = useState<boolean>(true);
  const [atmoData, setAtmoData] = useState<any>(null);
  const [radData, setRadData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    Promise.all([
      api.getAuthenticAtmosphere(coordinate.latitude, coordinate.longitude, sol, hour),
      api.getAuthenticRadiation(coordinate.latitude, coordinate.longitude, sol, 8),
    ])
      .then(([atmo, rad]) => {
        if (isMounted) {
          setAtmoData(atmo);
          setRadData(rad);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || "Failed to load environmental conditions");
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [coordinate.latitude, coordinate.longitude, sol, hour]);

  const safeFixed = (val: any, decimals: number = 1, fallback: string = "0.0") =>
    typeof val === "number" && !isNaN(val) ? val.toFixed(decimals) : fallback;

  const kToC = (k: any) =>
    typeof k === "number" && !isNaN(k) ? (k - 273.15).toFixed(1) : "--";

  return (
    <div className="absolute top-24 right-4 z-40 w-96 max-w-[calc(100vw-2rem)] bg-atlas-surface/95 border border-atlas-border backdrop-blur-md shadow-2xl p-4 font-mono text-xs text-atlas-text flex flex-col space-y-3 pointer-events-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-atlas-border pb-2">
        <div className="flex items-center space-x-2">
          <CloudSun className="w-4 h-4 text-atlas-accent" />
          <span className="font-bold uppercase tracking-wider text-sm">
            Martian Environment HUD
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-atlas-elevated text-atlas-muted hover:text-atlas-text transition-colors"
          title="Close environment dashboard"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Mode Switcher */}
      <div className="flex items-center bg-atlas-bg border border-atlas-border p-0.5 text-[10px]">
        <button
          onClick={() => setMode("MEASURED")}
          className={`flex-1 py-1 px-2 flex items-center justify-center space-x-1.5 transition-colors ${
            mode === "MEASURED"
              ? "bg-atlas-teal text-atlas-bg font-bold"
              : "text-atlas-muted hover:text-atlas-text"
          }`}
        >
          <CheckCircle className="w-3 h-3" />
          <span>NASA Measured (MEDA/RAD)</span>
        </button>
        <button
          onClick={() => setMode("FORECAST")}
          className={`flex-1 py-1 px-2 flex items-center justify-center space-x-1.5 transition-colors ${
            mode === "FORECAST"
              ? "bg-atlas-accent text-white font-bold"
              : "text-atlas-muted hover:text-atlas-text"
          }`}
        >
          <Radio className="w-3 h-3" />
          <span>MCD v5.3 Forecast</span>
        </button>
      </div>

      {/* Sol & LTST Controls */}
      <div className="grid grid-cols-2 gap-2 text-[10px] bg-atlas-bg/40 border border-atlas-border/60 p-2">
        <div>
          <label className="text-atlas-muted block mb-1">Mission Sol:</label>
          <input
            type="number"
            min={1}
            max={1000}
            value={sol}
            onChange={(e) => setSol(Number(e.target.value) || 1)}
            className="w-full bg-atlas-surface border border-atlas-border px-2 py-1 text-atlas-text text-xs focus:outline-none focus:border-atlas-accent font-mono"
          />
        </div>
        <div>
          <label className="text-atlas-muted block mb-1">Local Time (LTST):</label>
          <div className="flex items-center space-x-1">
            <input
              type="range"
              min={0}
              max={23}
              value={hour}
              onChange={(e) => setHour(Number(e.target.value))}
              className="w-full accent-atlas-accent"
            />
            <span className="font-bold text-xs w-8 text-right">{hour.toString().padStart(2, "0")}:00</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-8 flex flex-col items-center justify-center space-y-2 text-atlas-muted">
          <div className="w-5 h-5 border-2 border-atlas-teal border-t-transparent animate-spin rounded-full" />
          <span className="text-[11px]">Synchronizing Atmospheric & Radiation telemetry...</span>
        </div>
      ) : error ? (
        <div className="py-4 text-atlas-red text-[11px] flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : atmoData && radData ? (
        <div className="space-y-3 overflow-y-auto max-h-[65vh] pr-1">
          {/* Temperature & Pressure */}
          <div className="bg-atlas-bg/60 border border-atlas-border/60 p-2.5">
            <div className="flex items-center justify-between text-atlas-muted mb-2 text-[11px]">
              <span className="flex items-center space-x-1.5 font-semibold text-atlas-text">
                <Thermometer className="w-3.5 h-3.5 text-atlas-accent" />
                <span>Atmospheric Thermodynamics</span>
              </span>
              <span className="text-[10px] text-atlas-teal bg-atlas-elevated px-1.5 py-0.5 border border-atlas-border">
                {mode === "MEASURED" ? "MEDA / REMS Sensor" : "MCD v5.3 Global"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-atlas-surface p-2 border border-atlas-border">
                <span className="text-[10px] text-atlas-muted block">Air Temp (1.5m):</span>
                <span className="font-bold text-sm text-atlas-text">
                  {safeFixed(atmoData.airTemperatureK, 1)} K
                </span>
                <span className="text-[10px] text-atlas-muted ml-1.5">
                  ({kToC(atmoData.airTemperatureK)}°C)
                </span>
              </div>
              <div className="bg-atlas-surface p-2 border border-atlas-border">
                <span className="text-[10px] text-atlas-muted block">Ground Temp:</span>
                <span className="font-bold text-sm text-amber-400">
                  {safeFixed(atmoData.groundTemperatureK, 1)} K
                </span>
                <span className="text-[10px] text-atlas-muted ml-1.5">
                  ({kToC(atmoData.groundTemperatureK)}°C)
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="bg-atlas-surface p-2 border border-atlas-border">
                <span className="text-[10px] text-atlas-muted block">Pressure:</span>
                <span className="font-bold text-sm text-atlas-text">
                  {safeFixed(atmoData.surfacePressurePa, 0)} Pa
                </span>
                <span className="text-[9px] text-atlas-muted block mt-0.5">
                  {safeFixed((atmoData.surfacePressurePa ?? 0) / 100, 2)} mbar
                </span>
              </div>
              <div className="bg-atlas-surface p-2 border border-atlas-border">
                <span className="text-[10px] text-atlas-muted block">Wind Velocity:</span>
                <span className="font-bold text-sm text-atlas-text">
                  {safeFixed(atmoData.windSpeedMPerS, 1)} m/s
                </span>
                <span className="text-[9px] text-atlas-muted block mt-0.5">
                  Dir: {atmoData.windDirectionDeg ?? 0}°
                </span>
              </div>
            </div>
          </div>

          {/* Dust Conditions */}
          <div className="bg-atlas-bg/60 border border-atlas-border/60 p-2.5">
            <div className="flex items-center justify-between text-atlas-muted mb-2 text-[11px]">
              <span className="flex items-center space-x-1.5 font-semibold text-atlas-text">
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>Dust Environment & Visibility</span>
              </span>
              <span className="text-[10px] text-amber-400 bg-amber-950/40 px-1.5 py-0.5 border border-amber-800/50">
                τ = {safeFixed(atmoData.dustOpticalDepthTau, 2)}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-atlas-muted">Dust Devil Activity:</span>
              <span
                className={`font-semibold ${
                  atmoData.dustDevilActivityRisk === "HIGH"
                    ? "text-atlas-red"
                    : atmoData.dustDevilActivityRisk === "MODERATE"
                    ? "text-amber-400"
                    : "text-emerald-400"
                }`}
              >
                {atmoData.dustDevilActivityRisk || "NOMINAL"}
              </span>
            </div>
            <div className="text-[10px] text-atlas-muted mt-1">
              Spacesuit Thermal Load:{" "}
              <span className="text-atlas-teal font-semibold">
                {atmoData.suitThermalRegulationComfort || "NOMINAL"}
              </span>
            </div>
          </div>

          {/* Radiation Environment (RAD) */}
          <div className="bg-atlas-bg/60 border border-atlas-border/60 p-2.5">
            <div className="flex items-center justify-between text-atlas-muted mb-2 text-[11px]">
              <span className="flex items-center space-x-1.5 font-semibold text-atlas-text">
                <ShieldAlert className="w-3.5 h-3.5 text-atlas-red" />
                <span>Surface Radiation (MSL RAD)</span>
              </span>
              <span className="text-[10px] text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 border border-emerald-800/50">
                {radData.exposureSafetyStatus || "NOMINAL"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="bg-atlas-surface p-2 border border-atlas-border">
                <span className="text-atlas-muted block">Dose Rate:</span>
                <span className="font-bold text-sm text-atlas-text">
                  {safeFixed(radData.doseRateMicroGyPerDay, 0)} μGy/d
                </span>
                <span className="text-[9px] text-atlas-muted block">
                  {safeFixed(radData.doseEquivalentMicroSvPerDay, 0)} μSv/d
                </span>
              </div>
              <div className="bg-atlas-surface p-2 border border-atlas-border">
                <span className="text-atlas-muted block">EVA Cumulative:</span>
                <span className="font-bold text-sm text-atlas-teal">
                  {safeFixed(radData.cumulativeDoseMilliSv, 3)} mSv
                </span>
                <span className="text-[9px] text-atlas-muted block">
                  {radData.evaDurationHours ?? 8} hr EVA session
                </span>
              </div>
            </div>

            {/* PEL Progress */}
            <div className="mt-2.5">
              <div className="flex justify-between text-[10px] text-atlas-muted mb-1">
                <span>NASA 30-Day Career PEL ({radData.nasa30DayPELMilliSv ?? 25} mSv)</span>
                <span>{safeFixed(radData.percentageOf30DayPEL, 2)}%</span>
              </div>
              <div className="w-full bg-atlas-elevated h-1.5 border border-atlas-border overflow-hidden">
                <div
                  className="bg-atlas-teal h-full transition-all"
                  style={{ width: `${Math.min(100, Math.max(1, (radData.percentageOf30DayPEL ?? 0) * 10))}%` }}
                />
              </div>
            </div>

            <div className="mt-2 text-[10px] flex justify-between items-center">
              <span className="text-atlas-muted">SEP Solar Storm Alert:</span>
              <span
                className={`font-semibold ${
                  radData.solarParticleEventAlert ? "text-atlas-red" : "text-emerald-400"
                }`}
              >
                {radData.solarParticleEventAlert ? "ALERT (SHELTER)" : "QUIET"}
              </span>
            </div>
          </div>

          {/* Provenance Footer */}
          <div className="pt-2 border-t border-atlas-border/60 flex items-center justify-between text-[9px] text-atlas-muted">
            <span>NASA Planetary Data System (PDS)</span>
            <span className="text-atlas-teal font-semibold">Active Sol Telemetry</span>
          </div>
        </div>
      ) : null}
    </div>
  );
};
