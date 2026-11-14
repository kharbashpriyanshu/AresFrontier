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
    <div className="bg-atlas-surface border border-atlas-border p-5 text-xs space-y-4 shadow-xl transition-colors">
      <div className="flex items-center justify-between border-b border-atlas-border pb-3">
        <div className="flex items-center space-x-2">
          <Database className="w-4 h-4 text-atlas-blue" />
          <span className="font-display font-bold text-atlas-text text-sm">{title}</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center text-atlas-muted hover:text-atlas-text hover:bg-atlas-elevated transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 text-[11px]">
        <div className="p-3 bg-atlas-elevated border border-atlas-border">
          <div className="text-[10px] text-atlas-muted uppercase tracking-wider font-mono">Dataset Origin</div>
          <div className="font-semibold text-atlas-text mt-1 truncate">{provenance.sourceName}</div>
        </div>

        <div className="p-3 bg-atlas-elevated border border-atlas-border">
          <div className="text-[10px] text-atlas-muted uppercase tracking-wider font-mono">Provenance Tier</div>
          <div className="font-semibold text-atlas-teal mt-1 uppercase">{provenance.sourceType}</div>
        </div>
      </div>

      {provenance.datasetId && (
        <div className="p-3 bg-atlas-elevated border border-atlas-border text-[11px]">
          <div className="text-[10px] text-atlas-muted uppercase tracking-wider font-mono">NASA PDS Dataset Identifier</div>
          <div className="text-atlas-text font-mono font-medium truncate mt-1">{provenance.datasetId}</div>
        </div>
      )}

      {provenance.processingMethod && (
        <div className="p-3 bg-atlas-elevated border border-atlas-border text-[11px]">
          <div className="text-[10px] text-atlas-muted uppercase tracking-wider font-mono">Processing & Mathematical Methodology</div>
          <div className="text-atlas-text mt-1 leading-relaxed font-sans">{provenance.processingMethod}</div>
        </div>
      )}

      {provenance.spatialResolutionM && (
        <div className="flex items-center justify-between text-[11px] text-atlas-muted p-2.5 bg-atlas-elevated border border-atlas-border">
          <span className="flex items-center space-x-1.5">
            <Layers className="w-3.5 h-3.5 text-atlas-blue" />
            <span>Spatial Resolution:</span>
          </span>
          <span className="font-mono font-semibold text-atlas-text">
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
            className="text-xs text-atlas-blue hover:text-atlas-accent flex items-center space-x-1 font-mono transition-colors"
          >
            <span>Access NASA PDS Catalog Node</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}
    </div>
  );
};
