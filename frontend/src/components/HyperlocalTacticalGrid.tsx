import React, { useState, useEffect } from "react";
import { api } from "../services/api.js";
import { MarsCoordinate } from "../types/index.js";
import {
  Compass,
  Footprints,
  Bot,
  Users,
  X,
} from "lucide-react";

interface HyperlocalTacticalGridProps {
  coordinate: MarsCoordinate;
  onClose: () => void;
}

interface TacticalObstacle {
  x: number; // meters from center (-50 to +50)
  y: number; // meters from center (-50 to +50)
  diameterM: number;
  severity: "LOW" | "MODERATE" | "HIGH";
  type: "BOULDER" | "REGOLITH_SINK" | "SCARP_CREST";
}

export const HyperlocalTacticalGrid: React.FC<HyperlocalTacticalGridProps> = ({
  coordinate,
  onClose,
}) => {
  const [scaleMeters, setScaleMeters] = useState<number>(100); // 50m, 100m, or 200m
  const [loading, setLoading] = useState<boolean>(true);
  const [microData, setMicroData] = useState<any>(null);

  // Simulated tactical entities relative to excursion center (0, 0)
  const astronautPos = { x: 0, y: 0 };
  const buddyPos = { x: 45, y: -65 };
  const roboticMulePos = { x: -20, y: 30 };
  const [obstacles, setObstacles] = useState<TacticalObstacle[]>([]);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    api
      .getMicroTerrainObstacles(coordinate.latitude, coordinate.longitude)
      .then((res) => {
        if (!isMounted) return;
        setMicroData(res);

        // Generate deterministic obstacle field based on rock abundance
        const count = Math.min(35, Math.max(12, Math.round(res.boulderDensityPer100m2 * 6)));
        const generated: TacticalObstacle[] = [];

        // Pseudo-random seed from coordinates
        let seed = Math.abs(Math.sin(coordinate.latitude * 100 + coordinate.longitude * 50));
        const pseudoRand = () => {
          seed = (seed * 9301 + 49297) % 233280;
          return seed / 233280;
        };

        for (let i = 0; i < count; i++) {
          const r = pseudoRand() * 45;
          const theta = pseudoRand() * Math.PI * 2;
          const x = Math.cos(theta) * r;
          const y = Math.sin(theta) * r;
          const diameter = 0.3 + pseudoRand() * 1.5;
          const isSink = pseudoRand() > 0.85;

          generated.push({
            x,
            y,
            diameterM: diameter,
            severity: diameter > 1.0 ? "HIGH" : diameter > 0.6 ? "MODERATE" : "LOW",
            type: isSink ? "REGOLITH_SINK" : "BOULDER",
          });
        }

        setObstacles(generated);
        setLoading(false);
      })
      .catch(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [coordinate.latitude, coordinate.longitude]);

  // Compute live Euclidean buddy tether distance
  const dx = buddyPos.x - astronautPos.x;
  const dy = buddyPos.y - astronautPos.y;
  const tetherDist = Math.hypot(dx, dy);
  const tetherViolation = tetherDist > 150;

  // Coordinate mapping into SVG [-scale/2, scale/2] -> [0, 300]
  const svgSize = 320;
  const toSvgX = (mX: number) => ((mX + scaleMeters / 2) / scaleMeters) * svgSize;
  const toSvgY = (mY: number) => ((-mY + scaleMeters / 2) / scaleMeters) * svgSize;

  return (
    <div className="absolute bottom-6 left-4 z-30 w-96 max-w-[calc(100vw-2rem)] bg-atlas-surface/95 border border-atlas-border backdrop-blur-md shadow-2xl p-4 font-mono text-xs text-atlas-text flex flex-col space-y-3 pointer-events-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-atlas-border pb-2">
        <div className="flex items-center space-x-2">
          <Footprints className="w-4 h-4 text-atlas-accent" />
          <span className="font-bold uppercase tracking-wider text-sm">
            Hyperlocal Tactical Grid
          </span>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setScaleMeters(scaleMeters === 100 ? 50 : 100)}
            className="p-1 hover:bg-atlas-elevated text-atlas-muted hover:text-atlas-text text-[10px] px-1.5 border border-atlas-border"
            title="Toggle Zoom"
          >
            ±{scaleMeters / 2}m
          </button>
          <button
            onClick={onClose}
            className="p-1 hover:bg-atlas-elevated text-atlas-muted hover:text-atlas-text transition-colors"
            title="Close tactical grid"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grid Canvas */}
      <div className="relative w-full aspect-square bg-[#0c1017] border border-atlas-border overflow-hidden flex items-center justify-center">
        {loading ? (
          <div className="flex flex-col items-center justify-center space-y-2 text-atlas-muted text-[11px]">
            <div className="w-6 h-6 border-2 border-atlas-accent border-t-transparent animate-spin rounded-full" />
            <span>Scanning Local 100m Micro-Relief...</span>
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${svgSize} ${svgSize}`}
            className="w-full h-full select-none"
          >
            {/* Range Rings */}
            <circle
              cx={svgSize / 2}
              cy={svgSize / 2}
              r={(svgSize / 2) * 0.33}
              fill="none"
              stroke="#223344"
              strokeDasharray="2,2"
            />
            <circle
              cx={svgSize / 2}
              cy={svgSize / 2}
              r={(svgSize / 2) * 0.66}
              fill="none"
              stroke="#223344"
              strokeDasharray="2,2"
            />
            <circle
              cx={svgSize / 2}
              cy={svgSize / 2}
              r={(svgSize / 2) * 0.95}
              fill="none"
              stroke="#334455"
            />

            {/* Crosshairs */}
            <line
              x1={0}
              y1={svgSize / 2}
              x2={svgSize}
              y2={svgSize / 2}
              stroke="#1b2533"
              strokeWidth="1"
            />
            <line
              x1={svgSize / 2}
              y1={0}
              x2={svgSize / 2}
              y2={svgSize}
              stroke="#1b2533"
              strokeWidth="1"
            />

            {/* Obstacles (Boulders & Regolith Sink) */}
            {obstacles.map((obs, idx) => {
              const cx = toSvgX(obs.x);
              const cy = toSvgY(obs.y);
              const r = Math.max(2, (obs.diameterM / scaleMeters) * svgSize * 1.5);

              if (obs.type === "REGOLITH_SINK") {
                return (
                  <circle
                    key={idx}
                    cx={cx}
                    cy={cy}
                    r={r * 1.8}
                    fill="rgba(245, 158, 11, 0.15)"
                    stroke="rgba(245, 158, 11, 0.5)"
                    strokeDasharray="2,2"
                  />
                );
              }

              return (
                <g key={idx}>
                  {obs.severity === "HIGH" && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={r + 3}
                      fill="none"
                      stroke="rgba(239, 68, 68, 0.4)"
                      strokeWidth="1"
                    />
                  )}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill={
                      obs.severity === "HIGH"
                        ? "#ef4444"
                        : obs.severity === "MODERATE"
                        ? "#f59e0b"
                        : "#64748b"
                    }
                  />
                </g>
              );
            })}

            {/* Buddy Pair Tether Line */}
            <line
              x1={toSvgX(astronautPos.x)}
              y1={toSvgY(astronautPos.y)}
              x2={toSvgX(buddyPos.x)}
              y2={toSvgY(buddyPos.y)}
              stroke={tetherViolation ? "#ef4444" : "#10b981"}
              strokeWidth="1.5"
              strokeDasharray={tetherViolation ? "4,3" : undefined}
            />

            {/* Robotic Mule */}
            <circle
              cx={toSvgX(roboticMulePos.x)}
              cy={toSvgY(roboticMulePos.y)}
              r="4"
              fill="#06b6d4"
            />
            <text
              x={toSvgX(roboticMulePos.x) + 6}
              y={toSvgY(roboticMulePos.y) + 3}
              fill="#06b6d4"
              fontSize="8"
              fontFamily="monospace"
            >
              MULE-1
            </text>

            {/* Buddy Astronaut */}
            <circle
              cx={toSvgX(buddyPos.x)}
              cy={toSvgY(buddyPos.y)}
              r="4.5"
              fill="#10b981"
            />
            <text
              x={toSvgX(buddyPos.x) + 6}
              y={toSvgY(buddyPos.y) + 3}
              fill="#10b981"
              fontSize="8"
              fontFamily="monospace"
            >
              EV-2 (Buddy)
            </text>

            {/* Primary Astronaut (EV-1) */}
            <circle
              cx={toSvgX(astronautPos.x)}
              cy={toSvgY(astronautPos.y)}
              r="5.5"
              fill="#e11d48"
              stroke="#ffffff"
              strokeWidth="1.5"
            />
            <text
              x={toSvgX(astronautPos.x) + 7}
              y={toSvgY(astronautPos.y) + 3}
              fill="#ffffff"
              fontSize="9"
              fontWeight="bold"
              fontFamily="monospace"
            >
              EV-1
            </text>
          </svg>
        )}

        {/* Compass Legend */}
        <div className="absolute top-2 left-2 text-[9px] text-atlas-muted flex items-center space-x-1">
          <Compass className="w-3 h-3 text-atlas-accent" />
          <span>N ↑</span>
        </div>

        {/* Scale Legend */}
        <div className="absolute bottom-2 right-2 text-[9px] text-atlas-muted bg-atlas-surface/80 px-1 py-0.5 border border-atlas-border">
          Grid: {scaleMeters}m
        </div>
      </div>

      {/* Telemetry Bar */}
      <div className="bg-atlas-bg/60 border border-atlas-border/60 p-2 space-y-1.5 text-[10px]">
        <div className="flex justify-between items-center">
          <span className="flex items-center space-x-1.5 text-atlas-muted">
            <Users className="w-3.5 h-3.5 text-emerald-400" />
            <span>Buddy Tether Distance:</span>
          </span>
          <span
            className={`font-bold ${
              tetherViolation ? "text-atlas-red" : "text-emerald-400"
            }`}
          >
            {tetherDist.toFixed(1)} m {tetherViolation && "(! TETHER BREACH)"}
          </span>
        </div>

        <div className="flex justify-between items-center text-atlas-muted">
          <span className="flex items-center space-x-1.5">
            <Bot className="w-3.5 h-3.5 text-cyan-400" />
            <span>Support Mule Escort:</span>
          </span>
          <span className="text-cyan-300 font-semibold">Tethered 35m Ahead</span>
        </div>

        <div className="flex justify-between items-center text-atlas-muted pt-1 border-t border-atlas-border/50">
          <span>Local Repose Stability:</span>
          <span className="text-emerald-400 font-semibold">
            {microData?.scarpReposeSafetyMarginDeg?.toFixed(1) || "19.5"}° Safe Margin
          </span>
        </div>
      </div>
    </div>
  );
};
