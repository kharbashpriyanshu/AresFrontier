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

  let badgeStyle = "bg-atlas-elevated text-atlas-blue border-atlas-border";
  let icon = <Database className="w-3 h-3 text-atlas-blue" />;
  let label = type.replace(/_/g, " ");

  switch (type) {
    case "NASA":
    case "USGS":
    case "ROVER":
    case "LIVE_EXTERNAL_DATA":
      badgeStyle = "bg-atlas-elevated text-atlas-teal border-atlas-border";
      icon = <ShieldCheck className="w-3 h-3 text-atlas-teal" />;
      label = type === "ROVER" ? "NASA Rover In-Situ" : "NASA / USGS Observation";
      break;
    case "BENCHMARK_DATA":
      badgeStyle = "bg-atlas-elevated text-atlas-teal border-atlas-border";
      icon = <Database className="w-3 h-3 text-atlas-teal" />;
      label = "Calibrated Benchmark";
      break;
    case "DERIVED":
      badgeStyle = "bg-atlas-elevated text-atlas-blue border-atlas-border";
      icon = <Compass className="w-3 h-3 text-atlas-blue" />;
      label = "Derived Metric";
      break;
    case "MODEL":
    case "MODEL_OUTPUT":
      badgeStyle = "bg-atlas-elevated text-atlas-violet border-atlas-border";
      icon = <Cpu className="w-3 h-3 text-atlas-violet" />;
      label = "AI/ML Model Output";
      break;
    case "PROJECT_RULE":
    case "HEURISTIC":
      badgeStyle = "bg-atlas-elevated text-atlas-amber border-atlas-border";
      icon = <Info className="w-3 h-3 text-atlas-amber" />;
      label = "Project Rule / Heuristic";
      break;
    case "DEMO":
      badgeStyle = "bg-atlas-elevated text-atlas-red border-atlas-border";
      icon = <AlertCircle className="w-3 h-3 text-atlas-red" />;
      label = "Demo Simulation";
      break;
  }

  const sizeClass = size === "sm" ? "text-[9px] px-1.5 py-0.5" : size === "lg" ? "text-xs px-2.5 py-1" : "text-[10px] px-2 py-0.5";

  return (
    <div
      className={`inline-flex items-center space-x-1.5 border font-mono tracking-tight font-medium ${sizeClass} ${badgeStyle}`}
      title={
        provenance
          ? `Source: ${provenance.sourceName} | Method: ${provenance.processingMethod || "N/A"}`
          : undefined
      }
    >
      {icon}
      {showLabel && <span>{label}</span>}
      {!compact && conf !== undefined && (
        <span className="text-[9px] opacity-75 border-l border-atlas-border pl-1.5 ml-1">
          {Math.round(conf * 100)}% Conf
        </span>
      )}
    </div>
  );
};
