import React, { useState, useEffect, useRef, useMemo } from "react";
import { RoutePoint, FlyoverCameraState } from "../types/index.js";
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
  Video,
  Compass,
  Eye,
  Navigation2,
  Layers,
  Crosshair,
} from "lucide-react";

export interface EvaPlaybackAnimationProps {
  route: RoutePoint[];
  isPlaying: boolean;
  onTogglePlay: () => void;
  onComplete?: () => void;
  onClose: () => void;
  initialFlyoverMode?: boolean;
  onFlyoverUpdate?: (camera: FlyoverCameraState | null) => void;
}

export const EvaPlaybackAnimation: React.FC<EvaPlaybackAnimationProps> = ({
  route,
  isPlaying,
  onTogglePlay,
  onComplete,
  onClose,
  initialFlyoverMode = false,
  onFlyoverUpdate,
}) => {
  const [playbackMode, setPlaybackMode] = useState<"bioenergetics" | "flyover">(
    initialFlyoverMode ? "flyover" : "bioenergetics"
  );
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

  // Calculate physical distances between waypoints for continuous velocity
  const segmentDistances = useMemo(() => {
    if (route.length < 2) return [1];
    const dists: number[] = [];
    for (let i = 0; i < route.length - 1; i++) {
      const p1 = route[i].coordinate;
      const p2 = route[i + 1].coordinate;
      const dLat = (p2.latitude - p1.latitude) * 59.3;
      const dLon = (p2.longitude - p1.longitude) * 59.3 * Math.cos((p1.latitude * Math.PI) / 180);
      const d = Math.hypot(dLat, dLon);
      dists.push(Math.max(0.001, d));
    }
    return dists;
  }, [route]);

  const totalTraverseDistance = useMemo(() => {
    return segmentDistances.reduce((acc, d) => acc + d, 0);
  }, [segmentDistances]);

  // Derive continuous physical interpolation across segments
  const { currentSegment, segmentT } = useMemo(() => {
    if (route.length < 2) return { currentSegment: 0, segmentT: 0 };
    if (progress <= 0) return { currentSegment: 0, segmentT: 0 };
    if (progress >= 1) return { currentSegment: route.length - 2, segmentT: 1 };

    let accumulated = 0;
    const targetDist = progress * totalTraverseDistance;

    for (let i = 0; i < segmentDistances.length; i++) {
      const segLen = segmentDistances[i];
      if (accumulated + segLen >= targetDist || i === segmentDistances.length - 1) {
        const segProgress = (targetDist - accumulated) / segLen;
        return {
          currentSegment: i,
          segmentT: Math.max(0, Math.min(1, segProgress)),
        };
      }
      accumulated += segLen;
    }
    return { currentSegment: 0, segmentT: 0 };
  }, [progress, route, segmentDistances, totalTraverseDistance]);

  useEffect(() => {
    setActiveSegmentIndex(currentSegment);
  }, [currentSegment]);

  const handleReset = () => {
    setProgress(0);
    setElapsedSeconds(0);
    setActiveSegmentIndex(0);
  };

  // Consumables depletion calculations (Tobler pace)
  const o2Percent = Math.max(30, Math.round(100 - progress * 42)); // Maintains 30% emergency margin
  const batteryPercent = Math.max(25, Math.round(100 - progress * 55));
  const currentSpeedMs = progress > 0 && progress < 1 ? (1.05 - Math.sin(progress * Math.PI) * 0.25).toFixed(2) : "0.00";
  const metabolicWatts = progress > 0 && progress < 1 ? Math.round(230 + Math.sin(progress * Math.PI * 3) * 45) : 110;

  // Coordinate interpolation for map/canvas
  const currentCoord = useMemo(() => {
    if (route.length === 0) return { latitude: 18.4447, longitude: 77.4508 };
    if (route.length === 1 || progress <= 0) return route[0].coordinate;
    if (progress >= 1) return route[route.length - 1].coordinate;

    const pA = route[currentSegment].coordinate;
    const pB = route[Math.min(route.length - 1, currentSegment + 1)].coordinate;
    return {
      latitude: pA.latitude + (pB.latitude - pA.latitude) * segmentT,
      longitude: pA.longitude + (pB.longitude - pA.longitude) * segmentT,
    };
  }, [route, progress, currentSegment, segmentT]);

  // Derived 2.5D Orbit-to-Ground Camera State
  const flyoverCameraState = useMemo<FlyoverCameraState | null>(() => {
    if (playbackMode !== "flyover") return null;

    const nextIdx = Math.min(route.length - 1, currentSegment + 1);
    const p1 = currentCoord;
    const p2 = route[nextIdx]?.coordinate || currentCoord;
    const dLat = (p2.latitude - p1.latitude) * 59.3;
    const dLon = (p2.longitude - p1.longitude) * 59.3 * Math.cos((p1.latitude * Math.PI) / 180);
    const headingRad = Math.atan2(dLon, dLat);
    const headingDeg = Math.round(((headingRad * 180) / Math.PI + 360) % 360);

    let phase: FlyoverCameraState["phase"] = "ORBITAL_RECON";
    let altitudeM = 180000;
    let pitchDeg = -70;
    let zoom = 6;
    let annotation = "MRO Reconnaissance Orbit: Ingress Trajectory toward Jezero Basin";

    if (progress < 0.15) {
      phase = "ORBITAL_RECON";
      const t = progress / 0.15;
      altitudeM = Math.round(180000 - t * 135000); // 180 km -> 45 km
      pitchDeg = Math.round(-75 + t * 5); // -75° -> -70°
      zoom = t < 0.5 ? 6 : 7;
      annotation = `MRO High Orbit: Synoptic Ingress Corridor (Alt: ${(altitudeM / 1000).toFixed(1)} km, Pitch: ${pitchDeg}°)`;
    } else if (progress < 0.35) {
      phase = "DESCENT_CORRIDOR";
      const t = (progress - 0.15) / 0.2;
      altitudeM = Math.round(45000 - t * 37000); // 45 km -> 8 km
      pitchDeg = Math.round(-70 + t * 20); // -70° -> -50°
      zoom = t < 0.5 ? 8 : 9;
      annotation = `Atmospheric Descent Corridor: Resolving SIM 3464 Units (Alt: ${(altitudeM / 1000).toFixed(1)} km, Pitch: ${pitchDeg}°)`;
    } else {
      const t = (progress - 0.35) / 0.65;
      phase = progress > 0.85 ? "LOW_PASS" : "WAYPOINT_INGRESS";
      altitudeM = Math.round(8000 - t * 7350); // 8 km -> 650 m
      pitchDeg = Math.round(-50 + t * 18); // -50° -> -32°
      zoom = t < 0.3 ? 10 : 11;
      const targetLabel = route[activeSegmentIndex]?.label || "Scientific Outcrop";
      annotation = `Tactical Oblique Flyover: Tracking ${targetLabel} (Alt: ${altitudeM} m, Pitch: ${pitchDeg}°)`;
    }

    return {
      isActive: true,
      latitude: currentCoord.latitude,
      longitude: currentCoord.longitude,
      zoom,
      pitchDeg,
      altitudeM,
      phase,
      targetName: route[activeSegmentIndex]?.label || "Jezero Base",
      stratigraphicUnit: "SIM 3464 (Hdf Delta Fan / Nm-flr)",
      elevationMola: route[activeSegmentIndex]?.elevationM || -2530,
      headingDeg,
      annotation,
    };
  }, [playbackMode, progress, currentCoord, currentSegment, route, activeSegmentIndex]);

  // Synchronize flyover camera state with parent/map
  useEffect(() => {
    if (onFlyoverUpdate) {
      onFlyoverUpdate(flyoverCameraState);
    }
  }, [flyoverCameraState, onFlyoverUpdate]);

  // Clean up flyover state on unmount
  useEffect(() => {
    return () => {
      if (onFlyoverUpdate) {
        onFlyoverUpdate(null);
      }
    };
  }, [onFlyoverUpdate]);

  // Viewbox projection for SVG (normalized to 640 x 260)
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
            {playbackMode === "flyover"
              ? "Simulated 2.5D Orbit-to-Ground Route Flyover"
              : "EVA Traverse Real-Time Playback & Bioenergetics"}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-atlas-elevated border border-atlas-border text-[10px] text-atlas-teal font-semibold">
            {playbackMode === "flyover" ? "MRO / HiRISE DTM" : "0.38G TOBLER"}
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

      {/* Mode Switcher Tabs */}
      <div className="flex border-b border-atlas-border -mt-1 pb-2 gap-2 text-[11px]">
        <button
          onClick={() => setPlaybackMode("bioenergetics")}
          className={`flex-1 py-1.5 px-3 border flex items-center justify-center space-x-1.5 transition-all ${
            playbackMode === "bioenergetics"
              ? "bg-atlas-elevated text-atlas-teal border-atlas-teal font-bold shadow-sm"
              : "bg-atlas-surface/60 border-atlas-border text-atlas-muted hover:text-atlas-text"
          }`}
        >
          <Footprints className="w-3.5 h-3.5 text-atlas-teal" />
          <span>0.38G Bioenergetics</span>
        </button>

        <button
          onClick={() => setPlaybackMode("flyover")}
          className={`flex-1 py-1.5 px-3 border flex items-center justify-center space-x-1.5 transition-all ${
            playbackMode === "flyover"
              ? "bg-atlas-elevated text-atlas-accent border-atlas-accent font-bold shadow-sm ring-1 ring-atlas-accent/30"
              : "bg-atlas-surface/60 border-atlas-border text-atlas-muted hover:text-atlas-text"
          }`}
        >
          <Video className="w-3.5 h-3.5 text-atlas-accent animate-pulse" />
          <span>2.5D Orbit-to-Ground Flyover</span>
        </button>
      </div>

      {/* SVG Canvas Map / Flight Reconnaissance Viewport */}
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
            <linearGradient id="flightVectorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#c1440e" stopOpacity="0.2" />
            </linearGradient>
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

          {/* 2.5D Artificial Horizon / Flight Attitude Lines (when Flyover Active) */}
          {playbackMode === "flyover" && (
            <g opacity="0.35">
              <line x1={svgWidth * 0.2} y1={svgHeight * 0.5} x2={svgWidth * 0.8} y2={svgHeight * 0.5} stroke="#06b6d4" strokeWidth="1" strokeDasharray="12 4" />
              <line x1={svgWidth * 0.35} y1={svgHeight * 0.38} x2={svgWidth * 0.65} y2={svgHeight * 0.38} stroke="#06b6d4" strokeWidth="0.75" />
              <line x1={svgWidth * 0.35} y1={svgHeight * 0.62} x2={svgWidth * 0.65} y2={svgHeight * 0.62} stroke="#06b6d4" strokeWidth="0.75" />
              <text x={svgWidth * 0.66} y={svgHeight * 0.39} fill="#06b6d4" fontSize="8" fontFamily="monospace">-20°</text>
              <text x={svgWidth * 0.66} y={svgHeight * 0.63} fill="#06b6d4" fontSize="8" fontFamily="monospace">-45°</text>
            </g>
          )}

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
              stroke={playbackMode === "flyover" ? "#f59e0b" : "#c1440e"}
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

          {/* Camera / Astronaut Position Marker */}
          <g transform={`translate(${astronautSvgPos.x}, ${astronautSvgPos.y})`}>
            {playbackMode === "flyover" ? (
              <>
                {/* 2.5D Targeting Reticle & Orientation Cone */}
                <circle r="18" fill="#f59e0b" fillOpacity="0.15" className="animate-ping" />
                <rect x="-10" y="-10" width="20" height="20" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3 2" />
                <circle r="3" fill="#f59e0b" />
                {/* Forward Heading Vector */}
                {flyoverCameraState && (
                  <line
                    x1="0"
                    y1="0"
                    x2={25 * Math.sin((flyoverCameraState.headingDeg * Math.PI) / 180)}
                    y2={-25 * Math.cos((flyoverCameraState.headingDeg * Math.PI) / 180)}
                    stroke="#06b6d4"
                    strokeWidth="2"
                    markerEnd="url(#arrow)"
                  />
                )}
              </>
            ) : (
              <>
                <circle r="14" fill="#06b6d4" fillOpacity="0.25" className="animate-ping" />
                <circle r="7" fill="#06b6d4" stroke="#ffffff" strokeWidth="2" />
                <circle r="2.5" fill="#ffffff" />
              </>
            )}
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

        {/* Flight HUD Overlay Banner inside canvas (Flyover Mode) */}
        {playbackMode === "flyover" && flyoverCameraState && (
          <div className="absolute bottom-2 left-2 right-2 bg-atlas-surface/95 border border-atlas-accent/40 p-2 flex items-center justify-between text-[10px] backdrop-blur-md">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-atlas-accent animate-ping" />
              <span className="text-atlas-accent font-bold uppercase tracking-wider">
                {flyoverCameraState.phase.replace("_", " ")}
              </span>
              <span className="text-atlas-muted border-l border-atlas-border pl-2">
                {flyoverCameraState.annotation}
              </span>
            </div>
            <div className="flex items-center space-x-3 text-atlas-muted">
              <span>HDG: <b className="text-atlas-text">{flyoverCameraState.headingDeg}°</b></span>
              <span>PITCH: <b className="text-atlas-text">{flyoverCameraState.pitchDeg}°</b></span>
            </div>
          </div>
        )}
      </div>

      {/* Interactive Traversal Progress Scrubber (Smooth 60FPS + Scrubbable) */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-[10px] text-atlas-muted select-none">
          <span className="flex items-center space-x-1.5 font-bold">
            <span>{playbackMode === "flyover" ? "ORBIT-TO-GROUND TIMELINE" : "TRAVERSE PROGRESS"}</span>
            <span className="text-[9px] text-atlas-teal font-normal font-mono px-1 py-0.2 rounded bg-atlas-elevated border border-atlas-border">
              Interactive Scrubber
            </span>
          </span>
          <span className="font-mono font-bold text-atlas-text text-xs">
            {(progress * 100).toFixed(1)}%
          </span>
        </div>

        {/* Custom Range Track & Slider */}
        <div className="relative flex items-center group cursor-pointer h-4">
          <input
            type="range"
            min="0"
            max="1000"
            step="1"
            value={Math.round(progress * 1000)}
            onChange={(e) => {
              const val = Number(e.target.value) / 1000;
              setProgress(val);
              setElapsedSeconds(val * totalDurationSeconds);
            }}
            className="w-full h-full opacity-0 cursor-pointer z-10 absolute inset-0"
            title="Drag or click to scrub traverse position"
          />
          {/* Custom Track Background */}
          <div className="w-full h-2.5 bg-atlas-elevated border border-atlas-border rounded-sm overflow-hidden relative pointer-events-none">
            {/* Filled Progress Bar */}
            <div
              className={`h-full ${
                playbackMode === "flyover"
                  ? "bg-gradient-to-r from-atlas-blue via-atlas-teal to-atlas-accent"
                  : "bg-gradient-to-r from-atlas-teal via-atlas-blue to-atlas-accent"
              }`}
              style={{ width: `${(progress * 100).toFixed(2)}%` }}
            />
          </div>
          {/* Scrubber Thumb Reticle Indicator */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white border-2 border-atlas-accent rounded-full shadow-md pointer-events-none -ml-1.5 transition-transform group-hover:scale-125"
            style={{ left: `${(progress * 100).toFixed(2)}%` }}
          />
        </div>
      </div>

      {/* Telemetry Dashboard: Switches according to playbackMode */}
      {playbackMode === "flyover" && flyoverCameraState ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="p-2 bg-atlas-elevated border border-atlas-border space-y-1">
            <div className="text-[10px] text-atlas-muted flex items-center space-x-1">
              <Eye className="w-3 h-3 text-atlas-accent" />
              <span>RADAR ALTITUDE</span>
            </div>
            <div className="text-sm font-bold text-atlas-text flex items-center justify-between">
              <span>
                {flyoverCameraState.altitudeM >= 1000
                  ? `${(flyoverCameraState.altitudeM / 1000).toFixed(1)} km`
                  : `${flyoverCameraState.altitudeM} m`}
              </span>
              <span className="text-[9px] text-atlas-accent font-normal">AGL</span>
            </div>
          </div>

          <div className="p-2 bg-atlas-elevated border border-atlas-border space-y-1">
            <div className="text-[10px] text-atlas-muted flex items-center space-x-1">
              <Crosshair className="w-3 h-3 text-atlas-blue" />
              <span>CAMERA PITCH</span>
            </div>
            <div className="text-sm font-bold text-atlas-text flex items-center justify-between">
              <span>{flyoverCameraState.pitchDeg}°</span>
              <span className="text-[9px] text-atlas-teal font-normal">OBLIQUE</span>
            </div>
          </div>

          <div className="p-2 bg-atlas-elevated border border-atlas-border space-y-1">
            <div className="text-[10px] text-atlas-muted flex items-center space-x-1">
              <Compass className="w-3 h-3 text-atlas-amber" />
              <span>TRUE AZIMUTH</span>
            </div>
            <div className="text-sm font-bold text-atlas-text flex items-center justify-between">
              <span>{flyoverCameraState.headingDeg}°</span>
              <span className="text-[9px] text-atlas-muted font-normal">VECTOR</span>
            </div>
          </div>

          <div className="p-2 bg-atlas-elevated border border-atlas-border space-y-1">
            <div className="text-[10px] text-atlas-muted flex items-center space-x-1">
              <Layers className="w-3 h-3 text-atlas-teal" />
              <span>MAP CAMERA ZOOM</span>
            </div>
            <div className="text-sm font-bold text-atlas-teal flex items-center justify-between">
              <span>z{flyoverCameraState.zoom}</span>
              <span className="text-[9px] text-atlas-muted font-normal">HiRISE DTM</span>
            </div>
          </div>
        </div>
      ) : (
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
      )}

      {/* Safety Margin or Flyover Target Indicator */}
      {playbackMode === "flyover" ? (
        <div className="p-2 bg-atlas-elevated/70 border border-atlas-border flex items-center justify-between text-[11px]">
          <div className="flex items-center space-x-2">
            <Navigation2 className="w-3.5 h-3.5 text-atlas-accent" />
            <span className="text-atlas-muted">Target Site:</span>
            <span className="text-atlas-text font-bold">
              {route[activeSegmentIndex]?.label || "Jezero Base"}
            </span>
            <span className="text-[10px] text-atlas-teal border-l border-atlas-border pl-2">
              SIM 3464 Stratigraphy
            </span>
          </div>
          <span className="text-amber-400 font-bold">MODE: 2.5D RECON</span>
        </div>
      ) : (
        <div className="p-2 bg-atlas-elevated/70 border border-atlas-border flex items-center justify-between text-[11px]">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-3.5 h-3.5 text-atlas-teal" />
            <span className="text-atlas-muted">NASA Safety Invariant S3:</span>
            <span className="text-atlas-text font-bold">30-min Emergency O₂ Margin Preserved</span>
          </div>
          <span className="text-emerald-400 font-bold">STATUS: SAFE</span>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center space-x-2">
          <button
            onClick={onTogglePlay}
            className={`px-4 py-2 flex items-center space-x-1.5 text-xs font-bold transition-all shadow-sm ${
              isPlaying
                ? "bg-atlas-amber hover:bg-amber-600 text-slate-950"
                : playbackMode === "flyover"
                ? "bg-atlas-accent hover:bg-orange-600 text-white"
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
                <span>
                  {progress >= 1
                    ? "REPLAY"
                    : playbackMode === "flyover"
                    ? "RUN FLYOVER"
                    : "PLAY TRAVERSE"}
                </span>
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

          <button
            onClick={() => setPlaybackMode((m) => (m === "flyover" ? "bioenergetics" : "flyover"))}
            className="px-2.5 py-2 bg-atlas-elevated hover:bg-atlas-surface border border-atlas-border text-atlas-teal flex items-center space-x-1 text-[11px]"
            title="Toggle between Bioenergetics and Orbit Flyover"
          >
            {playbackMode === "flyover" ? (
              <>
                <Footprints className="w-3 h-3 text-atlas-teal" />
                <span>Bioenergetics</span>
              </>
            ) : (
              <>
                <Video className="w-3 h-3 text-atlas-accent" />
                <span>2.5D Flyover</span>
              </>
            )}
          </button>
        </div>

        <div className="text-[10px] text-atlas-muted hidden sm:block">
          Target:{" "}
          <span className="text-atlas-accent font-bold">
            {route[activeSegmentIndex]?.label || "Origin Base"}
          </span>
        </div>
      </div>
    </div>
  );
};
