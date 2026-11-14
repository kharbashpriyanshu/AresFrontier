import React, { useState, useEffect } from "react";
import { api } from "../services/api.js";
import { MarsCoordinate } from "../types/index.js";
import {
  Wifi,
  WifiOff,
  Clock,
  ShieldAlert,
  AlertTriangle,
  X,
  Satellite,
} from "lucide-react";

interface RfCoverageOverlayProps {
  coordinate: MarsCoordinate;
  onClose: () => void;
}

export const RfCoverageOverlay: React.FC<RfCoverageOverlayProps> = ({
  coordinate,
  onClose,
}) => {
  const [sol] = useState<number>(350);
  const [durationMin] = useState<number>(360);
  const [loading, setLoading] = useState<boolean>(true);
  const [commsData, setCommsData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    api
      .getConstellationComms(coordinate.latitude, coordinate.longitude, sol, durationMin)
      .then((res) => {
        if (isMounted) {
          setCommsData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || "Failed to load constellation communication telemetry");
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [coordinate.latitude, coordinate.longitude, sol, durationMin]);

  return (
    <div className="absolute bottom-6 right-4 z-30 w-96 max-w-[calc(100vw-2rem)] bg-atlas-surface/95 border border-atlas-border backdrop-blur-md shadow-2xl p-4 font-mono text-xs text-atlas-text flex flex-col space-y-3 pointer-events-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-atlas-border pb-2">
        <div className="flex items-center space-x-2">
          <Satellite className="w-4 h-4 text-atlas-teal" />
          <span className="font-bold uppercase tracking-wider text-sm">
            Orbiter Relay & RF Coverage
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-atlas-elevated text-atlas-muted hover:text-atlas-text transition-colors"
          title="Close comms overlay"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="py-8 flex flex-col items-center justify-center space-y-2 text-atlas-muted">
          <div className="w-5 h-5 border-2 border-atlas-teal border-t-transparent animate-spin rounded-full" />
          <span className="text-[11px]">Computing Ephemeris & Horizon Shadows...</span>
        </div>
      ) : error ? (
        <div className="py-4 text-atlas-red text-[11px] flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : commsData ? (
        <div className="space-y-3 overflow-y-auto max-h-[60vh] pr-1">
          {/* Active Link Status Banner */}
          <div
            className={`p-2.5 border flex items-center justify-between ${
              commsData.activeLinkAvailable
                ? "bg-emerald-950/30 border-emerald-800/60 text-emerald-300"
                : "bg-amber-950/30 border-amber-800/60 text-amber-300"
            }`}
          >
            <div className="flex items-center space-x-2">
              {commsData.activeLinkAvailable ? (
                <Wifi className="w-4 h-4 text-emerald-400" />
              ) : (
                <WifiOff className="w-4 h-4 text-amber-400" />
              )}
              <div>
                <span className="font-bold text-xs block">
                  {commsData.activeLinkAvailable ? "ACTIVE ORBITAL RELAY" : "COMMUNICATION BLACKOUT"}
                </span>
                <span className="text-[10px] text-atlas-muted">
                  {commsData.activeLinkAvailable
                    ? `Primary: ${commsData.bestActiveOrbiter}`
                    : `Next pass in ${commsData.nextPassWindowMinutes} min`}
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-sm font-bold block">
                {commsData.combinedBandwidthKbps} kbps
              </span>
              <span className="text-[9px] text-atlas-muted uppercase">UHF Band</span>
            </div>
          </div>

          {/* Topographic Scarp Masking Alert */}
          <div className="bg-atlas-bg/60 border border-atlas-border/60 p-2.5">
            <div className="flex items-center justify-between text-atlas-muted mb-1 text-[11px]">
              <span className="flex items-center space-x-1.5 font-semibold text-atlas-text">
                <ShieldAlert className="w-3.5 h-3.5 text-atlas-accent" />
                <span>MOLA Horizon Elevation Mask</span>
              </span>
              <span className="text-[10px] bg-atlas-elevated px-1.5 py-0.5 border border-atlas-border text-atlas-teal font-semibold">
                {commsData.topographicMaskDeg.toFixed(1)}° Mask
              </span>
            </div>
            <div className="text-[10px] text-atlas-muted mt-1 leading-relaxed">
              Topographic scarp elevates the effective horizon from nominal 15° to{" "}
              {commsData.topographicMaskDeg.toFixed(1)}°, causing shadow occultation on low-elevation passes.
            </div>
          </div>

          {/* Constellation Relay Pass Windows */}
          <div className="bg-atlas-bg/60 border border-atlas-border/60 p-2.5">
            <span className="text-atlas-text font-semibold text-[11px] block mb-2">
              Overhead Constellation Passes ({commsData.passWindows?.length || 0})
            </span>
            <div className="space-y-1.5">
              {commsData.passWindows?.map((pw: any, idx: number) => (
                <div
                  key={idx}
                  className={`p-2 border text-[10px] flex items-center justify-between ${
                    pw.active
                      ? "bg-atlas-elevated border-atlas-teal/80 text-atlas-text"
                      : "bg-atlas-surface border-atlas-border text-atlas-muted"
                  }`}
                >
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <span className="font-bold text-atlas-text">{pw.orbiter}</span>
                      {pw.active && (
                        <span className="px-1 py-0.2 bg-emerald-950/60 border border-emerald-700 text-emerald-300 text-[8px] font-bold">
                          ACTIVE LINK
                        </span>
                      )}
                    </div>
                    <span className="text-[9px] text-atlas-muted block mt-0.5">
                      AOS: +{pw.startMin}m | LOS: +{pw.endMin}m (Dur: {pw.durationMin}m)
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-atlas-teal block">{pw.maxElevationDeg}°</span>
                    <span className="text-[9px] text-atlas-muted">Max El</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Contingency Protocol */}
          <div className="p-2 bg-amber-950/20 border border-amber-800/40 text-amber-300 text-[10px] flex items-start space-x-2">
            <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block">NASA Flight Rule LOS Contingency:</span>
              <span>
                Autonomous robotic relay drone or companion rover forward-relay automatically dispatches when LOS exceeds 45 minutes.
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
