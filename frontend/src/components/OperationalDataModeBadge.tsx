import React from 'react';
import { DataMode } from '../types/index.js';
import { ShieldCheck, Database, HardDrive, Cpu, PlayCircle } from 'lucide-react';

interface OperationalDataModeBadgeProps {
  mode?: DataMode | 'SIMULATED';
  compact?: boolean;
  className?: string;
}

export const OperationalDataModeBadge: React.FC<OperationalDataModeBadgeProps> = ({
  mode = 'BENCHMARK',
  compact = false,
  className = '',
}) => {
  let label = 'BENCHMARK DATA';
  let badgeStyle = 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40';
  let icon = <Database className="w-3.5 h-3.5 text-cyan-400" />;
  let description = 'Calibrated NASA reference dataset';

  switch (mode) {
    case 'LIVE':
      label = 'LIVE NASA DATA';
      badgeStyle = 'bg-emerald-950/90 text-emerald-300 border-emerald-500/60 shadow-sm shadow-emerald-950';
      icon = <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />;
      description = 'Direct authenticated stream from NASA/USGS Astrogeology';
      break;
    case 'CACHED':
      label = 'CACHED NASA DATA';
      badgeStyle = 'bg-blue-950/80 text-blue-300 border-blue-500/40';
      icon = <HardDrive className="w-3.5 h-3.5 text-blue-400" />;
      description = 'Authoritative planetary data retrieved with bounded TTL';
      break;
    case 'BENCHMARK':
      label = 'BENCHMARK DATA';
      badgeStyle = 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40';
      icon = <Database className="w-3.5 h-3.5 text-cyan-400" />;
      description = 'Peer-reviewed NASA landing site ground truth';
      break;
    case 'FALLBACK':
      label = 'DERIVED MODEL';
      badgeStyle = 'bg-amber-950/80 text-amber-300 border-amber-500/40';
      icon = <Cpu className="w-3.5 h-3.5 text-amber-400" />;
      description = 'Offline deterministic areoid calculation';
      break;
    case 'SIMULATED':
    case 'DEMO':
      label = 'DEMONSTRATION SIMULATION';
      badgeStyle = 'bg-purple-950/80 text-purple-300 border-purple-500/40';
      icon = <PlayCircle className="w-3.5 h-3.5 text-purple-400" />;
      description = 'Offline multi-agent simulation with reproducible seed';
      break;
  }

  return (
    <div
      className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded border font-mono text-[10px] font-bold tracking-wider uppercase transition-all ${badgeStyle} ${className}`}
      title={`Operational Status: ${description}`}
    >
      {icon}
      <span>{label}</span>
      {!compact && (
        <span className="text-[9px] opacity-70 border-l border-current/30 pl-1.5 ml-0.5 lowercase font-sans">
          verified
        </span>
      )}
    </div>
  );
};
