import React from "react";
import { DataProvenance } from "../types/index.js";
import { Database, ExternalLink, Layers, X } from "lucide-react";

interface ProvenancePanelProps {
  provenance: DataProvenance;
  title?: string;
  onClose?: () => void;
}

export const ProvenancePanel: React.FC<ProvenancePanelProps> = ({
  provenance,
  title = "Planetary Dataset Provenance",
  onClose,
}) => {
  return (
    <div className="bg-space-900 border border-space-800 rounded p-4 font-mono text-xs space-y-3 shadow-xl">
      <div className="flex items-center justify-between border-b border-space-800 pb-2">
        <div className="flex items-center space-x-2">
          <Database className="w-4 h-4 text-telemetry-cyan" />
          <span className="font-bold text-slate-100 font-sans text-xs">{title}</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="p-2 bg-space-950/70 rounded border border-space-850">
          <div className="text-[10px] text-slate-400">DATASET ORIGIN</div>
          <div className="font-bold text-slate-200 mt-0.5 truncate">{provenance.sourceName}</div>
        </div>

        <div className="p-2 bg-space-950/70 rounded border border-space-850">
          <div className="text-[10px] text-slate-400">PROVENANCE CLASSIFICATION</div>
          <div className="font-bold text-telemetry-cyan mt-0.5 uppercase">{provenance.sourceType}</div>
        </div>
      </div>

      {provenance.datasetId && (
        <div className="p-2 bg-space-950/70 rounded border border-space-850 text-[11px]">
          <div className="text-[10px] text-slate-400">NASA PDS DATASET ID</div>
          <div className="text-slate-300 font-bold truncate mt-0.5">{provenance.datasetId}</div>
        </div>
      )}

      {provenance.processingMethod && (
        <div className="p-2 bg-space-950/70 rounded border border-space-850 text-[11px]">
          <div className="text-[10px] text-slate-400">PROCESSING & METHODOLOGY</div>
          <div className="text-slate-300 mt-0.5 leading-relaxed">{provenance.processingMethod}</div>
        </div>
      )}

      {provenance.spatialResolutionM && (
        <div className="flex items-center justify-between text-[11px] text-slate-400 p-2 bg-space-950/50 rounded">
          <span className="flex items-center space-x-1.5">
            <Layers className="w-3.5 h-3.5 text-slate-500" />
            <span>Spatial Resolution:</span>
          </span>
          <span className="font-bold text-slate-200">
            {provenance.spatialResolutionM < 1
              ? `${(provenance.spatialResolutionM * 100).toFixed(0)} cm/pixel`
              : `${provenance.spatialResolutionM} m/pixel`}
          </span>
        </div>
      )}

      {provenance.sourceUrl && (
        <div className="pt-1">
          <a
            href={provenance.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-telemetry-cyan hover:underline flex items-center space-x-1"
          >
            <span>Access NASA PDS Catalog Node</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  );
};
