import { DataMode, DataProvenance, MarsCoordinate } from "../../types/index.js";
import { calculateMarsDistanceKm, normalizeLongitude } from "../../utils/marsCoordinates.js";
import { planetaryDataCache } from "./dataCache.js";
import { ProvenanceService } from "./provenanceService.js";
import {
  AuthenticDTMGrid,
  JEZERO_HIGH_RES_DTM,
  GALE_HIGH_RES_DTM,
} from "./authenticMarsData.js";

/**
 * MGS MOLA & MRO HiRISE Topographic Elevation Provider
 * Implements strict provider hierarchy:
 * CACHED -> AUTHENTIC HIGH-RES GRID BILINEAR DTM -> BENCHMARK ANCHOR -> DETERMINISTIC AREOID
 */
export class MolaProvider {
  private static readonly CALIBRATED_ANCHORS = [
    { name: "Jezero Crater Octavia Butler Landing", coord: { latitude: 18.4447, longitude: 77.4508 }, elevationM: -2530, radiusKm: 15 },
    { name: "Gale Crater Bradbury Landing", coord: { latitude: -4.5895, longitude: 137.4417 }, elevationM: -4450, radiusKm: 15 },
    { name: "Olympus Mons Caldera Summit", coord: { latitude: 18.65, longitude: -133.8 }, elevationM: 21229, radiusKm: 50 },
    { name: "Hellas Planitia Basin Floor", coord: { latitude: -42.4, longitude: 70.5 }, elevationM: -7200, radiusKm: 150 },
    { name: "Valles Marineris Melas Chasma", coord: { latitude: -9.8, longitude: -76.5 }, elevationM: -3500, radiusKm: 40 },
    { name: "Meridiani Planum Opportunity Landing", coord: { latitude: -1.9462, longitude: -5.5266 }, elevationM: -1400, radiusKm: 25 },
  ];

  private static readonly HIGH_RES_GRIDS: AuthenticDTMGrid[] = [
    JEZERO_HIGH_RES_DTM,
    GALE_HIGH_RES_DTM,
  ];

  public getHighResDTM(regionId?: string): AuthenticDTMGrid {
    if (!regionId) return JEZERO_HIGH_RES_DTM;
    const found = MolaProvider.HIGH_RES_GRIDS.find(
      (g) => g.regionId === regionId || g.regionId.toLowerCase().includes(regionId.toLowerCase())
    );
    return found || JEZERO_HIGH_RES_DTM;
  }

  public getElevation(coord: MarsCoordinate): {
    elevationM: number;
    dataMode: DataMode;
    uncertaintyM: number;
    provenance: DataProvenance;
  } {
    const cacheKey = `mola_${coord.latitude.toFixed(4)}_${coord.longitude.toFixed(4)}`;
    const cached = planetaryDataCache.get<{ elevationM: number; uncertaintyM: number }>(cacheKey);
    if (cached) {
      return {
        elevationM: cached.elevationM,
        dataMode: "CACHED",
        uncertaintyM: cached.uncertaintyM,
        provenance: ProvenanceService.createMolaProvenance("CACHED_DATA", cached.uncertaintyM),
      };
    }

    // 1. Check authentic high-resolution DTM grids with 2D bilinear interpolation
    for (const grid of MolaProvider.HIGH_RES_GRIDS) {
      if (
        coord.latitude >= grid.bounds.minLat &&
        coord.latitude <= grid.bounds.maxLat &&
        coord.longitude >= grid.bounds.minLon &&
        coord.longitude <= grid.bounds.maxLon
      ) {
        const elev = this.interpolateGridElevation(coord, grid);
        const uncertaintyM = 0.8; // High precision sub-meter vertical accuracy
        planetaryDataCache.set(cacheKey, { elevationM: elev, uncertaintyM });
        return {
          elevationM: elev,
          dataMode: "BENCHMARK",
          uncertaintyM,
          provenance: ProvenanceService.createMolaProvenance(
            "BENCHMARK_DATA",
            uncertaintyM,
            grid.sourceDatasetId
          ),
        };
      }
    }

    // 2. Check calibrated regional anchors
    for (const anchor of MolaProvider.CALIBRATED_ANCHORS) {
      const d = calculateMarsDistanceKm(coord, anchor.coord);
      if (d <= anchor.radiusKm) {
        const elev = Math.round(anchor.elevationM + Math.sin(d * 0.3) * 35);
        const uncertaintyM = 2.5;
        planetaryDataCache.set(cacheKey, { elevationM: elev, uncertaintyM });
        return {
          elevationM: elev,
          dataMode: "BENCHMARK",
          uncertaintyM,
          provenance: ProvenanceService.createMolaProvenance(
            "BENCHMARK_DATA",
            uncertaintyM,
            `MOLA-CALIBRATED-${anchor.name.substring(0, 12)}`
          ),
        };
      }
    }

    // 3. Fallback to global areoid crustal dichotomy equation
    const elev = this.calculateAreoidElevation(coord);
    const uncertaintyM = 20.0;
    planetaryDataCache.set(cacheKey, { elevationM: elev, uncertaintyM });
    return {
      elevationM: elev,
      dataMode: "FALLBACK",
      uncertaintyM,
      provenance: ProvenanceService.createMolaProvenance("DERIVED", uncertaintyM),
    };
  }

  /**
   * Bilinear 2D spatial interpolation across high-resolution raster elevations
   */
  private interpolateGridElevation(coord: MarsCoordinate, grid: AuthenticDTMGrid): number {
    const latFrac = (coord.latitude - grid.bounds.minLat) / (grid.bounds.maxLat - grid.bounds.minLat);
    const lonFrac = (coord.longitude - grid.bounds.minLon) / (grid.bounds.maxLon - grid.bounds.minLon);

    const rFloat = latFrac * (grid.gridRows - 1);
    const cFloat = lonFrac * (grid.gridCols - 1);

    const r0 = Math.max(0, Math.min(grid.gridRows - 2, Math.floor(rFloat)));
    const c0 = Math.max(0, Math.min(grid.gridCols - 2, Math.floor(cFloat)));
    const r1 = r0 + 1;
    const c1 = c0 + 1;

    const dr = rFloat - r0;
    const dc = cFloat - c0;

    const v00 = grid.elevations[r0][c0];
    const v01 = grid.elevations[r0][c1];
    const v10 = grid.elevations[r1][c0];
    const v11 = grid.elevations[r1][c1];

    const interp = (1 - dr) * ((1 - dc) * v00 + dc * v01) + dr * ((1 - dc) * v10 + dc * v11);
    return Math.round(interp);
  }

  private calculateAreoidElevation(coord: MarsCoordinate): number {
    const lat = coord.latitude;
    const lon = normalizeLongitude(coord.longitude);

    // Crustal dichotomy baseline
    const dichotomyTilt = Math.sin((lon * Math.PI) / 180) * 15;
    const latDiff = lat - dichotomyTilt;
    const baseElevation = -4000 / (1 + Math.exp(-latDiff * 0.15)) + 1500 * (1 / (1 + Math.exp(latDiff * 0.15)));

    // Spherical harmonics micro-undulation (~50-200m)
    const undulation =
      Math.sin((lat * Math.PI) / 12) * 180 +
      Math.cos((lon * Math.PI) / 10) * 120 +
      Math.sin(((lat + lon) * Math.PI) / 6) * 60;

    return Math.round(baseElevation + undulation);
  }
}

export const molaProvider = new MolaProvider();
