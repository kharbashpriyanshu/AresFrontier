import { CoverageRating, MarsCoordinate, MarsObservation } from "../../types/index.js";
import { calculateMarsDistanceKm } from "../../utils/marsCoordinates.js";
import { ProvenanceService } from "./provenanceService.js";

/**
 * Rover In-Situ Observations Provider
 * Manages verified surface samples and instrument logs from Mars 2020 (Perseverance) and MSL (Curiosity).
 */
export class RoverProvider {
  private static readonly ROVER_SITES = [
    {
      id: "M2020-OCTAVIA-BUTLER",
      mission: "Mars 2020 (Perseverance)" as const,
      instrument: "PIXL / SHERLOC / SuperCam",
      location: { latitude: 18.4447, longitude: 77.4508 },
      sol: 450,
      summary: "Igneous Máaz formation bedrock and Séítah olivine cumulate unit exploration.",
    },
    {
      id: "M2020-KODIAK-RECON",
      mission: "Mars 2020 (Perseverance)" as const,
      instrument: "Mastcam-Z / SuperCam",
      location: { latitude: 18.423, longitude: 77.411 },
      sol: 210,
      summary: "Gilbert-type delta foreset layering confirming ancient lake stage.",
    },
    {
      id: "MSL-VERA-RUBIN",
      mission: "MSL (Curiosity)" as const,
      instrument: "CheMin / APXS",
      location: { latitude: -4.68, longitude: 137.38 },
      sol: 1900,
      summary: "Gray crystalline hematite bedrock ridge indicating redox groundwater interface.",
    },
  ];

  public getObservationsNear(coord: MarsCoordinate, radiusKm = 15): {
    rating: CoverageRating;
    observations: MarsObservation[];
  } {
    const matching: MarsObservation[] = [];

    for (const site of RoverProvider.ROVER_SITES) {
      const d = calculateMarsDistanceKm(coord, site.location);
      if (d <= radiusKm) {
        matching.push({
          id: site.id,
          source: site.mission,
          mission: site.mission,
          instrument: site.instrument,
          location: site.location,
          observationType: "rover_observation",
          confidence: 0.99,
          timestamp: "2021-04-15T00:00:00Z",
          provenance: ProvenanceService.createRoverProvenance(site.mission, site.instrument, site.sol),
        });
      }
    }

    let rating: CoverageRating = "NONE";
    if (matching.length >= 2) rating = "HIGH";
    else if (matching.length === 1) rating = "MEDIUM";

    return {
      rating,
      observations: matching,
    };
  }
}

export const roverProvider = new RoverProvider();
