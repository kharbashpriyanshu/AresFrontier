import React from "react";
import { DataProvenance, SourceType } from "../types/index.js";
import { ShieldCheck, Database, Cpu, Compass, Info, AlertCircle } from "lucide-react";

interface DataConfidenceBadgeProps {
  provenance?: DataProvenance;
  sourceType?: SourceType;
  confidence?: number;
  compact?: boolean;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export const DataConfidenceBadge: React.FC<DataConfidenceBadgeProps> = ({
  provenance,
  sourceType,
  confidence,
  compact = false,
  size = "md",
  showLabel = true,
}) => {
  const type = provenance?.sourceType || sourceType || "DERIVED";
  const conf = provenance?.confidence ?? confidence;

  let badgeStyle = "bg-blue-950/80 text-blue-300 border-blue-500/40";
  let icon = <Database className="w-3 h-3 text-blue-400" />;
  let label = type.replace(/_/g, " ");

  switch (type) {
    case "NASA":
    case "USGS":
    case "ROVER":
    case "LIVE_EXTERNAL_DATA":
      badgeStyle = "bg-emerald-950/80 text-emerald-300 border-emerald-500/40";
      icon = <ShieldCheck className="w-3 h-3 text-emerald-400" />;
      label = type === "ROVER" ? "NASA ROVER IN-SITU" : `NASA/USGS OBSERVATION`;
      break;
    case "BENCHMARK_DATA":
      badgeStyle = "bg-cyan-950/80 text-cyan-300 border-cyan-500/40";
      icon = <Database className="w-3 h-3 text-cyan-400" />;
      label = "CALIBRATED BENCHMARK";
      break;
    case "DERIVED":
      badgeStyle = "bg-sky-950/80 text-sky-300 border-sky-500/40";
      icon = <Compass className="w-3 h-3 text-sky-400" />;
      label = "DERIVED METRIC";
      break;
    case "MODEL":
    case "MODEL_OUTPUT":
      badgeStyle = "bg-purple-950/80 text-purple-300 border-purple-500/40";
      icon = <Cpu className="w-3 h-3 text-purple-400" />;
      label = "AI/ML MODEL OUTPUT";
      break;
    case "PROJECT_RULE":
    case "HEURISTIC":
      badgeStyle = "bg-amber-950/80 text-amber-300 border-amber-500/40";
      icon = <Info className="w-3 h-3 text-amber-400" />;
      label = "PROJECT RULE / HEURISTIC";
      break;
    case "DEMO":
      badgeStyle = "bg-rose-950/80 text-rose-300 border-rose-500/40";
      icon = <AlertCircle className="w-3 h-3 text-rose-400" />;
      label = "DEMO SIMULATION";
      break;
  }

  const sizeClass = size === "sm" ? "text-[9px] px-1.5 py-0.5" : size === "lg" ? "text-xs px-2.5 py-1" : "text-[10px] px-2 py-0.5";

  return (
    <div
      className={`inline-flex items-center space-x-1.5 rounded border font-mono tracking-wider font-semibold uppercase ${sizeClass} ${badgeStyle}`}
      title={
        provenance
          ? `Source: ${provenance.sourceName} | Method: ${provenance.processingMethod || "N/A"}`
          : undefined
      }
    >
      {icon}
      {showLabel && <span>{label}</span>}
      {!compact && conf !== undefined && (
        <span className="text-[9px] opacity-75 border-l border-current/30 pl-1.5 ml-1">
          {Math.round(conf * 100)}% CONF
        </span>
      )}
    </div>
  );
};
