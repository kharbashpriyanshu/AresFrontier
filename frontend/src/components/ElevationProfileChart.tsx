import React, { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TerrainProfilePoint } from "../types/index.js";
import { formatMarsCoordinate } from "../utils/marsCoordinates.js";
import { TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";

interface ElevationProfileChartProps {
  profile: TerrainProfilePoint[];
  totalDistanceKm: number;
  onHoverPoint?: (point: TerrainProfilePoint | null) => void;
}

export const ElevationProfileChart: React.FC<ElevationProfileChartProps> = ({
  profile,
  onHoverPoint,
}) => {
  const [activePoint, setActivePoint] = useState<TerrainProfilePoint | null>(null);

  if (!profile || profile.length === 0) {
    return (
      <div className="h-44 flex items-center justify-center text-slate-500 font-mono text-xs border border-space-800 rounded bg-space-900/50">
        No topographic route profile data available.
      </div>
    );
  }

  const elevations = profile.map((p) => p.elevationM);
  const minElevation = Math.min(...elevations);
  const maxElevation = Math.max(...elevations);
  const maxSlope = Math.max(...profile.map((p) => p.slopeDegrees));
  const elevationDelta = elevations[elevations.length - 1] - elevations[0];

  const yDomainPadding = Math.max(40, Math.round((maxElevation - minElevation) * 0.15));

  return (
    <div className="w-full bg-space-900/95 border border-space-800 rounded p-3 flex flex-col font-mono text-xs space-y-2 shadow-xl">
      {/* Top Header & Slope Stats */}
      <div className="flex flex-wrap items-center justify-between pb-2 border-b border-space-800 text-[10px] gap-2">
        <div className="flex items-center space-x-2">
          <span className="uppercase tracking-wider font-bold text-slate-300">
            MOLA Topographic Cross-Section
          </span>
          {maxSlope > 15 && (
            <span className="px-1.5 py-0.5 rounded bg-rose-950/60 border border-rose-500/40 text-rose-300 text-[9px] flex items-center space-x-1">
              <AlertTriangle className="w-3 h-3 text-rose-400" />
              <span>STEEP SECTIONS</span>
            </span>
          )}
        </div>

        <div className="flex items-center space-x-3 text-slate-400">
          <span className="flex items-center space-x-1">
            {elevationDelta >= 0 ? (
              <TrendingUp className="w-3 h-3 text-telemetry-cyan" />
            ) : (
              <TrendingDown className="w-3 h-3 text-telemetry-rose" />
            )}
            <span>NET: <span className="text-slate-200">{elevationDelta > 0 ? `+${elevationDelta}` : elevationDelta}m</span></span>
          </span>
          <span>MAX SLOPE: <span className="text-telemetry-amber font-bold">{maxSlope}°</span></span>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-40 w-full pt-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={profile}
            margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
            onMouseMove={(state) => {
              if (state && state.activePayload && state.activePayload.length > 0) {
                const pt = state.activePayload[0].payload as TerrainProfilePoint;
                setActivePoint(pt);
                if (onHoverPoint) onHoverPoint(pt);
              }
            }}
            onMouseLeave={() => {
              setActivePoint(null);
              if (onHoverPoint) onHoverPoint(null);
            }}
          >
            <defs>
              <linearGradient id="molaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#e26d46" stopOpacity={0.65} />
                <stop offset="95%" stopColor="#c1440e" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f293d" vertical={false} />
            <XAxis
              dataKey="distanceKm"
              tick={{ fill: "#64748b", fontSize: 10 }}
              tickLine={{ stroke: "#334155" }}
              axisLine={{ stroke: "#334155" }}
              tickFormatter={(val) => `${val} km`}
            />
            <YAxis
              domain={[minElevation - yDomainPadding, maxElevation + yDomainPadding]}
              tick={{ fill: "#64748b", fontSize: 10 }}
              tickLine={{ stroke: "#334155" }}
              axisLine={{ stroke: "#334155" }}
              tickFormatter={(val) => `${val}m`}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload as TerrainProfilePoint;
                  return (
                    <div className="bg-space-950/95 border border-space-700 p-2.5 rounded shadow-2xl text-[10px] space-y-1">
                      <div className="text-mars-accent font-bold">DISTANCE: {data.distanceKm} km</div>
                      <div className="text-slate-100 font-semibold">ELEVATION: {data.elevationM} m datum</div>
                      <div className="flex items-center space-x-1.5 text-telemetry-amber">
                        <span>LOCAL INCLINE:</span>
                        <span className="font-bold">{data.slopeDegrees}°</span>
                      </div>
                      <div className="text-slate-400 font-mono text-[9px] pt-0.5 border-t border-space-800">
                        {formatMarsCoordinate(data.coordinate)}
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area
              type="monotone"
              dataKey="elevationM"
              stroke="#e26d46"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#molaGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Point Telemetry Sub-bar */}
      {activePoint && (
        <div className="p-1.5 bg-space-850 rounded border border-space-800 text-[10px] flex items-center justify-between text-slate-300">
          <span>AT {activePoint.distanceKm} KM</span>
          <span className="text-telemetry-cyan font-bold">{activePoint.elevationM}m</span>
          <span className="text-telemetry-amber font-bold">{activePoint.slopeDegrees}° slope</span>
          <span className="text-slate-400">{formatMarsCoordinate(activePoint.coordinate)}</span>
        </div>
      )}
    </div>
  );
};
