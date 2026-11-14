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
      <div className="p-6 flex flex-col items-center justify-center text-center border border-atlas-border bg-atlas-surface/60 space-y-2">
        <div className="flex items-center gap-2 text-atlas-amber font-mono text-xs font-bold uppercase">
          <AlertTriangle className="w-4 h-4" />
          <span>UNAVAILABLE — SOURCE TOPOGRAPHIC SAMPLES NOT ATTACHED</span>
        </div>
        <p className="text-xs text-atlas-muted font-mono max-w-xl">
          This route record does not contain persisted waypoint elevation samples. Select a route with derived terrain samples (e.g. E2E Jezero Delta Traversal Mission) to view its cross-section.
        </p>
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
    <div className="w-full bg-atlas-surface border border-atlas-border p-4 flex flex-col font-mono text-xs space-y-3 shadow-xl transition-colors">
      {/* Top Header & Slope Stats */}
      <div className="flex flex-wrap items-center justify-between pb-2.5 border-b border-atlas-border text-[11px] gap-2">
        <div className="flex items-center space-x-2">
          <span className="font-display font-bold uppercase tracking-wider text-atlas-text">
            Derived Route Topographic Cross-Section (Benchmark Model)
          </span>
          {maxSlope > 15 && (
            <span className="px-2 py-0.5 bg-atlas-elevated border border-atlas-border text-atlas-red text-[10px] flex items-center space-x-1">
              <AlertTriangle className="w-3 h-3 text-atlas-red" />
              <span>Steep Incline Sections</span>
            </span>
          )}
        </div>

        <div className="flex items-center space-x-4 text-atlas-muted">
          <span className="flex items-center space-x-1">
            {elevationDelta >= 0 ? (
              <TrendingUp className="w-3.5 h-3.5 text-atlas-blue" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-atlas-red" />
            )}
            <span>Net: <span className="text-atlas-text font-bold">{elevationDelta > 0 ? `+${elevationDelta}` : elevationDelta} m</span></span>
          </span>
          <span>Max Slope: <span className="text-atlas-amber font-bold">{maxSlope}°</span></span>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-44 w-full pt-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={profile}
            margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
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
                <stop offset="5%" stopColor="var(--atlas-accent)" stopOpacity={0.55} />
                <stop offset="95%" stopColor="var(--atlas-accent-dark)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 2" stroke="var(--atlas-border)" vertical={false} />
            <XAxis
              dataKey="distanceKm"
              tick={{ fill: "var(--atlas-muted)", fontSize: 10, fontFamily: "Inter" }}
              tickLine={{ stroke: "var(--atlas-border)" }}
              unit=" km"
            />
            <YAxis
              domain={[minElevation - yDomainPadding, maxElevation + yDomainPadding]}
              tick={{ fill: "var(--atlas-muted)", fontSize: 10, fontFamily: "Inter" }}
              tickLine={{ stroke: "var(--atlas-border)" }}
              unit=" m"
              width={50}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const pt = payload[0].payload as TerrainProfilePoint;
                return (
                  <div className="bg-atlas-elevated border border-atlas-border p-2.5 shadow-2xl font-mono text-[11px] space-y-1">
                    <div className="text-atlas-accent font-bold">
                      {pt.distanceKm.toFixed(2)} km along traverse
                    </div>
                    <div className="text-atlas-text">
                      Elevation: <b className="text-atlas-blue">{pt.elevationM > 0 ? `+${pt.elevationM}` : pt.elevationM} m</b>
                    </div>
                    <div className="text-atlas-muted">
                      Local Slope: <b className="text-atlas-amber">{pt.slopeDegrees}°</b>
                    </div>
                    {pt.coordinate && (
                      <div className="text-[10px] text-atlas-muted border-t border-atlas-border pt-1">
                        {formatMarsCoordinate(pt.coordinate)}
                      </div>
                    )}
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="elevationM"
              stroke="var(--atlas-accent)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#molaGradient)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Active Inspector Footer */}
      {activePoint ? (
        <div className="flex items-center justify-between text-[11px] bg-atlas-elevated p-2 border border-atlas-border">
          <span className="text-atlas-muted">
            Distance: <span className="text-atlas-text font-bold">{activePoint.distanceKm.toFixed(2)} km</span>
          </span>
          <span className="text-atlas-muted">
            Elevation: <span className="text-atlas-blue font-bold">{activePoint.elevationM} m</span>
          </span>
          <span className="text-atlas-muted">
            Slope: <span className="text-atlas-amber font-bold">{activePoint.slopeDegrees}°</span>
          </span>
          <span className="text-atlas-muted hidden sm:inline">
            Coords: <span className="text-atlas-text">{formatMarsCoordinate(activePoint.coordinate)}</span>
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-between text-[10px] text-atlas-muted border-t border-atlas-border pt-2">
          <span>Datum: IAU/IAG Mars 2000 Areoid (0m elevation datum)</span>
          <span>Hover over profile to trace coordinate elevation</span>
        </div>
      )}
    </div>
  );
};
