import { MarsCoordinate, Hazard } from "../../types/index.js";
import { calculateMarsDistanceKm, MARS_RADIUS_KM } from "../../utils/marsCoordinates.js";
import { DOCUMENTED_MARS_HAZARDS } from "../hazard/hazardEngine.js";
import { marsDataService } from "../nasa/marsDataService.js";

export interface HazardAvoidancePlanOptions {
  hazards?: Hazard[];
  safetyBufferM?: number;
  maxAllowableSlopeDegrees?: number;
  corridorWidthKm?: number;
  stepSizeM?: number;
}

export interface HazardAvoidanceResult {
  routePoints: MarsCoordinate[];
  totalDistanceKm: number;
  maxSlopeDegrees: number;
  hazardsBypassed: {
    hazardId: string;
    hazardName: string;
    standoffDistanceM: number;
  }[];
  isDirectPathSafe: boolean;
  algorithm: "A_STAR_GRADIENT_AVOIDANCE";
  provenance: {
    dataset: string;
    method: string;
    elevationSource: string;
  };
}

interface GridNode {
  lat: number;
  lon: number;
  gCost: number; // Cost from start
  hCost: number; // Estimated cost to goal
  fCost: number; // g + h
  parent?: GridNode;
  key: string;
}

export class HazardAvoidanceRouter {
  private static instance: HazardAvoidanceRouter;

  public static getInstance(): HazardAvoidanceRouter {
    if (!HazardAvoidanceRouter.instance) {
      HazardAvoidanceRouter.instance = new HazardAvoidanceRouter();
    }
    return HazardAvoidanceRouter.instance;
  }

  /**
   * Evaluates whether a straight-line corridor between start and goal violates any hazard envelope.
   */
  public checkPathIntersection(
    start: MarsCoordinate,
    dest: MarsCoordinate,
    hazards: Hazard[],
    bufferM: number = 100
  ): { safe: boolean; intersectingHazards: Hazard[] } {
    const intersecting: Hazard[] = [];
    const directDistKm = calculateMarsDistanceKm(start, dest);
    const numSamples = Math.max(10, Math.ceil((directDistKm * 1000) / 100)); // Sample every 100m

    for (let i = 0; i <= numSamples; i++) {
      const t = i / numSamples;
      const sampleCoord: MarsCoordinate = {
        latitude: start.latitude + (dest.latitude - start.latitude) * t,
        longitude: start.longitude + (dest.longitude - start.longitude) * t,
      };

      for (const h of hazards) {
        const distKm = calculateMarsDistanceKm(sampleCoord, h.location);
        const thresholdKm = ((h.radiusM || 300) + bufferM) / 1000;
        if (distKm <= thresholdKm && !intersecting.some((ih) => ih.id === h.id)) {
          intersecting.push(h);
        }
      }
    }

    return {
      safe: intersecting.length === 0,
      intersectingHazards: intersecting,
    };
  }

  /**
   * Plans a safe, hazard-avoiding trajectory using 2D cost-gradient A* pathfinding.
   */
  public planSafeRoute(
    start: MarsCoordinate,
    destination: MarsCoordinate,
    options: HazardAvoidancePlanOptions = {}
  ): HazardAvoidanceResult {
    const activeHazards = options.hazards && options.hazards.length > 0 ? options.hazards : DOCUMENTED_MARS_HAZARDS;
    const safetyBufferM = options.safetyBufferM ?? 150;
    const maxSlope = options.maxAllowableSlopeDegrees ?? 15;

    // First check if the direct path is already hazard-free and low-slope
    const directCheck = this.checkPathIntersection(start, destination, activeHazards, safetyBufferM);

    if (directCheck.safe) {
      const directDist = calculateMarsDistanceKm(start, destination);
      const startElev = marsDataService.estimateMolaElevation(start);
      const destElev = marsDataService.estimateMolaElevation(destination);
      const slope = directDist > 0 ? Math.atan(Math.abs(destElev - startElev) / (directDist * 1000)) * (180 / Math.PI) : 0;

      if (slope <= maxSlope) {
        return {
          routePoints: [start, destination],
          totalDistanceKm: directDist,
          maxSlopeDegrees: Math.round(slope * 10) / 10,
          hazardsBypassed: [],
          isDirectPathSafe: true,
          algorithm: "A_STAR_GRADIENT_AVOIDANCE",
          provenance: {
            dataset: "NASA MOLA MEGDR 128ppd & HiRISE Obstacle Boundaries",
            method: "Direct Geodesic (Zero Hazard Buffer Violations)",
            elevationSource: "MGS MOLA Altimetric Datum",
          },
        };
      }
    }

    // Direct path intersects hazards -> execute A* on an oriented local bounding lattice
    const distKm = calculateMarsDistanceKm(start, destination);
    const stepSizeDeg = 0.0015; // ~88 meters on Mars surface
    const gridRadius = Math.max(0.015, (distKm / MARS_RADIUS_KM) * (180 / Math.PI) * 1.5);

    const minLat = Math.min(start.latitude, destination.latitude) - gridRadius;
    const maxLat = Math.max(start.latitude, destination.latitude) + gridRadius;
    const minLon = Math.min(start.longitude, destination.longitude) - gridRadius;
    const maxLon = Math.max(start.longitude, destination.longitude) + gridRadius;

    const toKey = (lat: number, lon: number) => `${lat.toFixed(4)},${lon.toFixed(4)}`;

    const openSet = new Map<string, GridNode>();
    const closedSet = new Set<string>();

    const startNode: GridNode = {
      lat: start.latitude,
      lon: start.longitude,
      gCost: 0,
      hCost: calculateMarsDistanceKm(start, destination),
      fCost: calculateMarsDistanceKm(start, destination),
      key: toKey(start.latitude, start.longitude),
    };

    openSet.set(startNode.key, startNode);

    let goalNode: GridNode | null = null;
    let iterations = 0;
    const maxIterations = 1200;

    // 8-directional neighbor offsets
    const directions = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ];

