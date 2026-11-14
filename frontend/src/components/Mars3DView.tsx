import React, { useRef, useEffect, useState, useCallback } from "react";
import { MarsRoute, PlanetaryAgent, Hazard } from "../types/index.js";
import {
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Layers,
  Info,
  AlertTriangle,
  Crosshair,
  RefreshCw,
} from "lucide-react";

interface Mars3DViewProps {
  route?: MarsRoute | null;
  agents?: PlanetaryAgent[];
  hazards?: Hazard[];
  scienceTargets?: any[];
  selectedTargetIds?: string[];
  activeWaypointIndex?: number;
  isLoading?: boolean;
  error?: string | null;
  onSelectWaypoint?: (index: number) => void;
  onSelectTarget?: (targetId: string) => void;
  className?: string;
}

interface PlacedLabelBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface HitboxItem {
  sx: number;
  sy: number;
  radius: number;
  kind: "WAYPOINT" | "TARGET" | "HAZARD";
  id: string;
  title: string;
  subtitle: string;
  details: Array<{ label: string; value: string }>;
  waypointIndex?: number;
}

export const Mars3DView: React.FC<Mars3DViewProps> = ({
  route,
  agents = [],
  hazards = [],
  scienceTargets = [],
  selectedTargetIds = [],
  activeWaypointIndex,
  isLoading = false,
  error = null,
  onSelectWaypoint,
  onSelectTarget,
  className = "",
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hitboxesRef = useRef<HitboxItem[]>([]);

  // 3D Camera & View State
  const [rotX, setRotX] = useState<number>(38);
  const [rotY, setRotY] = useState<number>(-42);
  const [zoom, setZoom] = useState<number>(2.1);
  const [wireframe, setWireframe] = useState<boolean>(false);
  const [canvasSizeTick, setCanvasSizeTick] = useState<number>(0);
  const [selectedFeature, setSelectedFeature] = useState<HitboxItem | null>(null);

  const isDraggingRef = useRef<boolean>(false);
  const movedDuringDragRef = useRef<boolean>(false);
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Center coordinate around Jezero Crater (IAU/IAG 2000 Areoid)
  const baseLat = route?.points?.[0]?.coordinate?.latitude ?? 18.4447;
  const baseLon = route?.points?.[0]?.coordinate?.longitude ?? 77.4508;

  const projectToTerrain = useCallback(
    (lat: number, lon: number, elevM: number = 0) => {
      const scale = 5200;
      const clamp = (v: number, limit: number) => Math.max(-limit, Math.min(limit, v));
      const x = clamp((lon - baseLon) * scale, 190);
      const z = clamp(-(lat - baseLat) * scale, 190);
      const y = (elevM / 100) * 1.5;
      return { x, y, z };
    },
    [baseLat, baseLon]
  );

  const transform3D = useCallback(
    (
      x: number,
      y: number,
      z: number,
      width: number,
      height: number
    ): { sx: number; sy: number; depth: number } => {
      const radY = (rotY * Math.PI) / 180;
      const radX = (rotX * Math.PI) / 180;

      const x1 = x * Math.cos(radY) - z * Math.sin(radY);
      const z1 = x * Math.sin(radY) + z * Math.cos(radY);
      const y1 = y;

      const y2 = y1 * Math.cos(radX) - z1 * Math.sin(radX);
      const z2 = y1 * Math.sin(radX) + z1 * Math.cos(radX);
      const x2 = x1;

      const fov = 560 * zoom;
      const viewerDistance = 540;
      const scale = fov / Math.max(80, viewerDistance + z2);

      const sx = width / 2 + x2 * scale;
      const sy = height / 2 - y2 * scale + 18;

      return { sx, sy, depth: z2 };
    },
    [rotX, rotY, zoom]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => setCanvasSizeTick((t) => t + 1));
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 720;
    const height = canvas.clientHeight || 460;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Clear with Martian atmosphere gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0b0e14");
    bgGrad.addColorStop(0.55, "#171419");
    bgGrad.addColorStop(1, "#2a1815");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const hitboxes: HitboxItem[] = [];

    // 1. Analytical / Benchmark Derived Terrain Surface (IAU/IAG 2000 Areoid)
    const gridN = 28;
    const extent = 200;
    const step = (extent * 2) / gridN;

    const getElevation = (gx: number, gz: number) => {
      const hill = Math.sin(gx * 0.025) * Math.cos(gz * 0.025) * 38;
      const ridge = Math.exp(-Math.pow((gx - 40) / 70, 2)) * Math.sin(gz * 0.02) * 45;
      const crater = -Math.exp(-(Math.pow(gx + 65, 2) + Math.pow(gz - 55, 2)) / 2400) * 52;
      return hill + ridge + crater;
    };

    const gridPoints: { x: number; y: number; z: number; sx: number; sy: number; elev: number }[][] = [];
    for (let i = 0; i <= gridN; i++) {
      gridPoints[i] = [];
      for (let j = 0; j <= gridN; j++) {
        const gx = -extent + i * step;
        const gz = -extent + j * step;
        const elev = getElevation(gx, gz);
        const p3d = transform3D(gx, elev, gz, width, height);
        gridPoints[i][j] = { x: gx, y: elev, z: gz, sx: p3d.sx, sy: p3d.sy, elev };
      }
    }

    for (let i = 0; i < gridN; i++) {
      for (let j = 0; j < gridN; j++) {
        const p1 = gridPoints[i][j];
        const p2 = gridPoints[i + 1][j];
        const p3 = gridPoints[i + 1][j + 1];
        const p4 = gridPoints[i][j + 1];

        const avgElev = (p1.elev + p2.elev + p3.elev + p4.elev) / 4;
        const normElev = Math.max(0, Math.min(1, (avgElev + 50) / 110));

        ctx.beginPath();
        ctx.moveTo(p1.sx, p1.sy);
        ctx.lineTo(p2.sx, p2.sy);
        ctx.lineTo(p3.sx, p3.sy);
        ctx.lineTo(p4.sx, p4.sy);
        ctx.closePath();

        if (wireframe) {
          ctx.strokeStyle = `rgba(234, 88, 12, ${0.25 + normElev * 0.5})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        } else {
          const r = Math.round(90 + normElev * 115);
          const g = Math.round(40 + normElev * 48);
          const b = Math.round(30 + normElev * 24);
          ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
          ctx.fill();
          ctx.strokeStyle = `rgba(255, 160, 120, 0.08)`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }

    const placedLabels: PlacedLabelBox[] = [];
    const drawSmartLabel = (
      text: string,
      anchorX: number,
      anchorY: number,
      textColor: string,
      preferredOffsetY: number = -12
    ) => {
      ctx.font = "bold 10px ui-monospace, SFMono-Regular, Menlo, monospace";
      const textWidth = ctx.measureText(text).width + 8;
      const boxH = 15;
      let lx = Math.max(8, Math.min(width - textWidth - 8, anchorX + 8));
      let ly = Math.max(40, Math.min(height - 24, anchorY + preferredOffsetY));

      const overlaps = (x: number, y: number) =>
        placedLabels.some(
          (b) => x < b.x + b.w + 4 && x + textWidth + 4 > b.x && y < b.y + b.h + 3 && y + boxH + 3 > b.y
        );

      let stepCount = 0;
      while (overlaps(lx, ly) && stepCount < 10) {
        stepCount++;
        ly += stepCount % 2 === 1 ? -17 * Math.ceil(stepCount / 2) : 17 * Math.ceil(stepCount / 2);
        ly = Math.max(42, Math.min(height - 24, ly));
      }

      placedLabels.push({ x: lx, y: ly, w: textWidth, h: boxH });

      if (Math.hypot(lx - anchorX, ly + boxH / 2 - anchorY) > 16) {
        ctx.beginPath();
        ctx.moveTo(anchorX, anchorY);
        ctx.lineTo(lx, ly + boxH / 2);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      ctx.fillStyle = "rgba(10, 12, 18, 0.86)";
      ctx.fillRect(lx, ly, textWidth, boxH);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
      ctx.lineWidth = 0.7;
      ctx.strokeRect(lx, ly, textWidth, boxH);

      ctx.fillStyle = textColor;
      ctx.fillText(text, lx + 4, ly + 11);
    };

    // 2. Draw Hazards (Severity visually distinguished)
    hazards.forEach((h, idx) => {
      const pos = projectToTerrain(h.location.latitude, h.location.longitude, 20);
      const p3d = transform3D(pos.x, pos.y, pos.z, width, height);
      const isCrit = h.severity === "CRITICAL";

      ctx.beginPath();
      ctx.ellipse(p3d.sx, p3d.sy, 18 * (zoom * 0.7), 10 * (zoom * 0.7), 0, 0, Math.PI * 2);
      ctx.fillStyle = isCrit ? "rgba(239, 68, 68, 0.25)" : "rgba(245, 158, 11, 0.20)";
      ctx.fill();
      ctx.strokeStyle = isCrit ? "#ef4444" : "#f59e0b";
      ctx.lineWidth = isCrit ? 1.8 : 1.2;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      const spikeTop = transform3D(pos.x, pos.y + 26, pos.z, width, height);
      ctx.beginPath();
      ctx.moveTo(p3d.sx, p3d.sy);
      ctx.lineTo(spikeTop.sx, spikeTop.sy);
      ctx.strokeStyle = isCrit ? "#ef4444" : "#f59e0b";
      ctx.lineWidth = 1.4;
      ctx.stroke();

      drawSmartLabel(
        `! ${h.type} (${h.severity})`,
        spikeTop.sx,
        spikeTop.sy,
        isCrit ? "#fca5a5" : "#fde68a",
        idx % 2 === 0 ? -16 : 6
      );

      hitboxes.push({
        sx: p3d.sx,
        sy: p3d.sy,
        radius: 16,
        kind: "HAZARD",
        id: h.id,
        title: `${h.type} (${h.severity})`,
        subtitle: (h as any).description || "Planetary surface hazard zone",
        details: [
          { label: "Severity", value: h.severity },
          { label: "Coordinates", value: `${h.location.latitude.toFixed(4)}°N, ${h.location.longitude.toFixed(4)}°E` },
          { label: "Provenance", value: "DERIVED / HAZARD ENGINE" },
        ],
      });
    });

    // 3. Draw Scientific Targets (Distinct diamond markers + category colors)
    scienceTargets.slice(0, 10).forEach((t: any, idx: number) => {
      const lat = t.coordinate?.latitude ?? t.latitude ?? baseLat + 0.01 * (idx + 1);
      const lon = t.coordinate?.longitude ?? t.longitude ?? baseLon + 0.01 * (idx + 1);
      const pos = projectToTerrain(lat, lon, 24);
      const p3d = transform3D(pos.x, pos.y, pos.z, width, height);
      const isSelected = selectedTargetIds.includes(t.id) || selectedFeature?.id === t.id;
      const category = t.mineralogyFocus || t.objectiveId || t.category || "ASTROBIOLOGY";
      const color =
        String(category).includes("ICE") || String(category).includes("WATER")
          ? "#2dd4bf"
          : String(category).includes("BIO")
          ? "#a78bfa"
          : "#38bdf8";

      // Diamond marker
      const r = isSelected ? 7.5 : 5.5;
      ctx.beginPath();
      ctx.moveTo(p3d.sx, p3d.sy - r);
      ctx.lineTo(p3d.sx + r, p3d.sy);
      ctx.lineTo(p3d.sx, p3d.sy + r);
      ctx.lineTo(p3d.sx - r, p3d.sy);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = isSelected ? "#ffffff" : "#0f172a";
      ctx.lineWidth = isSelected ? 2 : 1.2;
      ctx.stroke();

      if (isSelected || scienceTargets.length <= 6) {
        drawSmartLabel(`◆ ${t.name || t.id}`, p3d.sx, p3d.sy, color, idx % 2 === 0 ? -18 : 10);
      }

      hitboxes.push({
        sx: p3d.sx,
        sy: p3d.sy,
        radius: 14,
        kind: "TARGET",
        id: t.id,
        title: t.name || t.id,
        subtitle: `Scientific Target · ${category}`,
        details: [
          { label: "Priority", value: String(t.priorityScore ?? t.scientificPriority ?? "HIGH") },
          { label: "Coordinates", value: `${Number(lat).toFixed(4)}°N, ${Number(lon).toFixed(4)}°E` },
          { label: "Provenance", value: "BENCHMARK CATALOG (M20 / JEZERO)" },
        ],
      });
    });

    // 4. Draw Active Route Segments (Color-coded by slope severity) & Waypoints
    if (route && route.points && route.points.length > 0) {
      const projectedPoints = route.points.map((pt) => {
        const p = projectToTerrain(pt.coordinate.latitude, pt.coordinate.longitude, pt.elevationM);
        return {
          point: pt,
          p3d: transform3D(p.x, p.y + 6, p.z, width, height),
        };
      });

      for (let i = 0; i < projectedPoints.length - 1; i++) {
        const a = projectedPoints[i];
        const b = projectedPoints[i + 1];
        const elevDiff = Math.abs((b.point.elevationM ?? 0) - (a.point.elevationM ?? 0));
        const segSlope = Math.min(35, route.maxSlopeDegrees * (elevDiff > 8 ? 1.0 : 0.6));
        const segColor = segSlope > 20 ? "#ef4444" : segSlope > 14 ? "#f59e0b" : "#38bdf8";

        ctx.beginPath();
        ctx.moveTo(a.p3d.sx, a.p3d.sy);
        ctx.lineTo(b.p3d.sx, b.p3d.sy);
        ctx.strokeStyle = segColor;
        ctx.lineWidth = 2.8;
        ctx.shadowColor = segColor;
        ctx.shadowBlur = 6;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      projectedPoints.forEach((pt, idx) => {
        const isStart = idx === 0;
        const isEnd = idx === projectedPoints.length - 1;
        const isSelected = activeWaypointIndex === idx || selectedFeature?.id === (pt.point.id || `wp-${idx}`);

        ctx.beginPath();
        ctx.arc(pt.p3d.sx, pt.p3d.sy, isSelected ? 6.5 : 4.5, 0, Math.PI * 2);
        ctx.fillStyle = isStart ? "#10b981" : isEnd ? "#ec4899" : isSelected ? "#38bdf8" : "#fbbf24";
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        const wpLabel = pt.point.id || `WP-${String(idx + 1).padStart(2, "0")}`;
        if (isStart || isEnd || isSelected || projectedPoints.length <= 6) {
          drawSmartLabel(wpLabel, pt.p3d.sx, pt.p3d.sy, "#f8fafc", -14);
        }

        hitboxes.push({
          sx: pt.p3d.sx,
          sy: pt.p3d.sy,
          radius: 12,
          kind: "WAYPOINT",
          id: pt.point.id || `wp-${idx}`,
          waypointIndex: idx,
          title: `${wpLabel} (${isStart ? "Start" : isEnd ? "Terminus" : `Waypoint ${idx + 1}`})`,
          subtitle: `Route: ${route.name}`,
          details: [
            { label: "Elevation (Derived)", value: `${Math.round(pt.point.elevationM ?? -2500)} m` },
            {
              label: "Coordinates",
              value: `${pt.point.coordinate.latitude.toFixed(4)}°N, ${pt.point.coordinate.longitude.toFixed(4)}°E`,
            },
            { label: "Datum", value: "IAU/IAG 2000 Areoid" },
          ],
        });
      });
    }

    // 5. Draw Fleet Expedition Agents
    agents.forEach((agent, idx) => {
      const isAstronaut = agent.type === "ASTRONAUT";
      const isOrbiter = agent.type === "ORBITER";

      if (isOrbiter) {
        const orbiter3d = transform3D(-35, 115, -35, width, height);
        ctx.beginPath();
        ctx.arc(orbiter3d.sx, orbiter3d.sy, 6, 0, Math.PI * 2);
        ctx.fillStyle = "#a855f7";
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        drawSmartLabel("ORBITER-01 (MRO)", orbiter3d.sx, orbiter3d.sy, "#e9d5ff", -8);
      } else {
        const pos = projectToTerrain(agent.position.latitude, agent.position.longitude, 26);
        const p3d = transform3D(pos.x, pos.y, pos.z, width, height);

        ctx.beginPath();
        ctx.arc(p3d.sx, p3d.sy, isAstronaut ? 6 : 5, 0, Math.PI * 2);
        ctx.fillStyle = isAstronaut ? "#3b82f6" : "#f97316";
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        drawSmartLabel(agent.callsign, p3d.sx, p3d.sy, "#ffffff", idx % 2 === 0 ? 10 : -16);
      }
    });

    // 6. Compass / North Indicator
    ctx.save();
    ctx.translate(width - 42, height - 42);
    const rad = (-rotY * Math.PI) / 180;
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.rotate(rad);
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(4.5, 4);
    ctx.lineTo(-4.5, 4);
    ctx.closePath();
    ctx.fillStyle = "#ef4444";
    ctx.fill();
    ctx.restore();

    hitboxesRef.current = hitboxes;
  }, [
    rotX,
    rotY,
    zoom,
    wireframe,
    route,
    agents,
    hazards,
    scienceTargets,
    selectedTargetIds,
    activeWaypointIndex,
    selectedFeature,
    canvasSizeTick,
    baseLat,
    baseLon,
    projectToTerrain,
    transform3D,
  ]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    movedDuringDragRef.current = false;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastMousePosRef.current.x;
    const dy = e.clientY - lastMousePosRef.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      movedDuringDragRef.current = true;
    }
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    setRotY((prev) => (prev + dx * 0.6) % 360);
    setRotX((prev) => Math.max(5, Math.min(85, prev - dy * 0.4)));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const wasDrag = movedDuringDragRef.current;
    isDraggingRef.current = false;
    if (wasDrag || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    let best: HitboxItem | null = null;
    let bestDist = Infinity;
    for (const item of hitboxesRef.current) {
      const d = Math.hypot(item.sx - clickX, item.sy - clickY);
      if (d <= item.radius && d < bestDist) {
        best = item;
        bestDist = d;
      }
    }

    if (best) {
      setSelectedFeature(best);
      if (best.kind === "WAYPOINT" && best.waypointIndex !== undefined && onSelectWaypoint) {
        onSelectWaypoint(best.waypointIndex);
      }
      if (best.kind === "TARGET" && onSelectTarget) {
        onSelectTarget(best.id);
      }
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setZoom((prev) => Math.max(0.8, Math.min(3.8, prev - e.deltaY * 0.0015)));
  };

  if (isLoading) {
    return (
      <div className="bg-atlas-surface border border-atlas-border rounded-lg p-8 flex items-center justify-center gap-2 text-xs font-mono text-atlas-muted">
        <RefreshCw className="w-4 h-4 animate-spin text-atlas-accent" />
        <span>Loading 3D Mars Terrain & Mission Geometry...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-atlas-surface border border-red-500/40 rounded-lg p-6 flex items-center gap-3 text-xs font-mono text-red-400">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span>3D Surface View unavailable: {error}</span>
      </div>
    );
  }

  if (!route && scienceTargets.length === 0 && hazards.length === 0) {
    return (
      <div className="bg-atlas-surface border border-atlas-border rounded-lg p-6 text-xs font-mono text-atlas-muted">
        No route, target, or hazard coordinates available to project in 3D view.
      </div>
    );
  }

  return (
    <div className={`relative bg-atlas-surface border border-atlas-border rounded-lg overflow-hidden flex flex-col ${className}`}>
      {/* Scientific Integrity & Datum Banner */}
      <div className="px-3 py-2 bg-slate-900/95 border-b border-slate-700 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-200">
        <div className="flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-orange-400 shrink-0" />
          <span>
            <strong className="text-amber-300">DERIVED BENCHMARK SURFACE:</strong> Analytical Jezero Terrain Projection (Not Raw NASA MOLA Raster) · IAU/IAG 2000 Areoid Datum
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom((z) => Math.min(3.8, Number((z + 0.25).toFixed(2))))}
            className="p-1.5 hover:bg-slate-700 rounded text-slate-100"
            title="Zoom In"
            aria-label="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(0.8, Number((z - 0.25).toFixed(2))))}
            className="p-1.5 hover:bg-slate-700 rounded text-slate-100"
            title="Zoom Out"
            aria-label="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              setRotX(38);
              setRotY(-42);
              setZoom(2.1);
              setSelectedFeature(null);
            }}
            className="p-1.5 hover:bg-slate-700 rounded text-slate-100"
            title="Reset Camera Orientation"
            aria-label="Reset Camera Orientation"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setWireframe((w) => !w)}
            className={`p-1.5 rounded ${wireframe ? "bg-orange-500 text-white" : "hover:bg-slate-700 text-slate-100"}`}
            title="Toggle Wireframe Topography Mesh"
            aria-label="Toggle Wireframe Topography Mesh"
          >
            <Layers className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Interactive 3D Canvas */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => {
          isDraggingRef.current = false;
        }}
        onWheel={handleWheel}
        className="w-full h-[420px] cursor-grab active:cursor-grabbing block touch-none"
      />

      {/* Selected Feature Inspector (or click prompt) */}
      <div className="px-3 py-2.5 bg-atlas-surface border-t border-atlas-border flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs font-mono">
        {selectedFeature ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="px-2 py-0.5 rounded bg-atlas-accent/20 border border-atlas-accent/40 text-atlas-accent font-bold text-[10px]">
              {selectedFeature.kind}
            </span>
            <span className="font-bold text-atlas-text">{selectedFeature.title}</span>
            <span className="text-atlas-muted">{selectedFeature.subtitle}</span>
            {selectedFeature.details.map((d, i) => (
              <span key={i} className="text-[11px] text-atlas-muted">
                <strong className="text-atlas-text">{d.label}:</strong> {d.value}
              </span>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-atlas-muted text-[11px]">
            <Crosshair className="w-3.5 h-3.5 text-atlas-accent" />
            <span>
              Drag to rotate · Scroll/buttons to zoom · Click any waypoint, science target (◆), or hazard (!) to inspect details.
            </span>
          </div>
        )}
      </div>

      {/* Bottom Legend & Camera Telemetry */}
      <div className="px-3 py-1.5 bg-atlas-elevated border-t border-atlas-border flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-atlas-muted">
        <div className="flex items-center gap-4">
          <span>Pitch: {rotX.toFixed(0)}°</span>
          <span>Yaw: {rotY.toFixed(0)}°</span>
          <span>Zoom: {(zoom * 100).toFixed(0)}%</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Start
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-sky-400"></span> Nominal Seg
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span> Steep Seg
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-teal-400"></span> Science Target
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-400"></span> Critical Hazard
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-orange-400"></span> Rover
          </span>
        </div>
      </div>
    </div>
  );
};
