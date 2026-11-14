import React from "react";
import { DataMode } from "../types/index.js";
import { ShieldCheck, Database, HardDrive, Cpu, PlayCircle } from "lucide-react";

interface OperationalDataModeBadgeProps {
  mode?: DataMode | "SIMULATED";
  compact?: boolean;
  className?: string;
}

export const OperationalDataModeBadge: React.FC<OperationalDataModeBadgeProps> = ({
  mode = "BENCHMARK",
  compact = false,
  className = "",
}) => {
  let label = "Benchmark Data";
  let badgeStyle = "bg-atlas-elevated text-atlas-teal border-atlas-border";
  let icon = <Database className="w-3 h-3 text-atlas-teal" />;
  let description = "Calibrated NASA reference dataset";

  switch (mode) {
    case "LIVE":
      label = "Live NASA Data";
      badgeStyle = "bg-atlas-elevated text-atlas-teal border-atlas-border";
      icon = <ShieldCheck className="w-3 h-3 text-atlas-teal animate-pulse" />;
      description = "Direct authenticated stream from NASA/USGS Astrogeology";
      break;
    case "CACHED":
      label = "Cached NASA Data";
      badgeStyle = "bg-atlas-elevated text-atlas-blue border-atlas-border";
      icon = <HardDrive className="w-3 h-3 text-atlas-blue" />;
      description = "Authoritative planetary data retrieved with bounded TTL";
      break;
    case "BENCHMARK":
      label = "Benchmark Data";
      badgeStyle = "bg-atlas-elevated text-atlas-teal border-atlas-border";
      icon = <Database className="w-3 h-3 text-atlas-teal" />;
      description = "Peer-reviewed NASA landing site ground truth";
      break;
    case "FALLBACK":
      label = "Derived Model";
      badgeStyle = "bg-atlas-elevated text-atlas-amber border-atlas-border";
      icon = <Cpu className="w-3 h-3 text-atlas-amber" />;
      description = "Offline deterministic areoid calculation";
      break;
    case "SIMULATED":
    case "DEMO":
      label = "Simulation Testbed";
      badgeStyle = "bg-atlas-elevated text-atlas-violet border-atlas-border";
      icon = <PlayCircle className="w-3 h-3 text-atlas-violet" />;
      description = "Offline multi-agent simulation with reproducible seed";
      break;
  }

  return (
    <div
      className={`inline-flex items-center space-x-1.5 px-2.5 py-1 border font-mono text-[10px] font-medium tracking-tight transition-all ${badgeStyle} ${className}`}
      title={`Operational Status: ${description}`}
    >
      {icon}
      <span>{label}</span>
      {!compact && (
        <span className="text-[9px] text-atlas-muted border-l border-atlas-border pl-1.5 ml-0.5">
          Marswalk-001
        </span>
      )}
    </div>
  );
};
