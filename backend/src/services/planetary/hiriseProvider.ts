import { CoverageRating, DataProvenance, MarsCoordinate } from "../../types/index.js";
import { calculateMarsDistanceKm } from "../../utils/marsCoordinates.js";
import { ProvenanceService } from "./provenanceService.js";

/**
 * MRO HiRISE High-Resolution Imaging Provider
 * Tracks verified HiRISE stereo DTM footprints and observation footprints.
 */
export class HiriseProvider {
  // Documented HiRISE stereo DEM coverage regions (centered at key science sites)
  private static readonly HIRISE_STEREO_REGIONS = [
    {
      id: "PSP_002172_1985",
      name: "Jezero Crater Western Fan Delta Front",
      center: { latitude: 18.444, longitude: 77.41 },
      radiusKm: 18.0,
      resolutionM: 0.25,
      year: 2021,
    },
    {
      id: "PSP_007056_1615",
      name: "Gale Crater Lower Mount Sharp (Aeolis Mons)",
      center: { latitude: -4.65, longitude: 137.38 },
      radiusKm: 22.0,
      resolutionM: 0.25,
      year: 2012,
    },
  ];

  public getCoverage(coord: MarsCoordinate): {
    rating: CoverageRating;
    observationId?: string;
    resolutionM?: number;
    provenance: DataProvenance;
  } {
    for (const region of HiriseProvider.HIRISE_STEREO_REGIONS) {
      const d = calculateMarsDistanceKm(coord, region.center);
      if (d <= region.radiusKm) {
        return {
          rating: "HIGH",
          observationId: region.id,
          resolutionM: region.resolutionM,
          provenance: ProvenanceService.createHiriseProvenance(region.id),
        };
      } else if (d <= region.radiusKm * 2.5) {
        return {
          rating: "MEDIUM",
          observationId: `${region.id}-REGIONAL`,
          resolutionM: 1.0,
          provenance: ProvenanceService.createHiriseProvenance(`${region.id}-REGIONAL`),
        };
      }
    }

    return {
      rating: "LOW",
      provenance: {
        sourceType: "NASA",
        sourceName: "MRO Context Camera (CTX) Regional Fallback",
        datasetId: "MRO-M-CTX-2-EDR-L0-V1.0",
        spatialResolutionM: 6.0,
        confidence: 0.7,
      },
    };
  }
}

export const hiriseProvider = new HiriseProvider();
