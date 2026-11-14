import fs from "fs";
import path from "path";
import { MarsRoute, MissionParameters, EVAAssessment, ScienceObjectiveId } from "../types/index.js";

export type MissionPlanStatus = "DRAFT" | "APPROVED" | "LOCKED";

export interface StoredMission {
  id: string;
  name: string;
  description?: string;
  objectiveId?: ScienceObjectiveId;
  status: MissionPlanStatus;
  routeId: string;
  parameters: MissionParameters;
  evaAssessment: EVAAssessment;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MissionMetadataInput {
  name?: string;
  description?: string;
  objectiveId?: ScienceObjectiveId;
  status?: MissionPlanStatus;
  isDemo?: boolean;
}

import { CANONICAL_BACKEND_DATA_DIR } from "../utils/dataDir.js";

const baseDataDir = CANONICAL_BACKEND_DATA_DIR;

/**
 * Repository for Mars Routes and Missions.
 * Provides resilient persistence with atomic disk writes and in-memory caching.
 * Ensures routes and mission definitions survive server restarts.
 */
export class MissionRepository {
  private routes: Map<string, MarsRoute> = new Map();
  private missions: Map<string, StoredMission> = new Map();
  private routesFilePath: string;
  private missionsFilePath: string;
  private writeLock: Promise<void> = Promise.resolve();

  constructor() {
    this.routesFilePath = path.resolve(baseDataDir, "routes.json");
    this.missionsFilePath = path.resolve(baseDataDir, "missions.json");

    this.ensureStorageDir();
    this.loadFromDisk();
  }

  private ensureStorageDir(): void {
    if (!fs.existsSync(baseDataDir)) {
      try {
        fs.mkdirSync(baseDataDir, { recursive: true });
      } catch (err) {
        console.warn("[MissionRepository] Failed to create storage dir:", err);
      }
    }
  }

  /**
   * Loads persisted routes and missions from disk.
   * If files do not exist or are corrupted, falls back safely to default seed route.
   */
  public loadFromDisk(): boolean {
    let routesLoaded = false;
    let missionsLoaded = false;

    // 1. Load routes
    if (fs.existsSync(this.routesFilePath)) {
      try {
        const raw = fs.readFileSync(this.routesFilePath, "utf-8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.routes.clear();
          for (const route of parsed) {
            if (route && route.id) {
              this.routes.set(route.id, route);
            }
          }
          routesLoaded = true;
        }
      } catch (err) {
        console.warn("[MissionRepository] Corrupted routes.json detected. Backing up and restoring defaults.", err);
        this.backupCorruptedFile(this.routesFilePath);
      }
    }

    // 2. If no valid routes were loaded or default route was wiped empty, seed default route
    const existingDefault = this.routes.get("route-jezero-delta-sol100");
    if (!routesLoaded || this.routes.size === 0 || (existingDefault && (!existingDefault.points || existingDefault.points.length === 0))) {
      this.seedDefaultRoute();
      this.persistRoutesToDiskSync();
    }

    // 3. Load missions
    if (fs.existsSync(this.missionsFilePath)) {
      try {
        const raw = fs.readFileSync(this.missionsFilePath, "utf-8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.missions.clear();
          for (const mission of parsed) {
            if (mission && mission.id) {
              this.missions.set(mission.id, {
                ...mission,
                name: mission.name || `EVA Mission (${mission.id})`,
                status: mission.status || "DRAFT",
                updatedAt: mission.updatedAt || mission.createdAt || new Date().toISOString(),
              });
            }
          }
          missionsLoaded = true;
        }
      } catch (err) {
        console.warn("[MissionRepository] Corrupted missions.json detected. Backing up and restoring defaults.", err);
        this.backupCorruptedFile(this.missionsFilePath);
      }
    }

    if (!this.missions.has("MARSWALK-001")) {
      this.seedDefaultMission();
    }

    return routesLoaded || missionsLoaded;
  }

