import { LocationData, ScienceTarget } from "../../types/index.js";
import {
  VERIFIED_NASA_LOCATIONS,
  VERIFIED_NASA_SCIENCE_TARGETS,
} from "../nasa/adapters/benchmarkData.js";
import { ProvenanceService } from "./provenanceService.js";

/**
 * Benchmark Planetary Provider
 * Supplies calibrated, verified NASA landing sites and rover science targets.
 */
export class BenchmarkProvider {
  public getLocations(): LocationData[] {
    return VERIFIED_NASA_LOCATIONS.map((loc) => ({
      ...loc,
      nasaObservations: loc.nasaObservations.map((obs) => ({
        ...obs,
        provenance: ProvenanceService.createRoverProvenance(
          obs.mission.includes("2020") ? "Mars 2020 (Perseverance)" : "MSL (Curiosity)",
          obs.instrument
        ),
      })),
    }));
  }

  public getScienceTargets(): ScienceTarget[] {
    return [...VERIFIED_NASA_SCIENCE_TARGETS];
  }

  public findLocationById(id: string): LocationData | undefined {
    return this.getLocations().find((l) => l.id === id);
  }

  public findScienceTargetById(id: string): ScienceTarget | undefined {
    return this.getScienceTargets().find((t) => t.id === id);
  }
}

export const benchmarkProvider = new BenchmarkProvider();
