import React from "react";
import { DataProvenance } from "../types/index.js";
import { DataConfidenceBadge } from "./DataConfidenceBadge.js";
import { AlertTriangle, ShieldCheck } from "lucide-react";

interface UncertaintyPanelProps {
  provenance?: DataProvenance;
  elevationErrorMarginMeters?: number;
  slopeUncertaintyDegrees?: number;
  unmappedSensors?: string[];
  notes?: string[];
  className?: string;
}

export const UncertaintyPanel: React.FC<UncertaintyPanelProps> = ({
  provenance,
  elevationErrorMarginMeters,
  slopeUncertaintyDegrees,
  unmappedSensors = [],
  notes = [],
  className = "",
}) => {
  const mode = provenance?.dataMode || "FALLBACK";
  const confidence = provenance?.confidence ?? 0.75;
  const errorMargin = elevationErrorMarginMeters ?? (mode === "BENCHMARK" ? 2.5 : mode === "CACHED" ? 5.0 : 20.0);
  const slopeErr = slopeUncertaintyDegrees ?? (mode === "BENCHMARK" ? 1.0 : 3.5);

  return (
    <div className={`p-4 bg-atlas-surface border border-atlas-border text-atlas-text transition-colors ${className}`}>
      <div className="flex items-center justify-between border-b border-atlas-border pb-3 mb-3">
        <div className="flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-atlas-amber" />
          <span className="font-display font-bold text-xs uppercase tracking-wider text-atlas-text">
            Uncertainty & Observational Limits
          </span>
        </div>
        <DataConfidenceBadge provenance={provenance} size="sm" showLabel />
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs mb-3">
        <div className="p-3 bg-atlas-elevated border border-atlas-border">
          <div className="text-[10px] text-atlas-muted uppercase tracking-wider font-mono">Vertical Altimetry Error</div>
          <div className="text-sm font-semibold text-atlas-amber font-mono mt-1">
            ±{errorMargin.toFixed(1)} m
          </div>
          <div className="text-[10px] text-atlas-muted mt-1 leading-snug">
            {mode === "BENCHMARK" ? "MOLA calibrated orbital benchmark" : "MOLA spherical harmonic areoid model"}
          </div>
        </div>

        <div className="p-3 bg-atlas-elevated border border-atlas-border">
          <div className="text-[10px] text-atlas-muted uppercase tracking-wider font-mono">Slope Gradient Error</div>
          <div className="text-sm font-semibold text-atlas-amber font-mono mt-1">
            ±{slopeErr.toFixed(1)}°
          </div>
          <div className="text-[10px] text-atlas-muted mt-1 leading-snug">
            Scale-dependent baseline step (128–463m)
          </div>
        </div>
      </div>

      {unmappedSensors.length > 0 && (
        <div className="text-xs mb-3">
          <span className="text-[10px] text-atlas-muted uppercase tracking-wider font-mono">Missing Sensor Confirmation:</span>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {unmappedSensors.map((sensor) => (
              <span
                key={sensor}
                className="px-2 py-0.5 text-[10px] font-mono bg-atlas-elevated text-atlas-red border border-atlas-border"
              >
                No {sensor} Coverage
              </span>
            ))}
          </div>
        </div>
      )}

      {notes.length > 0 && (
        <div className="text-[11px] text-atlas-muted space-y-1.5 bg-atlas-elevated p-3 border border-atlas-border">
          <div className="text-[9px] text-atlas-muted font-mono uppercase tracking-wider font-semibold">
            Uncertainty Mitigation & Calibration:
          </div>
          {notes.map((note, idx) => (
            <div key={idx} className="flex items-start space-x-2">
              <span className="text-atlas-accent font-bold">•</span>
              <span className="leading-relaxed">{note}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 pt-2.5 border-t border-atlas-border flex items-center justify-between text-[10px] text-atlas-muted font-mono">
        <span className="flex items-center space-x-1">
          <ShieldCheck className="w-3.5 h-3.5 text-atlas-teal" />
          <span>NASA MGS MOLA MEGDR / PDS Geosciences</span>
        </span>
        <span className="text-atlas-text">Confidence: {(confidence * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
};
