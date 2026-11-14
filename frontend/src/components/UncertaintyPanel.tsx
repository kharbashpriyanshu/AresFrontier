import React from 'react';
import { DataProvenance } from '../types';
import { DataConfidenceBadge } from './DataConfidenceBadge';

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
  className = '',
}) => {
  const mode = provenance?.dataMode || 'FALLBACK';
  const confidence = provenance?.confidence ?? 0.75;
  const errorMargin = elevationErrorMarginMeters ?? (mode === 'BENCHMARK' ? 2.5 : mode === 'CACHED' ? 5.0 : 20.0);
  const slopeErr = slopeUncertaintyDegrees ?? (mode === 'BENCHMARK' ? 1.0 : 3.5);

  return (
    <div className={`p-4 bg-slate-900/90 border border-slate-700/80 rounded-lg text-slate-200 shadow-md ${className}`}>
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
        <div className="flex items-center space-x-2">
          <span className="text-amber-400 font-bold text-sm tracking-wide">⚠ UNCERTAINTY & OBSERVATIONAL LIMITS</span>
        </div>
        <DataConfidenceBadge provenance={provenance} size="sm" showLabel />
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs mb-3">
        <div className="p-2.5 bg-slate-950/60 rounded border border-slate-800">
          <div className="text-slate-400 font-medium">Vertical Altimetry Error</div>
          <div className="text-sm font-semibold text-amber-300 font-mono mt-0.5">
            ±{errorMargin.toFixed(1)} m
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {mode === 'BENCHMARK' ? 'MOLA calibrated orbital benchmark' : 'MOLA spherical harmonic areoid model'}
          </div>
        </div>

        <div className="p-2.5 bg-slate-950/60 rounded border border-slate-800">
          <div className="text-slate-400 font-medium">Slope Gradient Error</div>
          <div className="text-sm font-semibold text-amber-300 font-mono mt-0.5">
            ±{slopeErr.toFixed(1)}°
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Scale-dependent baseline step (128-463m)
          </div>
        </div>
      </div>

      {unmappedSensors.length > 0 && (
        <div className="text-xs mb-2.5">
          <span className="text-slate-400 font-medium">Missing Sensor Confirmation:</span>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {unmappedSensors.map((sensor) => (
              <span
                key={sensor}
                className="px-2 py-0.5 rounded text-[10px] bg-red-950/40 text-red-300 border border-red-800/50"
              >
                No {sensor} Coverage
              </span>
            ))}
          </div>
        </div>
      )}

      {notes.length > 0 && (
        <div className="text-[11px] text-slate-400 space-y-1 bg-slate-950/40 p-2 rounded border border-slate-800/60">
          <div className="text-slate-500 font-semibold uppercase text-[9px] tracking-wider">Uncertainty Mitigation:</div>
          {notes.map((note, idx) => (
            <div key={idx} className="flex items-start space-x-1.5">
              <span className="text-amber-500 font-bold">•</span>
              <span>{note}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500">
        <span>Scientific Grounding: NASA MGS MOLA MEGDR / PDS Geosciences</span>
        <span className="font-mono text-slate-400">Confidence: {(confidence * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
};
