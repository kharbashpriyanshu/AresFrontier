import crypto from "crypto";
import fs from "fs";
import path from "path";
import { CANONICAL_BACKEND_DATA_DIR } from "../../utils/dataDir.js";
import { DataSourceInfo } from "../../types/index.js";

export interface IngestedDatasetRecord extends DataSourceInfo {
  retrievedAt: string;
  checksumSha256: string;
  byteSize: number;
  coordinateSystem: string;
  featureCount: number;
  boundingBox: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
  summary: {
    currentSol?: number;
    totalDistanceKm?: number;
    latestRmc?: string;
    latestElevationM?: number;
  };
  mapOverlay?: {
    segments: [number, number][][];
    currentPosition?: {
      latitude: number;
      longitude: number;
      sol: number;
      totalDistanceKm: number;
    } | null;
  };
}

export class NasaDatasetIngestionService {
  private filePath: string;
  private ingested: IngestedDatasetRecord[] = [];

  public static readonly M20_WAYPOINT_URL =
    "https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints_current.json";
  public static readonly M20_TRAVERSE_URL =
    "https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_traverse.json";

  constructor() {
    this.filePath = path.resolve(CANONICAL_BACKEND_DATA_DIR, "ingested-datasets.json");
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, "utf-8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.ingested = parsed;
        }
      }
    } catch {
      this.ingested = [];
    }
  }

  private save(): void {
    try {
      if (!fs.existsSync(CANONICAL_BACKEND_DATA_DIR)) {
        fs.mkdirSync(CANONICAL_BACKEND_DATA_DIR, { recursive: true });
      }
      const tmp = `${this.filePath}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.ingested, null, 2), "utf-8");
      fs.renameSync(tmp, this.filePath);
    } catch (err) {
      console.warn("[NasaDatasetIngestionService] Failed to persist ingested datasets:", err);
    }
  }

  public getIngestedDatasets(): IngestedDatasetRecord[] {
    return [...this.ingested];
  }

  private isValidCoord(lat: unknown, lon: unknown): boolean {
    return (
      typeof lat === "number" &&
      typeof lon === "number" &&
      Number.isFinite(lat) &&
      Number.isFinite(lon) &&
      lat >= -90 &&
      lat <= 90 &&
      lon >= -180 &&
      lon <= 180
    );
  }

  public async ingestMars2020Traverse(): Promise<
    { ok: true; dataset: IngestedDatasetRecord } | { ok: false; message: string }
  > {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    try {
      const [wpRes, trRes] = await Promise.all([
        fetch(NasaDatasetIngestionService.M20_WAYPOINT_URL, {
          headers: { "User-Agent": "MartianMap/1.0" },
          signal: controller.signal,
        }),
        fetch(NasaDatasetIngestionService.M20_TRAVERSE_URL, {
          headers: { "User-Agent": "MartianMap/1.0" },
          signal: controller.signal,
        }),
      ]);
      clearTimeout(timer);

      if (!wpRes.ok || !trRes.ok) {
        return {
          ok: false,
          message: `NASA JPL MMGIS responded with HTTP ${wpRes.status}/${trRes.status}.`,
        };
      }

      const wpRaw = await wpRes.text();
      const trRaw = await trRes.text();
      const wpJson = JSON.parse(wpRaw);
      const trJson = JSON.parse(trRaw);

      if (
        wpJson?.type !== "FeatureCollection" ||
        !Array.isArray(wpJson.features) ||
        trJson?.type !== "FeatureCollection" ||
        !Array.isArray(trJson.features)
      ) {
        return {
          ok: false,
          message: "Retrieved NASA payload failed GeoJSON FeatureCollection schema validation.",
        };
      }

      let minLat = 90;
      let maxLat = -90;
      let minLon = 180;
      let maxLon = -180;
      const segments: [number, number][][] = [];

      for (const feat of trJson.features) {
        const coords = feat?.geometry?.coordinates;
        if (feat?.geometry?.type !== "LineString" || !Array.isArray(coords) || coords.length < 2) {
          continue;
        }
        const segPts: [number, number][] = [];
        // Downsample each drive segment cleanly while preserving endpoints
        const step = Math.max(1, Math.floor(coords.length / 8));
        for (let i = 0; i < coords.length; i += step) {
          const [lon, lat] = coords[i];
          if (!this.isValidCoord(lat, lon)) {
            return {
              ok: false,
              message: `Coordinate validation failed in NASA traverse feature: (${lat}, ${lon}).`,
            };
          }
          minLat = Math.min(minLat, lat);
          maxLat = Math.max(maxLat, lat);
          minLon = Math.min(minLon, lon);
          maxLon = Math.max(maxLon, lon);
          segPts.push([Number(lat.toFixed(6)), Number(lon.toFixed(6))]);
        }
        const last = coords[coords.length - 1];
        if (this.isValidCoord(last[1], last[0])) {
          segPts.push([Number(last[1].toFixed(6)), Number(last[0].toFixed(6))]);
        }
        if (segPts.length >= 2) {
          segments.push(segPts);
        }
      }

      const latestFeat = wpJson.features[0];
      const latestProps = latestFeat?.properties || {};
      const currentLat = Number(latestProps.lat);
      const currentLon = Number(latestProps.lon);
      const currentPos = this.isValidCoord(currentLat, currentLon)
        ? {
            latitude: currentLat,
            longitude: currentLon,
            sol: Number(latestProps.sol || 0),
            totalDistanceKm: Number(latestProps.dist_km || 0),
          }
        : null;

      const retrievedAt = new Date().toISOString();
      const checksumSha256 = crypto
        .createHash("sha256")
        .update(wpRaw)
        .update(trRaw)
        .digest("hex");

      const record: IngestedDatasetRecord = {
        id: "m20-mmgis-traverse",
        name: "Mars 2020 Perseverance Official Traverse & Current Waypoint (NASA JPL MMGIS)",
        mission: "Mars 2020 (Perseverance)",
        type: "in-situ",
        url: NasaDatasetIngestionService.M20_TRAVERSE_URL,
        status: "operational",
        lastSync: retrievedAt,
        retrievalTimestamp: retrievedAt,
        retrievedAt,
        attribution: "NASA / JPL-Caltech MMGIS Public Science Layers",
        coverage: `Jezero Crater (${segments.length} drive segments, ${Number(latestProps.dist_km || 0).toFixed(2)} km)`,
        recordKind: "INGESTED_DATASET",
        ingestionStatus: "INGESTED_LOCAL",
        product: "M20-MMGIS-TRAVERSE-GEOJSON",
        processingStage: "Ingested GeoJSON FeatureCollection (EPSG:4326)",
        validationStatus: "INGESTED_CHECKSUM_VERIFIED",
        classification: "MEASURED",
        pipelineName: "nasa-mmgis-geojson-ingestor-v1",
        modelVersion: `Sol-${latestProps.sol || "current"}`,
        checksumSha256,
        byteSize: Buffer.byteLength(wpRaw, "utf8") + Buffer.byteLength(trRaw, "utf8"),
        coordinateSystem: "EPSG:4326 (Mars Planetocentric)",
        featureCount: trJson.features.length,
        boundingBox: { minLat, maxLat, minLon, maxLon },
        summary: {
          currentSol: Number(latestProps.sol || 0),
          totalDistanceKm: Number(latestProps.dist_km || 0),
          latestRmc: String(latestProps.RMC || ""),
          latestElevationM: Number(latestProps.elev_geoid || 0),
        },
        limitations:
          "Official JPL MMGIS traverse tracks Perseverance rover localization; does not include future planned paths or non-Jezero sites.",
        mapOverlay: {
          segments,
          currentPosition: currentPos,
        },
      };

      this.ingested = [record, ...this.ingested.filter((d) => d.id !== record.id)];
      this.save();

      return { ok: true, dataset: record };
    } catch (err) {
      clearTimeout(timer);
      return {
        ok: false,
        message: err instanceof Error ? err.message : "Failed to ingest NASA JPL M20 dataset.",
      };
    }
  }
}

export const nasaDatasetIngestionService = new NasaDatasetIngestionService();

