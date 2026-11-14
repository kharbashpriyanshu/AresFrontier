import { MarsCoordinate, RoutePoint } from "../../types/index.js";
import { calculateMarsDistanceKm } from "../../utils/marsCoordinates.js";
import { multiOrbiterVisibilityEngine, ConstellationCommsSummary } from "./multiOrbiterVisibilityEngine.js";

export interface ScheduledTraverseStop {
  stopIndex: number;
  waypointId: string;
  label: string;
  coordinate: MarsCoordinate;
  arrivalMinute: number;
  departureMinute: number;
  durationMinutes: number;
  commsProfileAtArrival: ConstellationCommsSummary;
  bestOrbiter: string | null;
  linkStatus: "HIGH_BANDWIDTH_PASS" | "MODERATE_LINK" | "COMM_BLACKOUT";
  recommendedTransmissionStrategy: "DIRECT_UHF_DOWNLINK" | "STORE_AND_FORWARD_LOCAL_BUFFER";
  scienceWindowAlignment: "OPTIMALLY_ALIGNED" | "OFFSET_REQUIRED" | "NON_CRITICAL";
}

export interface TraverseCommsScheduleResult {
  missionDurationMinutes: number;
  stops: ScheduledTraverseStop[];
  totalHighBandwidthWindowsMinutes: number;
  totalBlackoutMinutes: number;
  optimalStartTimeMinutes: number;
  scheduleDirective: string;
}

export class CommWindowScheduler {
  private static instance: CommWindowScheduler;

  public static getInstance(): CommWindowScheduler {
    if (!CommWindowScheduler.instance) {
      CommWindowScheduler.instance = new CommWindowScheduler();
    }
    return CommWindowScheduler.instance;
  }

  /**
   * Generates a communication-aligned schedule for a multi-waypoint EVA traverse.
   * Standard walking pace: ~3.0 km/h (0.05 km/min).
   * Default science stop duration: 25 minutes per stop.
   */
  public scheduleTraverse(
    points: RoutePoint[],
    startMinuteOffset: number = 0,
    stopDurationMinutes: number = 25
  ): TraverseCommsScheduleResult {
    const stops: ScheduledTraverseStop[] = [];
    let currentMinute = startMinuteOffset;
    let totalHighBandwidth = 0;
    let totalBlackout = 0;

    for (let i = 0; i < points.length; i++) {
      const pt = points[i];

      if (i > 0) {
        const distKm = calculateMarsDistanceKm(points[i - 1].coordinate, pt.coordinate);
        const transitMinutes = Math.max(3, Math.ceil(distKm / 0.05)); // 3 km/h
        currentMinute += transitMinutes;
      }

      const isScienceStop = pt.type === "science" || (i > 0 && i < points.length - 1);
      const dwellMinutes = isScienceStop ? stopDurationMinutes : 5;

      const comms = multiOrbiterVisibilityEngine.evaluateConstellation(pt.coordinate, currentMinute);
      const isBlackout = comms.constellationStatus === "CONSTELLATION_BLACKOUT";
      const isHighBandwidth = comms.combinedBandwidthKbps >= 2048;

      if (isHighBandwidth) totalHighBandwidth += dwellMinutes;
      if (isBlackout) totalBlackout += dwellMinutes;

      const bestOrb = comms.bestActiveOrbiter?.id || null;
      const linkStatus: "HIGH_BANDWIDTH_PASS" | "MODERATE_LINK" | "COMM_BLACKOUT" = isBlackout
        ? "COMM_BLACKOUT"
        : isHighBandwidth
        ? "HIGH_BANDWIDTH_PASS"
        : "MODERATE_LINK";

      const strategy: "DIRECT_UHF_DOWNLINK" | "STORE_AND_FORWARD_LOCAL_BUFFER" = isBlackout
        ? "STORE_AND_FORWARD_LOCAL_BUFFER"
        : "DIRECT_UHF_DOWNLINK";

      const alignment: "OPTIMALLY_ALIGNED" | "OFFSET_REQUIRED" | "NON_CRITICAL" = isScienceStop
        ? isHighBandwidth
          ? "OPTIMALLY_ALIGNED"
          : isBlackout
          ? "OFFSET_REQUIRED"
          : "NON_CRITICAL"
        : "NON_CRITICAL";

      stops.push({
        stopIndex: i,
        waypointId: pt.id,
        label: pt.label || `Waypoint ${i + 1}`,
        coordinate: pt.coordinate,
        arrivalMinute: currentMinute,
        departureMinute: currentMinute + dwellMinutes,
        durationMinutes: dwellMinutes,
        commsProfileAtArrival: comms,
        bestOrbiter: bestOrb,
        linkStatus,
        recommendedTransmissionStrategy: strategy,
        scienceWindowAlignment: alignment,
      });

      currentMinute += dwellMinutes;
    }

    let directive = "Nominal Communication Windows: Traverse maintains continuous relay visibility.";
    if (totalBlackout > 0) {
      directive = `Advisory: ${totalBlackout} min of RF blackout expected during traverse. Buffer science data in suit local SSD until next orbiter overhead pass.`;
    } else if (totalHighBandwidth > 30) {
      directive = `Optimal: ${totalHighBandwidth} min of high-bandwidth (MRO/TGO Electra) coverage confirmed for active science stops.`;
    }

    return {
      missionDurationMinutes: currentMinute - startMinuteOffset,
      stops,
      totalHighBandwidthWindowsMinutes: totalHighBandwidth,
      totalBlackoutMinutes: totalBlackout,
      optimalStartTimeMinutes: startMinuteOffset,
      scheduleDirective: directive,
    };
  }
}

export const commWindowScheduler = CommWindowScheduler.getInstance();