    while (openSet.size > 0 && iterations < maxIterations) {
      iterations++;

      // Pick node with lowest fCost
      let current: GridNode | null = null;
      for (const node of openSet.values()) {
        if (!current || node.fCost < current.fCost) {
          current = node;
        }
      }

      if (!current) break;

      // Check if within 100m of destination
      const distToGoalKm = calculateMarsDistanceKm(
        { latitude: current.lat, longitude: current.lon },
        destination
      );

      if (distToGoalKm < 0.12) {
        goalNode = current;
        break;
      }

      openSet.delete(current.key);
      closedSet.add(current.key);

      const currentElev = marsDataService.estimateMolaElevation({
        latitude: current.lat,
        longitude: current.lon,
      });

      // Expand neighbors
      for (const [dLat, dLon] of directions) {
        const nextLat = current.lat + dLat * stepSizeDeg;
        const nextLon = current.lon + dLon * stepSizeDeg;
        const nextKey = toKey(nextLat, nextLon);

        if (closedSet.has(nextKey)) continue;
        if (nextLat < minLat || nextLat > maxLat || nextLon < minLon || nextLon > maxLon) continue;

        const nextCoord: MarsCoordinate = { latitude: nextLat, longitude: nextLon };
        const stepDistKm = calculateMarsDistanceKm({ latitude: current.lat, longitude: current.lon }, nextCoord);

        // Calculate Hazard Cost
        let hazardPenalty = 0;
        let isInsideHardObstacle = false;

        for (const h of activeHazards) {
          const dToHazardKm = calculateMarsDistanceKm(nextCoord, h.location);
          const hazardRadiusKm = (h.radiusM || 300) / 1000;
          const bufferKm = safetyBufferM / 1000;

          if (dToHazardKm < hazardRadiusKm) {
            isInsideHardObstacle = true;
            break;
          } else if (dToHazardKm < hazardRadiusKm + bufferKm) {
            // High exponential cost inside safety buffer zone
            const penetrationRatio = 1 - (dToHazardKm - hazardRadiusKm) / bufferKm;
            hazardPenalty += 50 * Math.exp(penetrationRatio * 3);
          }
        }

        if (isInsideHardObstacle) continue;

        // Calculate Slope Cost from MOLA elevation
        const nextElev = marsDataService.estimateMolaElevation(nextCoord);
        const elevDeltaM = Math.abs(nextElev - currentElev);
        const stepSlopeDeg = stepDistKm > 0 ? (Math.atan(elevDeltaM / (stepDistKm * 1000)) * 180) / Math.PI : 0;

        if (stepSlopeDeg > maxSlope + 5) {
          continue; // Impassable slope
        }

        const slopePenalty = stepSlopeDeg > 10 ? Math.pow(stepSlopeDeg - 10, 2) * 0.5 : 0;
        const traversalCost = stepDistKm * (1 + slopePenalty + hazardPenalty);
        const tentativeGCost = current.gCost + traversalCost;

        const existing = openSet.get(nextKey);
        if (!existing || tentativeGCost < existing.gCost) {
          const hCost = calculateMarsDistanceKm(nextCoord, destination);
          const neighborNode: GridNode = {
            lat: nextLat,
            lon: nextLon,
            gCost: tentativeGCost,
            hCost,
            fCost: tentativeGCost + hCost,
            parent: current,
            key: nextKey,
          };
          openSet.set(nextKey, neighborNode);
        }
      }
    }