  private seedDefaultMission(): void {
    const defaultRoute = this.routes.get("route-jezero-delta-sol100");
    if (!defaultRoute) return;
    const now = new Date().toISOString();
    const defaultMission: StoredMission = {
      id: "MARSWALK-001",
      name: "Marswalk-001: Jezero Delta Astrobiology Traverse",
      description: "Primary Sol 100 multi-agent EVA traverse across Jezero Western Delta and South Séítah.",
      objectiveId: "ANCIENT_WATER_ACTIVITY",
      status: "APPROVED",
      routeId: defaultRoute.id,
      parameters: {
        routeId: defaultRoute.id,
        maxDurationMinutes: 240,
        startCoordinate: defaultRoute.points[0]?.coordinate || { latitude: 18.4447, longitude: 77.4508 },
        returnRequired: true,
        astronautSkillLevel: "standard",
      },
      evaAssessment: {
        estimatedDurationMinutes: defaultRoute.estimatedDurationMinutes,
        totalDistanceKm: defaultRoute.totalDistanceKm,
        terrainDifficulty: defaultRoute.overallDifficulty,
        returnMarginMinutes: 111,
        feasible: true,
        warnings: [],
        oxygenReserveRemainingPercent: 46,
        recommendations: ["Baseline Sol 100 EVA traverse within nominal life-support margins."],
      },
      createdAt: now,
      updatedAt: now,
    };
    this.missions.set(defaultMission.id, defaultMission);
  }

