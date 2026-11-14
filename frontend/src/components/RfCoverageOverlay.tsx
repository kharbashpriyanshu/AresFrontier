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
  Radio,
  CheckCircle2,
} from "lucide-react";

interface RfCoverageOverlayProps {
  coordinate: MarsCoordinate;
  onClose: () => void;
}

export const RfCoverageOverlay: React.FC<RfCoverageOverlayProps> = ({
  coordinate,
  onClose,
}) => {
  const [sol] = useState<number>(100);
  const [durationMin] = useState<number>(60);
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
          setError(err?.message || "Failed to load constellation communication telemetry");
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [coordinate.latitude, coordinate.longitude, sol, durationMin]);

  const activeRelayCount = commsData?.activeRelayCount ?? 0;
  const isLinkActive = activeRelayCount > 0 || commsData?.constellationStatus === "NOMINAL_LINK";
  const bestOrbiterName =
    typeof commsData?.bestActiveOrbiter === "object" && commsData?.bestActiveOrbiter !== null
      ? commsData.bestActiveOrbiter.name || commsData.bestActiveOrbiter.id
      : typeof commsData?.bestActiveOrbiter === "string"
      ? commsData.bestActiveOrbiter
      : "No Active Direct Link";

  const orbitersList: any[] = Array.isArray(commsData?.orbiters) ? commsData.orbiters : [];
  const combinedBw = commsData?.combinedBandwidthKbps ?? (isLinkActive ? 2048 : 0);
  const topographicMask = typeof commsData?.topographicMaskDeg === "number" ? commsData.topographicMaskDeg : 15.0;

  return (
    <div className="absolute bottom-6 right-4 z-40 w-96 max-w-[calc(100vw-2rem)] bg-atlas-surface/95 border border-atlas-border backdrop-blur-md shadow-2xl p-4 font-mono text-xs text-atlas-text flex flex-col space-y-3 pointer-events-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-atlas-border pb-2">
        <div className="flex items-center space-x-2">
          <Satellite className="w-4 h-4 text-atlas-teal animate-pulse" />
          <span className="font-bold uppercase tracking-wider text-sm text-atlas-text">
            Orbiter Relay &amp; RF Coverage
          </span>
          <span className="px-1.5 py-0.5 rounded bg-atlas-elevated border border-atlas-border text-[9px] text-atlas-teal font-semibold">
            MRO/TGO
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
          <span className="text-[11px]">Computing Ephemeris &amp; Horizon Shadows...</span>
        </div>
      ) : error ? (
        <div className="py-4 text-atlas-accent text-[11px] flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : commsData ? (
        <div className="space-y-3 overflow-y-auto max-h-[60vh] pr-1">
          {/* Active Link Status Banner */}
          <div
            className={`p-2.5 border flex items-center justify-between ${
              isLinkActive
                ? "bg-emerald-950/30 border-emerald-800/60 text-emerald-300"
                : "bg-amber-950/30 border-amber-800/60 text-amber-300"
            }`}
          >
            <div className="flex items-center space-x-2">
              {isLinkActive ? (
                <Wifi className="w-4 h-4 text-emerald-400" />
              ) : (
                <WifiOff className="w-4 h-4 text-amber-400" />
              )}
              <div>
                <span className="font-bold text-xs block">
                  {isLinkActive ? "ACTIVE ORBITAL RELAY PASS" : "COMMUNICATION RF BLACKOUT"}
                </span>
                <span className="text-[10px] text-atlas-muted block mt-0.5">
                  {isLinkActive
                    ? `Primary: ${bestOrbiterName}`
                    : `Next pass window in ${commsData.predictedNextBlackoutStartMinute ?? 28} min`}
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-sm font-bold block">{combinedBw} kbps</span>
              <span className="text-[9px] text-atlas-muted uppercase">UHF Electra</span>
            </div>
          </div>

          {/* Topographic Scarp Masking Alert */}
          <div className="bg-atlas-elevated/70 border border-atlas-border p-2.5 space-y-1">
            <div className="flex items-center justify-between text-atlas-muted text-[11px]">
              <span className="flex items-center space-x-1.5 font-semibold text-atlas-text">
                <ShieldAlert className="w-3.5 h-3.5 text-atlas-accent" />
                <span>MOLA Scarp Elevation Mask</span>
              </span>
              <span className="text-[10px] bg-atlas-surface px-1.5 py-0.5 border border-atlas-border text-atlas-teal font-semibold">
                {topographicMask.toFixed(1)}° Horizon
              </span>
            </div>
            <div className="text-[10px] text-atlas-muted leading-relaxed">
              Topographic crater rim elevates effective horizon to {topographicMask.toFixed(1)}°, causing topological shadow occultation on low-elevation passes.
            </div>
          </div>

          {/* Constellation Relay Pass List */}
          <div className="bg-atlas-elevated/70 border border-atlas-border p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-atlas-text font-semibold text-[11px] flex items-center space-x-1">
                <Radio className="w-3.5 h-3.5 text-atlas-teal" />
                <span>Overhead Constellation Orbiters ({orbitersList.length})</span>
              </span>
              <span className="text-[10px] text-atlas-muted">{activeRelayCount} In View</span>
            </div>

            <div className="space-y-1.5">
              {orbitersList.map((orb: any) => {
                const isPassActive = orb.passState === "PASS_ACTIVE";
                const isApproaching = orb.passState === "PASS_APPROACHING";
                return (
                  <div
                    key={orb.id}
                    className={`p-2 border text-[10px] flex items-center justify-between ${
                      isPassActive
                        ? "bg-atlas-surface border-atlas-teal text-atlas-text shadow-sm"
                        : "bg-atlas-surface/60 border-atlas-border text-atlas-muted"
                    }`}
                  >
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="font-bold text-atlas-text">{orb.name || orb.id}</span>
                        {isPassActive ? (
                          <span className="px-1 py-0.2 bg-emerald-950/80 border border-emerald-700 text-emerald-300 text-[8px] font-bold">
                            {orb.passQuality || "ACTIVE"}
                          </span>
                        ) : isApproaching ? (
                          <span className="px-1 py-0.2 bg-amber-950/80 border border-amber-700 text-amber-300 text-[8px] font-bold">
                            APPROACHING
                          </span>
                        ) : (
                          <span className="px-1 py-0.2 bg-atlas-elevated text-atlas-muted text-[8px]">
                            LOS
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] text-atlas-muted block mt-0.5">
                        Alt: {orb.orbitalAltitudeKm} km | Period: {orb.orbitalPeriodMinutes} min |{" "}
                        {isPassActive
                          ? `Remaining: ${orb.passRemainingMinutes} min`
                          : `Next AOS: in ${orb.nextPassInMinutes} min`}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="font-bold text-atlas-teal block">
                        {typeof orb.currentElevationDeg === "number" ? orb.currentElevationDeg.toFixed(1) : "0.0"}°
                      </span>
                      <span className="text-[9px] text-atlas-muted">
                        {orb.maxBandwidthKbps ? `${orb.maxBandwidthKbps}k` : "0k"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Contingency Store-and-Forward Protocol */}
          <div className="p-2 bg-amber-950/20 border border-amber-800/40 text-amber-300 text-[10px] flex items-start space-x-2">
            <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-amber-400" />
                NASA Flight Rule 14.2 Store-and-Forward:
              </span>
              <span className="text-[10px] text-atlas-muted">
                Suit telemetry buffer automatically captures and holds high-resolution spectral and bioenergetic records during LOS intervals, auto-syncing upon orbiter AOS.
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