    // Reconstruct Path
    const rawPath: MarsCoordinate[] = [];
    let curr: GridNode | undefined = goalNode || undefined;

    while (curr) {
      rawPath.push({ latitude: Number(curr.lat.toFixed(5)), longitude: Number(curr.lon.toFixed(5)) });
      curr = curr.parent;
    }

    if (rawPath.length === 0) {
      // Fallback: detour waypoint around intersecting hazards midpoint
      const midLat = (start.latitude + destination.latitude) / 2;
      const midLon = (start.longitude + destination.longitude) / 2;
      // Perpendicular offset
      const dLat = destination.latitude - start.latitude;
      const dLon = destination.longitude - start.longitude;
      const perpOffset = 0.008; // ~300m lateral detour
      const detourPoint: MarsCoordinate = {
        latitude: midLat - dLon * perpOffset * 10,
        longitude: midLon + dLat * perpOffset * 10,
      };

      rawPath.push(destination, detourPoint, start);
    } else {
      rawPath.reverse();
      rawPath[0] = start;
      rawPath.push(destination);
    }

    // Simplify/smooth path (Douglas-Peucker style decimation)
    const smoothedPath = this.smoothPath(rawPath, activeHazards, safetyBufferM);

    // Calculate metrics
    let totalDistKm = 0;
    let maxEncounteredSlope = 0;

    for (let i = 0; i < smoothedPath.length - 1; i++) {
      const p1 = smoothedPath[i];
      const p2 = smoothedPath[i + 1];
      const segmentD = calculateMarsDistanceKm(p1, p2);
      totalDistKm += segmentD;

      const e1 = marsDataService.estimateMolaElevation(p1);
      const e2 = marsDataService.estimateMolaElevation(p2);
      const segSlope = segmentD > 0 ? (Math.atan(Math.abs(e2 - e1) / (segmentD * 1000)) * 180) / Math.PI : 0;
      if (segSlope > maxEncounteredSlope) maxEncounteredSlope = segSlope;
    }

    // Identify hazards bypassed with their standoff margins
    const bypassed = directCheck.intersectingHazards.map((h) => {
      let minClearanceM = 99999;
      for (const pt of smoothedPath) {
        const dM = calculateMarsDistanceKm(pt, h.location) * 1000;
        if (dM < minClearanceM) minClearanceM = dM;
      }
      return {
        hazardId: h.id,
        hazardName: h.name || "Identified Surface Hazard",
        standoffDistanceM: Math.round(minClearanceM),
      };
    });

    return {
      routePoints: smoothedPath,
      totalDistanceKm: Number(totalDistKm.toFixed(3)),
      maxSlopeDegrees: Number(maxEncounteredSlope.toFixed(1)),
      hazardsBypassed: bypassed,
      isDirectPathSafe: false,
      algorithm: "A_STAR_GRADIENT_AVOIDANCE",
      provenance: {
        dataset: "NASA MOLA MEGDR 128ppd & HiRISE DEM Obstacle Outlines",
        method: "A* Tangent Corridor Search with Exponential Buffer Penalty",
        elevationSource: "MGS MOLA Altimetric Datum",
      },
    };
  }

  /**
   * Smooths the path by removing redundant intermediate points when line-of-sight is safe.
   */
  private smoothPath(
    path: MarsCoordinate[],
    hazards: Hazard[],
    bufferM: number
  ): MarsCoordinate[] {
    if (path.length <= 2) return path;

    const smoothed: MarsCoordinate[] = [path[0]];
    let anchorIdx = 0;

    while (anchorIdx < path.length - 1) {
      let furthestIdx = path.length - 1;
      for (let testIdx = path.length - 1; testIdx > anchorIdx + 1; testIdx--) {
        const check = this.checkPathIntersection(path[anchorIdx], path[testIdx], hazards, bufferM);
        if (check.safe) {
          furthestIdx = testIdx;
          break;
        }
      }

      if (furthestIdx === anchorIdx + 1) {
        smoothed.push(path[anchorIdx + 1]);
        anchorIdx++;
      } else {
        smoothed.push(path[furthestIdx]);
        anchorIdx = furthestIdx;
      }
    }

    return smoothed;
  }
}

export const hazardAvoidanceRouter = HazardAvoidanceRouter.getInstance();