  private backupCorruptedFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        const backupPath = `${filePath}.corrupted.${Date.now()}`;
        fs.renameSync(filePath, backupPath);
      }
    } catch {
      // Ignore backup failures
    }
  }

  private seedDefaultRoute(): void {
    const defaultRoute: MarsRoute = {
      id: "route-jezero-delta-sol100",
      name: "Jezero Delta Front & Séítah Exploration Traverse",
      points: [
        {
          id: "pt-1",
          coordinate: { latitude: 18.4447, longitude: 77.4508 },
          type: "start",
          label: "Octavia E. Butler Landing Site",
          elevationM: -2530,
        },
        {
          id: "pt-2",
          coordinate: { latitude: 18.435, longitude: 77.438 },
          type: "science",
          label: "South Séítah Olivine Cumulate",
          elevationM: -2545,
          targetId: "tgt-seitah-olivine",
        },
        {
          id: "pt-3",
          coordinate: { latitude: 18.423, longitude: 77.411 },
          type: "science",
          label: "Kodiak Butte Delta Remnant",
          elevationM: -2480,
          targetId: "tgt-kodiak-butte",
        },
        {
          id: "pt-4",
          coordinate: { latitude: 18.440, longitude: 77.395 },
          type: "destination",
          label: "Delta Scarp Base Camp",
          elevationM: -2510,
        },
      ],
      segments: [
        {
          id: "seg-1",
          start: { latitude: 18.4447, longitude: 77.4508 },
          end: { latitude: 18.435, longitude: 77.438 },
          distanceKm: 0.98,
          elevationGainM: 0,
          elevationLossM: 15,
          averageSlopeDegrees: 0.88,
          difficulty: "low",
          estimatedMinutes: 44, // includes 25 min science stop
          hazards: [],
        },
        {
          id: "seg-2",
          start: { latitude: 18.435, longitude: 77.438 },
          end: { latitude: 18.423, longitude: 77.411 },
          distanceKm: 1.74,
          elevationGainM: 65,
          elevationLossM: 0,
          averageSlopeDegrees: 2.14,
          difficulty: "low",
          estimatedMinutes: 58, // includes 25 min science stop
          hazards: [],
        },
        {
          id: "seg-3",
          start: { latitude: 18.423, longitude: 77.411 },
          end: { latitude: 18.440, longitude: 77.395 },
          distanceKm: 1.42,
          elevationGainM: 0,
          elevationLossM: 30,
          averageSlopeDegrees: 1.21,
          difficulty: "low",
          estimatedMinutes: 27,
          hazards: [],
        },
      ],
      totalDistanceKm: 4.14,
      estimatedDurationMinutes: 129,
      elevationProfile: [
        { distanceKm: 0.0, elevationM: -2530, slopeDegrees: 0.5, coordinate: { latitude: 18.4447, longitude: 77.4508 } },
        { distanceKm: 0.5, elevationM: -2538, slopeDegrees: 0.9, coordinate: { latitude: 18.440, longitude: 77.444 } },
        { distanceKm: 0.98, elevationM: -2545, slopeDegrees: 0.8, coordinate: { latitude: 18.435, longitude: 77.438 } },
        { distanceKm: 1.8, elevationM: -2510, slopeDegrees: 2.2, coordinate: { latitude: 18.429, longitude: 77.424 } },
        { distanceKm: 2.72, elevationM: -2480, slopeDegrees: 2.1, coordinate: { latitude: 18.423, longitude: 77.411 } },
        { distanceKm: 3.4, elevationM: -2495, slopeDegrees: 1.4, coordinate: { latitude: 18.432, longitude: 77.403 } },
        { distanceKm: 4.14, elevationM: -2510, slopeDegrees: 1.2, coordinate: { latitude: 18.440, longitude: 77.395 } },
      ],
      elevationGainM: 65,
      elevationLossM: 45,
      maxSlopeDegrees: 3.8,
      overallDifficulty: "low",
      createdAt: "2026-11-01T00:00:00.000Z",
    };

    this.routes.set(defaultRoute.id, defaultRoute);
  }

  /**
   * Atomic file writer: writes to a unique temp file, fsyncs, then renames.
   * Concurrency is managed via promise-chain serialization.
   */
  private async atomicWrite(targetPath: string, data: unknown): Promise<void> {
    this.writeLock = this.writeLock.then(async () => {
      try {
        this.ensureStorageDir();
        const tmpPath = `${targetPath}.tmp.${Date.now()}.${Math.random().toString(36).substring(2, 6)}`;
        const content = JSON.stringify(data, null, 2);

        fs.writeFileSync(tmpPath, content, "utf-8");
        const fd = fs.openSync(tmpPath, "r+");
        fs.fsyncSync(fd);
        fs.closeSync(fd);

        let renamed = false;
        for (let attempt = 0; attempt < 5; attempt++) {
          try {
            fs.renameSync(tmpPath, targetPath);
            renamed = true;
            break;
          } catch (renameErr: any) {
            if (renameErr.code === "EPERM" || renameErr.code === "EBUSY") {
              await new Promise((res) => setTimeout(res, 15));
            } else {
              throw renameErr;
            }
          }
        }
        if (!renamed) {
          fs.copyFileSync(tmpPath, targetPath);
          try {
            fs.unlinkSync(tmpPath);
          } catch {
            // Ignore cleanup error
          }
        }
      } catch (err) {
        console.error(`[MissionRepository] Failed atomic write to ${targetPath}:`, err);
        throw err;
      }
    });

    return this.writeLock;
  }

  private persistRoutesToDiskSync(): void {
    try {
      this.ensureStorageDir();
      const tmpPath = `${this.routesFilePath}.tmp.${Date.now()}`;
      const content = JSON.stringify(Array.from(this.routes.values()), null, 2);
      fs.writeFileSync(tmpPath, content, "utf-8");
      const fd = fs.openSync(tmpPath, "r+");
      fs.fsyncSync(fd);
      fs.closeSync(fd);
      try {
        fs.renameSync(tmpPath, this.routesFilePath);
      } catch (renameErr: any) {
        if (renameErr.code === "EPERM" || renameErr.code === "EBUSY") {
          fs.copyFileSync(tmpPath, this.routesFilePath);
          try {
            fs.unlinkSync(tmpPath);
          } catch {}
        } else {
          throw renameErr;
        }
      }
    } catch (err) {
      console.warn("[MissionRepository] Sync route persist warning:", err);
    }
  }

  // ==========================================================================
  // Public Repository Operations
  // ==========================================================================

  public async saveRoute(route: MarsRoute): Promise<MarsRoute> {
    this.routes.set(route.id, route);
    await this.atomicWrite(this.routesFilePath, Array.from(this.routes.values()));
    return route;
  }

  public getRouteByIdSync(id: string): MarsRoute | null {
    return this.routes.get(id) || null;
  }

  public async getRouteById(id: string): Promise<MarsRoute | null> {
    return this.routes.get(id) || null;
  }

  public async getAllRoutes(): Promise<MarsRoute[]> {
    return Array.from(this.routes.values());
  }

  public getAllRoutesSync(): MarsRoute[] {
    return Array.from(this.routes.values());
  }

  public async deleteRoute(id: string): Promise<boolean> {
    if (this.routes.has(id)) {
      this.routes.delete(id);
      await this.atomicWrite(this.routesFilePath, Array.from(this.routes.values()));
      return true;
    }
    return false;
  }

  public async saveMission(
    id: string,
    routeId: string,
    parameters: MissionParameters,
    evaAssessment: EVAAssessment,
    metadata?: MissionMetadataInput
  ): Promise<StoredMission> {
    const now = new Date().toISOString();
    const existing = this.missions.get(id);
    const mission: StoredMission = {
      id,
      name: metadata?.name?.trim() || existing?.name || `EVA Mission (${id})`,
      description: metadata?.description !== undefined ? metadata.description : existing?.description,
      objectiveId: metadata?.objectiveId || existing?.objectiveId || "ANCIENT_WATER_ACTIVITY",
      status: metadata?.status || existing?.status || "DRAFT",
      routeId,
      parameters,
      evaAssessment,
      isDemo: metadata?.isDemo ?? existing?.isDemo ?? id.startsWith("DEMO-"),
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    this.missions.set(id, mission);
    await this.atomicWrite(this.missionsFilePath, Array.from(this.missions.values()));
    return mission;
  }

  public async updateMission(
    id: string,
    updates: Partial<Pick<StoredMission, "name" | "description" | "objectiveId" | "status" | "routeId" | "parameters" | "evaAssessment">>
  ): Promise<StoredMission | null> {
    const existing = this.missions.get(id);
    if (!existing) return null;

    const updated: StoredMission = {
      ...existing,
      name: updates.name !== undefined ? updates.name.trim() || existing.name : existing.name,
      description: updates.description !== undefined ? updates.description : existing.description,
      objectiveId: updates.objectiveId !== undefined ? updates.objectiveId : existing.objectiveId,
      status: updates.status !== undefined ? updates.status : existing.status,
      routeId: updates.routeId !== undefined ? updates.routeId : existing.routeId,
      parameters: updates.parameters !== undefined ? updates.parameters : existing.parameters,
      evaAssessment: updates.evaAssessment !== undefined ? updates.evaAssessment : existing.evaAssessment,
      id: existing.id,
      updatedAt: new Date().toISOString(),
    };
    this.missions.set(id, updated);
    await this.atomicWrite(this.missionsFilePath, Array.from(this.missions.values()));
    return updated;
  }

  public getMissionByIdSync(id: string): StoredMission | null {
    return this.missions.get(id) || null;
  }

  public async getMissionById(id: string): Promise<StoredMission | null> {
    return this.missions.get(id) || null;
  }

  public async getAllMissions(): Promise<StoredMission[]> {
    return Array.from(this.missions.values());
  }

  public getAllMissionsSync(): StoredMission[] {
    return Array.from(this.missions.values());
  }

  public async deleteMission(id: string): Promise<boolean> {
    if (this.missions.has(id)) {
      this.missions.delete(id);
      await this.atomicWrite(this.missionsFilePath, Array.from(this.missions.values()));
      return true;
    }
    return false;
  }

  /**
   * Resets repository memory and deletes persistent route/mission files.
   * Useful for testing environments.
   */
  public clear(): void {
    this.routes.clear();
    this.missions.clear();
    try {
      if (fs.existsSync(this.routesFilePath)) fs.unlinkSync(this.routesFilePath);
      if (fs.existsSync(this.missionsFilePath)) fs.unlinkSync(this.missionsFilePath);
    } catch {
      // Ignore deletion errors in clear
    }
    this.seedDefaultRoute();
  }
}

export const missionRepository = new MissionRepository();
