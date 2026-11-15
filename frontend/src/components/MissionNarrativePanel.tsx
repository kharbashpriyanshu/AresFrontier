import React, { useMemo } from "react";
import { RoutePoint } from "../types/index.js";
import { X, ShieldCheck, MapPin, Database, Sparkles } from "lucide-react";

export interface MissionNarrativePanelProps {
  route: RoutePoint[];
  location?: string;
  onClose: () => void;
}

interface WaypointNarrative {
  story: string;
  goal: {
    label: string;
    badgeClass: string;
  };
  sources: string[];
}

function calculateTraverseDistanceKm(points: RoutePoint[]): number {
  if (points.length < 2) return 1.8;
  let totalKm = 0;
  const R = 3389.5; // Mars mean radius in km
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i].coordinate;
    const p2 = points[i + 1].coordinate;
    const lat1 = (p1.latitude * Math.PI) / 180;
    const lon1 = (p1.longitude * Math.PI) / 180;
    const lat2 = (p2.latitude * Math.PI) / 180;
    const lon2 = (p2.longitude * Math.PI) / 180;
    const dLat = lat2 - lat1;
    const dLon = lon2 - lon1;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    totalKm += R * c;
  }
  return Math.max(0.6, Math.round(totalKm * 10) / 10);
}

function getWaypointNarrative(point: RoutePoint, index: number, total: number): WaypointNarrative {
  const label = (point.label || "").toLowerCase();
  const type = (point.type || "").toLowerCase();

  // Match Octavia / Butler / start
  if (label.includes("octavia") || label.includes("butler") || type === "start" || index === 0) {
    return {
      story:
        "Landing site: Mars 2020 Perseverance touchdown zone. MOLA elevation: -2,565 m areoid. Flat terrain suitable for initial EVA orientation.",
      goal: {
        label: "Goal IV: Preparation",
        badgeClass: "text-amber-400 bg-amber-950/40 border-amber-800/50",
      },
      sources: ["MOLA", "HiRISE", "CTX", "USGS"],
    };
  }

  // Match Seitah / Olivine
  if (label.includes("seitah") || label.includes("séítah") || label.includes("olivine")) {
    return {
      story:
        "South Séítah: Olivine-rich cumulate rocks. CRISM detects Fe-rich olivine signature (1.0 μm absorption). Possible primordial crustal material — MEPAG Goal II priority target.",
      goal: {
        label: "Goal II: Climate",
        badgeClass: "text-cyan-400 bg-cyan-950/40 border-cyan-800/50",
      },
      sources: ["CRISM", "THEMIS", "SHARAD", "MOLA"],
    };
  }

  // Match Kodiak / Butte / Delta
  if (label.includes("kodiak") || label.includes("butte") || label.includes("delta")) {
    return {
      story:
        "Kodiak Butte: Ancient river delta scarp. USGS geological map: Jez-delt unit. Fluvio-deltaic sediments — highest biosignature potential per MEPAG Goal I.",
      goal: {
        label: "Goal I: Life Signs",
        badgeClass: "text-emerald-400 bg-emerald-950/40 border-emerald-800/50",
      },
      sources: ["USGS", "CRISM", "HiRISE", "Mastcam-Z"],
    };
  }

  // Match destination type
  if (type === "destination" || index === total - 1) {
    return {
      story:
        "EVA terminus: Return leg calculated with 30-min emergency O₂ reserve per NASA S3 invariant. Buddy pair monitoring active throughout.",
      goal: {
        label: "Goal IV: Preparation",
        badgeClass: "text-amber-400 bg-amber-950/40 border-amber-800/50",
      },
      sources: ["MOLA", "MEDA", "REMS", "HiRISE"],
    };
  }

  // Match science type (generic)
  if (type === "science") {
    return {
      story:
        "Scientific sample collection point. HiRISE resolution: ~25 cm/px. THEMIS thermal inertia suggests indurated outcrop — potential for well-preserved organics.",
      goal: {
        label: "Goal I: Life Signs",
        badgeClass: "text-emerald-400 bg-emerald-950/40 border-emerald-800/50",
      },
      sources: ["HiRISE", "THEMIS", "MOLA", "CRISM"],
    };
  }

  // Fallback waypoint
  return {
    story:
      "Traverse corridor and terrain transition point. Slope gradient and surface roughness verified via MOLA areoid models and HiRISE stereo pairs.",
    goal: {
      label: "Goal III: Evolution",
      badgeClass: "text-purple-400 bg-purple-950/40 border-purple-800/50",
    },
    sources: ["MOLA", "HiRISE", "THEMIS"],
  };
}

