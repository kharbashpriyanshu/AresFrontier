import React, { useState, useEffect, useRef } from "react";
import { RoutePoint } from "../types/index.js";
import {
  Play,
  Pause,
  RotateCcw,
  X,
  Battery,
  Wind,
  Footprints,
  Radio,
  CheckCircle2,
  AlertTriangle,
  Flame,
} from "lucide-react";

export interface EvaPlaybackAnimationProps {
  route: RoutePoint[];
  isPlaying: boolean;
  onTogglePlay: () => void;
  onComplete?: () => void;
  onClose: () => void;
}

export const EvaPlaybackAnimation: React.FC<EvaPlaybackAnimationProps> = ({
  route,
  isPlaying,
  onTogglePlay,
  onComplete,
  onClose,
}) => {
  const [progress, setProgress] = useState<number>(0); // 0 to 1
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  const numWaypoints = Math.max(1, route.length);
  const totalDurationSeconds = Math.max(15, numWaypoints * 8); // 8s per waypoint for smooth visual demonstration

  useEffect(() => {
    if (!isPlaying) {
      lastTimeRef.current = null;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    const animate = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const deltaSec = (timestamp - lastTimeRef.current) / 1000;
      lastTimeRef.current = timestamp;

      setProgress((prev) => {
        const next = prev + deltaSec / totalDurationSeconds;
        if (next >= 1) {
          if (onComplete) onComplete();
          return 1;
        }
        return next;
      });

      setElapsedSeconds((prev) => prev + deltaSec);
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, totalDurationSeconds, onComplete]);

  // Derived state
  const segmentCount = Math.max(1, route.length - 1);
  const currentSegmentFloat = progress * segmentCount;
  const currentSegment = Math.min(segmentCount - 1, Math.floor(currentSegmentFloat));
  const segmentT = currentSegmentFloat - currentSegment;

  useEffect(() => {
    setActiveSegmentIndex(currentSegment);
  }, [currentSegment]);

  const handleReset = () => {
    setProgress(0);
    setElapsedSeconds(0);
    setActiveSegmentIndex(0);
  };

  // Consumables depletion calculations
  const o2Percent = Math.max(30, Math.round(100 - progress * 42)); // Maintains 30% emergency margin
  const batteryPercent = Math.max(25, Math.round(100 - progress * 55));
  const currentSpeedMs = progress > 0 && progress < 1 ? (1.05 - Math.sin(progress * Math.PI) * 0.25).toFixed(2) : "0.00";
  const metabolicWatts = progress > 0 && progress < 1 ? Math.round(230 + Math.sin(progress * Math.PI * 3) * 45) : 110;

  // Coordinate interpolation for map/canvas
  const currentCoord = (() => {
    if (route.length === 0) return { latitude: 18.4447, longitude: 77.4508 };
    if (route.length === 1 || progress <= 0) return route[0].coordinate;
    if (progress >= 1) return route[route.length - 1].coordinate;

    const pA = route[currentSegment].coordinate;
    const pB = route[Math.min(route.length - 1, currentSegment + 1)].coordinate;
    return {
      latitude: pA.latitude + (pB.latitude - pA.latitude) * segmentT,
      longitude: pA.longitude + (pB.longitude - pA.longitude) * segmentT,
    };
  })();

  // Viewbox projection for SVG (normalized to 640 x 280)
  const svgWidth = 640;
  const svgHeight = 260;
  const padding = 45;

  const lats = route.map((p) => p.coordinate.latitude);
  const lons = route.map((p) => p.coordinate.longitude);
  const minLat = Math.min(...lats, 18.41);
  const maxLat = Math.max(...lats, 18.46);
  const minLon = Math.min(...lons, 77.38);
  const maxLon = Math.max(...lons, 77.47);

  const projectToSvg = (lat: number, lon: number) => {
    const latSpan = maxLat - minLat || 0.01;
    const lonSpan = maxLon - minLon || 0.01;
    const x = padding + ((lon - minLon) / lonSpan) * (svgWidth - 2 * padding);
    const y = svgHeight - (padding + ((lat - minLat) / latSpan) * (svgHeight - 2 * padding));
    return { x, y };
  };

  const projectedPoints = route.map((p) => ({
    ...p,
    ...projectToSvg(p.coordinate.latitude, p.coordinate.longitude),
  }));

  const astronautSvgPos = projectToSvg(currentCoord.latitude, currentCoord.longitude);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="bg-atlas-surface/95 backdrop-blur-md border border-atlas-border text-atlas-text shadow-2xl p-4 font-mono text-xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-atlas-border pb-2.5">
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 rounded-full bg-atlas-teal animate-pulse" />
          <span className="font-bold uppercase tracking-wider text-sm text-atlas-text">
            EVA Traverse Real-Time Playback & Bioenergetics
          </span>
          <span className="px-1.5 py-0.5 rounded bg-atlas-elevated border border-atlas-border text-[10px] text-atlas-teal font-semibold">
            0.38G TOBLER
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-atlas-elevated text-atlas-muted hover:text-atlas-text transition-colors"
          title="Close Playback HUD"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* SVG Canvas Map */}
      <div className="relative bg-[#070d17] border border-atlas-border overflow-hidden">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-56 select-none"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <radialGradient id="craterShading" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#c1440e" stopOpacity="0.18" />
              <stop offset="80%" stopColor="#1e293b" stopOpacity="0.08" />
              <stop offset="100%" stopColor="transparent" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Background Grid Lines */}
          <g stroke="#1a2536" strokeWidth="0.5" strokeDasharray="3 3">
            <line x1="0" y1={svgHeight * 0.25} x2={svgWidth} y2={svgHeight * 0.25} />
            <line x1="0" y1={svgHeight * 0.5} x2={svgWidth} y2={svgHeight * 0.5} />
            <line x1="0" y1={svgHeight * 0.75} x2={svgWidth} y2={svgHeight * 0.75} />
            <line x1={svgWidth * 0.25} y1="0" x2={svgWidth * 0.25} y2={svgHeight} />
            <line x1={svgWidth * 0.5} y1="0" x2={svgWidth * 0.5} y2={svgHeight} />
            <line x1={svgWidth * 0.75} y1="0" x2={svgWidth * 0.75} y2={svgHeight} />
          </g>

          {/* Geological Crater contours */}
          <circle cx={svgWidth * 0.45} cy={svgHeight * 0.52} r="85" fill="url(#craterShading)" stroke="#223348" strokeWidth="1" strokeDasharray="4 4" />
          <circle cx={svgWidth * 0.75} cy={svgHeight * 0.35} r="45" fill="url(#craterShading)" stroke="#223348" strokeWidth="0.8" />

          {/* Route path backdrop */}
          {projectedPoints.length > 1 && (
            <path
              d={projectedPoints.reduce((acc, curr, i) => `${acc} ${i === 0 ? "M" : "L"} ${curr.x} ${curr.y}`, "")}
              fill="none"
              stroke="#2e3f55"
              strokeWidth="4"
              strokeLinecap="round"
            />
          )}

          {/* Route path animated line */}
          {projectedPoints.length > 1 && (
            <path
              d={projectedPoints.reduce((acc, curr, i) => `${acc} ${i === 0 ? "M" : "L"} ${curr.x} ${curr.y}`, "")}
              fill="none"
              stroke="#c1440e"
              strokeWidth="2.5"
              strokeDasharray="6 4"
              strokeLinecap="round"
            />
          )}

          {/* Waypoints */}
          {projectedPoints.map((pt, i) => {
            const isPassed = i <= activeSegmentIndex && progress > 0;
            const isNext = i === activeSegmentIndex + 1;
            return (
              <g key={pt.id || i}>
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={i === 0 || i === projectedPoints.length - 1 ? 6 : 4.5}
                  fill={isPassed ? "#06b6d4" : isNext ? "#f59e0b" : "#334155"}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
                <text
                  x={pt.x + 8}
                  y={pt.y - 6}
                  fill={isPassed ? "#e2e8f0" : "#94a3b8"}
                  fontSize="9"
                  fontFamily="monospace"
                  fontWeight={isPassed ? "bold" : "normal"}
                >
                  {i === 0 ? "START" : i === projectedPoints.length - 1 ? "FINISH" : `WP${i}`}
                </text>
              </g>
            );
          })}

          {/* Astronaut Position Marker */}
          <g transform={`translate(${astronautSvgPos.x}, ${astronautSvgPos.y})`}>
            <circle r="14" fill="#06b6d4" fillOpacity="0.25" className="animate-ping" />
            <circle r="7" fill="#06b6d4" stroke="#ffffff" strokeWidth="2" />
            <circle r="2.5" fill="#ffffff" />
          </g>
        </svg>

        {/* Floating Telemetry Box inside canvas */}
        <div className="absolute top-2 left-2 bg-atlas-surface/90 border border-atlas-border p-2 space-y-1 text-[10px] backdrop-blur-sm">
          <div className="text-atlas-muted flex items-center space-x-1">
            <Footprints className="w-3 h-3 text-atlas-teal" />
            <span>LAT / LON</span>
          </div>
          <div className="font-bold text-atlas-text">
            {currentCoord.latitude.toFixed(4)}°N, {currentCoord.longitude.toFixed(4)}°E
          </div>
        </div>

        <div className="absolute top-2 right-2 bg-atlas-surface/90 border border-atlas-border p-2 space-y-1 text-[10px] backdrop-blur-sm text-right">
          <div className="text-atlas-muted flex items-center justify-end space-x-1">
            <Radio className="w-3 h-3 text-atlas-teal" />
            <span>MRO RELAY</span>
          </div>
          <div className="font-bold text-emerald-400">ACTIVE (X-BAND)</div>
        </div>
      </div>

      {/* Traversal Progress Bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-atlas-muted">
          <span>TRAVERSE PROGRESS</span>
          <span className="font-bold text-atlas-text">{(progress * 100).toFixed(1)}%</span>
        </div>
        <div className="w-full h-2 bg-atlas-elevated border border-atlas-border overflow-hidden rounded-sm">
          <div
            className="h-full bg-gradient-to-r from-atlas-teal via-atlas-blue to-atlas-accent transition-all duration-100"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>

      {/* Telemetry Dashboard Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="p-2 bg-atlas-elevated border border-atlas-border space-y-1">
          <div className="text-[10px] text-atlas-muted flex items-center space-x-1">
            <Wind className="w-3 h-3 text-atlas-blue" />
            <span>O₂ PRESSURE</span>
          </div>
          <div className="text-sm font-bold text-atlas-text flex items-center justify-between">
            <span>{o2Percent}%</span>
            <span className="text-[9px] text-atlas-teal font-normal">NOMINAL</span>
          </div>
        </div>

        <div className="p-2 bg-atlas-elevated border border-atlas-border space-y-1">
          <div className="text-[10px] text-atlas-muted flex items-center space-x-1">
            <Battery className="w-3 h-3 text-atlas-amber" />
            <span>SUIT BATTERY</span>
          </div>
          <div className="text-sm font-bold text-atlas-text flex items-center justify-between">
            <span>{batteryPercent}%</span>
            <span className="text-[9px] text-atlas-muted font-normal">24V DC</span>
          </div>
        </div>

        <div className="p-2 bg-atlas-elevated border border-atlas-border space-y-1">
          <div className="text-[10px] text-atlas-muted flex items-center space-x-1">
            <Flame className="w-3 h-3 text-atlas-accent" />
            <span>METABOLIC RATE</span>
          </div>
          <div className="text-sm font-bold text-atlas-text flex items-center justify-between">
            <span>{metabolicWatts} W</span>
            <span className="text-[9px] text-atlas-muted font-normal">{currentSpeedMs} m/s</span>
          </div>
        </div>

        <div className="p-2 bg-atlas-elevated border border-atlas-border space-y-1">
          <div className="text-[10px] text-atlas-muted flex items-center space-x-1">
            <CheckCircle2 className="w-3 h-3 text-atlas-teal" />
            <span>SIM TIME</span>
          </div>
          <div className="text-sm font-bold text-atlas-teal flex items-center justify-between">
            <span>{formatTime(elapsedSeconds)}</span>
            <span className="text-[9px] text-atlas-muted font-normal">SOL 100</span>
          </div>
        </div>
      </div>

      {/* Safety Margin Indicator */}
      <div className="p-2 bg-atlas-elevated/70 border border-atlas-border flex items-center justify-between text-[11px]">
        <div className="flex items-center space-x-2">
          <AlertTriangle className="w-3.5 h-3.5 text-atlas-teal" />
          <span className="text-atlas-muted">NASA Safety Invariant S3:</span>
          <span className="text-atlas-text font-bold">30-min Emergency O₂ Margin Preserved</span>
        </div>
        <span className="text-emerald-400 font-bold">STATUS: SAFE</span>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center space-x-2">
          <button
            onClick={onTogglePlay}
            className={`px-4 py-2 flex items-center space-x-1.5 text-xs font-bold transition-all shadow-sm ${
              isPlaying
                ? "bg-atlas-amber hover:bg-amber-600 text-slate-950"
                : "bg-atlas-teal hover:bg-cyan-600 text-slate-950"
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>PAUSE</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>{progress >= 1 ? "REPLAY" : "PLAY TRAVERSE"}</span>
              </>
            )}
          </button>

          <button
            onClick={handleReset}
            className="px-3 py-2 bg-atlas-surface hover:bg-atlas-elevated border border-atlas-border text-atlas-muted hover:text-atlas-text flex items-center space-x-1 text-xs"
            title="Reset to Start"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>RESET</span>
          </button>
        </div>

        <div className="text-[10px] text-atlas-muted">
          Active Waypoint:{" "}
          <span className="text-atlas-accent font-bold">
            {route[activeSegmentIndex]?.label || "Origin Base"}
          </span>
        </div>
      </div>
    </div>
  );
};
