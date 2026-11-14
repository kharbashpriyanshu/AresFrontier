import React, { useState, useEffect } from "react";
import { api } from "../services/api.js";
import { MarsCoordinate } from "../types/index.js";
import {
  Compass,
  Footprints,
  Users,
  X,
  ShieldCheck,
  Info,
  Radar,
} from "lucide-react";

interface HyperlocalTacticalGridProps {
  coordinate: MarsCoordinate;
  onClose: () => void;
}

interface TacticalObstacle {
  id: number;
  x: number; // meters from center (-scale/2 to +scale/2)
  y: number; // meters from center (-scale/2 to +scale/2)
  diameterM: number;
  severity: "LOW" | "MODERATE" | "HIGH";
  type: "BOULDER" | "REGOLITH_SINK";
  label: string;
}

export const HyperlocalTacticalGrid: React.FC<HyperlocalTacticalGridProps> = ({
  coordinate,
  onClose,
}) => {
  const [scaleMeters, setScaleMeters] = useState<number>(100); // 50m, 100m, or 200m
  const [loading, setLoading] = useState<boolean>(true);
  const [microData, setMicroData] = useState<any>(null);
  const [selectedObstacle, setSelectedObstacle] = useState<TacticalObstacle | null>(null);
  const [showExplanation, setShowExplanation] = useState<boolean>(false);

  // Dynamic tactical entities relative to excursion focal center (0, 0)
  const [astronautPos, setAstronautPos] = useState({ x: 0, y: 0 });
  const [buddyOffset, setBuddyOffset] = useState({ x: 38, y: -45 });
  const [muleOffset, setMuleOffset] = useState({ x: -18, y: 28 });
  const [obstacles, setObstacles] = useState<TacticalObstacle[]>([]);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setSelectedObstacle(null);

    api
      .getMicroTerrainObstacles(coordinate.latitude, coordinate.longitude)
      .then((res: any) => {
        if (!isMounted) return;
        setMicroData(res);

        // Extract genuine NASA Golombek rock & hazard properties
        const golombek = res?.golombekRockDistribution;
        const halfMeterDensity = golombek?.bouldersOverHalfMeterPer100m2 ?? 3.5;
        const oneMeterDensity = golombek?.bouldersOverOneMeterPer100m2 ?? 1.2;
        const regolithRisk = res?.looseRegolithEntrapment?.entrapmentRiskLevel ?? "NEGLIGIBLE";
        const bootSinkage = res?.looseRegolithEntrapment?.estimatedWheelOrBootSinkageCm ?? 2.5;

        // Generate deterministic obstacle field based on rock abundance and coordinate seed
        const targetCount = Math.min(38, Math.max(12, Math.round(halfMeterDensity * 3.5)));
        const generated: TacticalObstacle[] = [];

        // Pseudo-random seed derived deterministically from coordinates
        let seed = Math.abs(Math.sin(coordinate.latitude * 1000 + coordinate.longitude * 500));
        const pseudoRand = () => {
          seed = (seed * 9301 + 49297) % 233280;
          return seed / 233280;
        };

        // Populate boulders
        for (let i = 0; i < targetCount; i++) {
          const r = (scaleMeters / 2) * (0.12 + pseudoRand() * 0.82);
          const theta = pseudoRand() * Math.PI * 2;
          const x = Number((Math.cos(theta) * r).toFixed(1));
          const y = Number((Math.sin(theta) * r).toFixed(1));

          const isLarge = pseudoRand() < oneMeterDensity / Math.max(1, halfMeterDensity);
          const diameter = Number((isLarge ? 0.95 + pseudoRand() * 1.3 : 0.35 + pseudoRand() * 0.55).toFixed(2));
          const severity: "LOW" | "MODERATE" | "HIGH" = diameter > 1.0 ? "HIGH" : diameter > 0.6 ? "MODERATE" : "LOW";

          generated.push({
            id: i + 1,
            x,
            y,
            diameterM: diameter,
            severity,
            type: "BOULDER",
            label: `${diameter}m ${severity === "HIGH" ? "Basalt Scarp Boulder" : "Regolith Rock Fragment"}`,
          });
        }

        // Populate loose regolith sink hazards if dust/sinkage risk is present
        if (regolithRisk !== "NEGLIGIBLE") {
          const sinkCount = regolithRisk === "PURGATORY_ANALOG" ? 5 : 2;
          for (let s = 0; s < sinkCount; s++) {
            const r = (scaleMeters / 2) * (0.25 + pseudoRand() * 0.65);
            const theta = pseudoRand() * Math.PI * 2;
            generated.push({
              id: targetCount + s + 1,
              x: Number((Math.cos(theta) * r).toFixed(1)),
              y: Number((Math.sin(theta) * r).toFixed(1)),
              diameterM: Number((bootSinkage * 0.2).toFixed(1)),
              severity: regolithRisk === "PURGATORY_ANALOG" ? "HIGH" : "MODERATE",
              type: "REGOLITH_SINK",
              label: `Unconsolidated Eolian Dune Drift (${bootSinkage}cm sinkage)`,
            });
          }
        }

        // Dynamically shift buddy pair and escort positions based on terrain seed
        setBuddyOffset({
          x: Number((32 + pseudoRand() * 24).toFixed(1)),
          y: Number((-35 - pseudoRand() * 30).toFixed(1)),
        });
        setMuleOffset({
          x: Number((-15 - pseudoRand() * 15).toFixed(1)),
          y: Number((22 + pseudoRand() * 18).toFixed(1)),
        });

        setObstacles(generated);
        setLoading(false);
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [coordinate.latitude, coordinate.longitude, scaleMeters]);

  // Compute live Euclidean buddy tether distance
  const buddyWorldPos = { x: astronautPos.x + buddyOffset.x, y: astronautPos.y + buddyOffset.y };
  const muleWorldPos = { x: astronautPos.x + muleOffset.x, y: astronautPos.y + muleOffset.y };
  const dx = buddyWorldPos.x - astronautPos.x;
  const dy = buddyWorldPos.y - astronautPos.y;
  const tetherDist = Math.hypot(dx, dy);
  const tetherViolation = tetherDist > 150;

  // Coordinate mapping into SVG [-scale/2, scale/2] -> [0, 320]
  const svgSize = 320;
  const toSvgX = (mX: number) => ((mX + scaleMeters / 2) / scaleMeters) * svgSize;
  const toSvgY = (mY: number) => ((-mY + scaleMeters / 2) / scaleMeters) * svgSize;

  // Click on radar to reposition EV-1
  const handleRadarClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const mX = (clickX / svgSize) * scaleMeters - scaleMeters / 2;
    const mY = -((clickY / svgSize) * scaleMeters - scaleMeters / 2);
    // Constrain within radar range
    if (Math.hypot(mX, mY) <= scaleMeters * 0.45) {
      setAstronautPos({ x: Number(mX.toFixed(1)), y: Number(mY.toFixed(1)) });
      setSelectedObstacle(null);
    }
  };

  const golombek = microData?.golombekRockDistribution;
  const scarp = microData?.scarpAndSlopeHazards;
  const regolith = microData?.looseRegolithEntrapment;

  return (
    <div className="absolute bottom-6 left-4 z-40 w-96 max-w-[calc(100vw-2rem)] bg-atlas-surface/95 border border-atlas-border backdrop-blur-md shadow-2xl p-4 font-mono text-xs text-atlas-text flex flex-col space-y-3 pointer-events-auto select-none animate-in fade-in zoom-in-95 duration-150">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-atlas-border pb-2">
        <div className="flex items-center space-x-2">
          <Footprints className="w-4 h-4 text-atlas-accent" />
          <div>
            <span className="font-bold uppercase tracking-wider text-sm flex items-center space-x-1.5">
              <span>Hyperlocal Tactical Grid</span>
            </span>
            <div className="text-[10px] text-atlas-muted font-normal">
              ±{scaleMeters / 2}m Excursion Radar · {coordinate.latitude.toFixed(4)}°N, {coordinate.longitude.toFixed(4)}°E
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setShowExplanation(!showExplanation)}
            className={`p-1 border border-atlas-border text-[10px] px-1.5 transition-colors ${
              showExplanation
                ? "bg-atlas-accent text-white font-bold"
                : "hover:bg-atlas-elevated text-atlas-muted hover:text-atlas-text"
            }`}
            title="What is this Tactical Grid?"
          >
            <Info className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setScaleMeters(scaleMeters === 100 ? 50 : 100)}
            className="p-1 hover:bg-atlas-elevated text-atlas-muted hover:text-atlas-text text-[10px] px-1.5 border border-atlas-border"
            title="Toggle Radar Range Scale"
          >
            Range: ±{scaleMeters / 2}m
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

      {/* Explanatory Banner (Collapsible) */}
      {showExplanation && (
        <div className="p-2.5 bg-atlas-elevated/90 border border-atlas-border text-[10px] space-y-1.5 leading-relaxed text-atlas-muted">
          <div className="text-atlas-text font-bold flex items-center space-x-1">
            <Radar className="w-3.5 h-3.5 text-atlas-teal" />
            <span>How This Hyperlocal Radar Works:</span>
          </div>
          <p>
            NASA astronaut EVAs operate strictly under a <strong className="text-atlas-text">2-person buddy rule</strong> (EV-1 & EV-2) accompanied by an autonomous robotic carrier (<strong className="text-atlas-text">MULE-1</strong>).
          </p>
          <p>
            This tactical display models sub-meter hazards from NASA Golombek rock size-frequency distributions, monitoring buddy separation (&lt;150m safety limit) and identifying unpassable boulders and loose regolith sink traps.
          </p>
          <p className="text-atlas-accent">
            Tip: Click anywhere on the radar circle to reposition EV-1 or inspect any obstacle.
          </p>
        </div>
      )}

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
            className="w-full h-full cursor-crosshair"
            onClick={handleRadarClick}
          >
            {/* Concentric Distance Rings */}
            <circle
              cx={svgSize / 2}
              cy={svgSize / 2}
              r={(svgSize / 2) * 0.25}
              fill="none"
              stroke="#1b2533"
              strokeDasharray="2,2"
            />
            <circle
              cx={svgSize / 2}
              cy={svgSize / 2}
              r={(svgSize / 2) * 0.5}
              fill="none"
              stroke="#223344"
              strokeDasharray="2,2"
            />
            <circle
              cx={svgSize / 2}
              cy={svgSize / 2}
              r={(svgSize / 2) * 0.75}
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
              strokeWidth="1.5"
            />

            {/* Crosshairs */}
            <line x1={0} y1={svgSize / 2} x2={svgSize} y2={svgSize / 2} stroke="#1b2533" strokeWidth="1" />
            <line x1={svgSize / 2} y1={0} x2={svgSize / 2} y2={svgSize} stroke="#1b2533" strokeWidth="1" />

            {/* Range Annotations */}
            <text x={svgSize / 2 + 3} y={toSvgY(scaleMeters * 0.25) - 3} fill="#475569" fontSize="8" fontFamily="monospace">
              {Math.round(scaleMeters * 0.25)}m
            </text>
            <text x={svgSize / 2 + 3} y={toSvgY(scaleMeters * 0.5) - 3} fill="#475569" fontSize="8" fontFamily="monospace">
              {Math.round(scaleMeters * 0.5)}m
            </text>

            {/* Obstacles (Boulders & Regolith Sink) */}
            {obstacles.map((obs) => {
              const cx = toSvgX(obs.x);
              const cy = toSvgY(obs.y);
              const r = Math.max(3, (obs.diameterM / scaleMeters) * svgSize * 1.6);
              const isSelected = selectedObstacle?.id === obs.id;

              if (obs.type === "REGOLITH_SINK") {
                return (
                  <g
                    key={obs.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedObstacle(obs);
                    }}
                    className="cursor-pointer"
                  >
                    <circle
                      cx={cx}
                      cy={cy}
                      r={r * 1.8}
                      fill="rgba(245, 158, 11, 0.2)"
                      stroke={isSelected ? "#ffffff" : "rgba(245, 158, 11, 0.7)"}
                      strokeWidth={isSelected ? "2" : "1"}
                      strokeDasharray="2,2"
                    />
                  </g>
                );
              }

              return (
                <g
                  key={obs.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedObstacle(obs);
                  }}
                  className="cursor-pointer"
                >
                  {obs.severity === "HIGH" && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={r + 3}
                      fill="none"
                      stroke="rgba(239, 68, 68, 0.5)"
                      strokeWidth="1"
                    />
                  )}
                  {isSelected && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={r + 5}
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                      strokeDasharray="3,2"
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
              x2={toSvgX(buddyWorldPos.x)}
              y2={toSvgY(buddyWorldPos.y)}
              stroke={tetherViolation ? "#ef4444" : "#10b981"}
              strokeWidth="1.5"
              strokeDasharray={tetherViolation ? "4,3" : undefined}
            />

            {/* Robotic Mule Escort */}
            <g>
              <circle
                cx={toSvgX(muleWorldPos.x)}
                cy={toSvgY(muleWorldPos.y)}
                r="4.5"
                fill="#06b6d4"
                stroke="#ffffff"
                strokeWidth="1"
              />
              <text
                x={toSvgX(muleWorldPos.x) + 6}
                y={toSvgY(muleWorldPos.y) + 3}
                fill="#06b6d4"
                fontSize="8"
                fontWeight="bold"
                fontFamily="monospace"
              >
                MULE-1
              </text>
            </g>

            {/* Buddy Astronaut (EV-2) */}
            <g>
              <circle
                cx={toSvgX(buddyWorldPos.x)}
                cy={toSvgY(buddyWorldPos.y)}
                r="5"
                fill="#10b981"
                stroke="#ffffff"
                strokeWidth="1"
              />
              <text
                x={toSvgX(buddyWorldPos.x) + 6}
                y={toSvgY(buddyWorldPos.y) + 3}
                fill="#10b981"
                fontSize="8"
                fontWeight="bold"
                fontFamily="monospace"
              >
                EV-2 (Buddy)
              </text>
            </g>

            {/* Primary Astronaut (EV-1 / Lead) */}
            <g>
              <circle
                cx={toSvgX(astronautPos.x)}
                cy={toSvgY(astronautPos.y)}
                r="6"
                fill="#e11d48"
                stroke="#ffffff"
                strokeWidth="1.5"
              />
              <circle
                cx={toSvgX(astronautPos.x)}
                cy={toSvgY(astronautPos.y)}
                r="9"
                fill="none"
                stroke="#e11d48"
                strokeWidth="1"
                opacity="0.5"
              />
              <text
                x={toSvgX(astronautPos.x) + 8}
                y={toSvgY(astronautPos.y) + 3}
                fill="#ffffff"
                fontSize="9"
                fontWeight="bold"
                fontFamily="monospace"
              >
                EV-1 (You)
              </text>
            </g>
          </svg>
        )}

        {/* Compass & Legend */}
        <div className="absolute top-2 left-2 text-[9px] text-atlas-muted flex items-center space-x-1 pointer-events-none">
          <Compass className="w-3 h-3 text-atlas-accent" />
          <span>North ↑</span>
        </div>

        {/* Scale Legend */}
        <div className="absolute bottom-2 right-2 text-[9px] text-atlas-muted bg-atlas-surface/80 px-1 py-0.5 border border-atlas-border pointer-events-none">
          Grid: {scaleMeters}m
        </div>
      </div>

      {/* Selected Obstacle Inspector Detail */}
      {selectedObstacle && (
        <div className="p-2 bg-atlas-elevated border border-atlas-accent text-[11px] flex items-center justify-between">
          <div>
            <div className="font-bold text-atlas-text">{selectedObstacle.label}</div>
            <div className="text-[10px] text-atlas-muted">
              Rel. Distance: {Math.hypot(selectedObstacle.x - astronautPos.x, selectedObstacle.y - astronautPos.y).toFixed(1)}m · Severity: {selectedObstacle.severity}
            </div>
          </div>
          <button
            onClick={() => setSelectedObstacle(null)}
            className="text-atlas-muted hover:text-atlas-text text-[10px] px-1.5 py-0.5 border border-atlas-border"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Telemetry Bar & Scientific Invariants */}
      <div className="bg-atlas-bg/60 border border-atlas-border/60 p-2 space-y-1.5 text-[10px]">
        {/* Buddy Tether */}
        <div className="flex justify-between items-center">
          <span className="flex items-center space-x-1.5 text-atlas-muted">
            <Users className="w-3.5 h-3.5 text-emerald-400" />
            <span>Buddy Tether Distance:</span>
          </span>
          <span className={`font-bold ${tetherViolation ? "text-atlas-red" : "text-emerald-400"}`}>
            {tetherDist.toFixed(1)} m {tetherViolation ? "(! TETHER BREACH)" : "(NOMINAL < 150m)"}
          </span>
        </div>

        {/* Traversability & Rock Cover */}
        <div className="flex justify-between items-center text-atlas-muted">
          <span className="flex items-center space-x-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-atlas-teal" />
            <span>Golombek Traversability:</span>
          </span>
          <span className="text-atlas-teal font-semibold">
            {golombek?.traversabilityIndex ?? 85}/100 (Rock Cover: {golombek?.cumulativeRockCoverFraction ? (golombek.cumulativeRockCoverFraction * 100).toFixed(1) : "8.0"}%)
          </span>
        </div>

        {/* Boot Sinkage & Slope Repose Margin */}
        <div className="flex justify-between items-center text-atlas-muted pt-1 border-t border-atlas-border/50">
          <span>Est. Boot Sinkage:</span>
          <span className="text-atlas-amber font-semibold">
            {regolith?.estimatedWheelOrBootSinkageCm?.toFixed(1) ?? "2.5"} cm ({regolith?.entrapmentRiskLevel ?? "NEGLIGIBLE"})
          </span>
        </div>

        <div className="flex justify-between items-center text-atlas-muted">
          <span>Scarp Avalanche Margin:</span>
          <span className="text-emerald-400 font-semibold">
            {scarp?.reposeAngleMarginDegrees?.toFixed(1) ?? "27.5"}° to Mars Repose Limit (34°)
          </span>
        </div>
      </div>
    </div>
  );
};
