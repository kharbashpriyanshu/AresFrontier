import { MarsRoute, MissionParameters, EVAAssessment } from "../types/index.js";

export interface StoredMission {
  id: string;
  routeId: string;
  parameters: MissionParameters;
  evaAssessment: EVAAssessment;
  createdAt: string;
}

/**
 * Repository for Mars Routes and Missions.
 * Provides resilient persistence with in-memory fallback for local development.
 */
export class MissionRepository {
  private routes: Map<string, MarsRoute> = new Map();
  private missions: Map<string, StoredMission> = new Map();

  constructor() {
    // Seed with a default reference route in Jezero Crater (Sol 100 Traverse)
    this.seedDefaultRoute();
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

  public async saveRoute(route: MarsRoute): Promise<MarsRoute> {
    this.routes.set(route.id, route);
    return route;
  }

  public async getRouteById(id: string): Promise<MarsRoute | null> {
    return this.routes.get(id) || null;
  }

  public async getAllRoutes(): Promise<MarsRoute[]> {
    return Array.from(this.routes.values());
  }

  public async saveMission(
    id: string,
    routeId: string,
    parameters: MissionParameters,
    evaAssessment: EVAAssessment
  ): Promise<StoredMission> {
    const mission: StoredMission = {
      id,
      routeId,
      parameters,
      evaAssessment,
      createdAt: new Date().toISOString(),
    };
    this.missions.set(id, mission);
    return mission;
  }

  public async getMissionById(id: string): Promise<StoredMission | null> {
    return this.missions.get(id) || null;
  }
}

export const missionRepository = new MissionRepository();