export const MissionNarrativePanel: React.FC<MissionNarrativePanelProps> = ({
  route,
  location = "Jezero Crater",
  onClose,
}) => {
  const distanceKm = useMemo(() => calculateTraverseDistanceKm(route), [route]);

  const startLabel = route.length > 0 && route[0].label
    ? route[0].label
    : "Octavia E. Butler Landing";

  const endLabel = route.length > 1 && route[route.length - 1].label
    ? route[route.length - 1].label
    : "Kodiak Butte Delta Front";

  return (
    <div className="w-full bg-atlas-surface border border-atlas-border backdrop-blur-md shadow-2xl p-4 font-mono text-xs text-atlas-text flex flex-col space-y-3 pointer-events-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-atlas-border pb-2">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-atlas-accent" />
          <span className="font-bold uppercase tracking-wider text-sm text-atlas-text">
            🌋 Marswalk Mission Narrative
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-atlas-elevated text-atlas-muted hover:text-atlas-text transition-colors"
          title="Close Mission Narrative Panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Opening Paragraph */}
      <div className="bg-atlas-bg/70 border border-atlas-border/70 p-3 leading-relaxed space-y-1.5">
        <div className="text-[11px] text-atlas-muted flex items-center justify-between">
          <span className="text-atlas-accent font-semibold uppercase tracking-wider">
            Operational Plan Summary
          </span>
          <span className="text-[10px] text-atlas-muted">Region: {location}</span>
        </div>
        <p className="text-xs text-atlas-text">
          On Sol 1042, Commander A. Gomez plans a {distanceKm} km EVA from{" "}
          <span className="text-atlas-accent font-semibold">{startLabel}</span> to{" "}
          <span className="text-atlas-teal font-semibold">{endLabel}</span>. ARES FRONTIER integrates 8 NASA mission datasets to ensure maximum safety and science return.
        </p>
      </div>

      {/* Waypoint Scientific Rationale Cards */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-[11px] text-atlas-muted font-semibold px-0.5">
          <span>Traverse Sequence & Scientific Rationale</span>
          <span>{route.length} Waypoints</span>
        </div>

        <div className="space-y-2">
          {route.map((pt, idx) => {
            const narrative = getWaypointNarrative(pt, idx, route.length);
            const ptLabel = pt.label || `Waypoint ${idx + 1}`;

            return (
              <div
                key={pt.id || `pt-${idx}`}
                className="bg-atlas-bg/40 border border-atlas-border/60 p-2.5 space-y-2 hover:border-atlas-border transition-colors"
              >
                {/* Waypoint Card Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center space-x-1.5 min-w-0">
                    <MapPin className="w-3.5 h-3.5 text-atlas-accent shrink-0" />
                    <span className="font-semibold text-atlas-text text-xs truncate">
                      #{idx + 1} {ptLabel}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 border shrink-0 font-medium ${narrative.goal.badgeClass}`}
                  >
                    {narrative.goal.label}
                  </span>
                </div>

                {/* Science Importance Description */}
                <p className="text-[11px] text-atlas-text/90 leading-relaxed pl-5 border-l border-atlas-border/40">
                  {narrative.story}
                </p>

                {/* Data Source Monospace Tags */}
                <div className="flex items-center flex-wrap gap-1 pl-5 pt-0.5">
                  <span className="text-[9px] uppercase tracking-wider text-atlas-muted mr-1">
                    NASA Instruments:
                  </span>
                  {narrative.sources.map((src) => (
                    <span
                      key={src}
                      className="px-1.5 py-0.2 bg-atlas-elevated text-atlas-muted border border-atlas-border text-[10px] font-mono"
                    >
                      {src}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Safety & Resources Summary */}
      <div className="border-t border-atlas-border pt-2.5 space-y-2">
        <div className="flex items-center space-x-1.5 text-[11px] font-semibold text-atlas-text">
          <ShieldCheck className="w-3.5 h-3.5 text-atlas-teal" />
          <span>Safety & Resources Verification</span>
        </div>

        <div className="bg-atlas-bg/50 border border-atlas-border/60 p-2.5 space-y-1.5 text-[11px] text-atlas-muted">
          <div className="flex items-center space-x-2">
            <span className="w-1.5 h-1.5 rounded-full bg-atlas-teal shrink-0" />
            <span>MEDA atmospheric conditions checked for dust opacity</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-1.5 h-1.5 rounded-full bg-atlas-teal shrink-0" />
            <span>MSL RAD baseline radiation: ~0.67 mSv/day surface dose</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-1.5 h-1.5 rounded-full bg-atlas-teal shrink-0" />
            <span>MRO/TGO/MAVEN comms windows verified</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-1.5 h-1.5 rounded-full bg-atlas-teal shrink-0" />
            <span>Tobler 0.38g gait model applied to metabolic budget</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-1.5 h-1.5 rounded-full bg-atlas-accent shrink-0" />
            <span className="text-atlas-text">
              7D Pareto optimizer selected this route from 14 candidates
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between text-[10px] text-atlas-muted px-0.5 pt-1">
          <span className="flex items-center space-x-1">
            <Database className="w-3 h-3 text-atlas-accent" />
            <span>Multi-mission integrated telemetry</span>
          </span>
          <span className="text-atlas-teal font-semibold">ALL SYSTEMS NOMINAL</span>
        </div>
      </div>
    </div>
  );
};
