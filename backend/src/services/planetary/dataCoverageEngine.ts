import { CoverageRating, DataCoverage, MarsCoordinate, MarsRoute } from "../../types/index.js";
import { planetaryDataService } from "./planetaryDataService.js";

/**
 * Data Coverage Intelligence Engine
 * Quantifies observational evidence density across elevation, high-resolution imagery,
 * thermal spectrometry, and in-situ rover ground truth.
 */
export class DataCoverageEngine {
  /**
   * Assesses observational coverage for a single location.
   */
  public async assessLocationCoverage(coord: MarsCoordinate): Promise<DataCoverage> {
    return planetaryDataService.getDataCoverage(coord);
  }

  /**
   * Evaluates aggregate observational evidence coverage across an entire route.
   */
  public async assessRouteCoverage(route: MarsRoute): Promise<DataCoverage> {
    const coords = route.points.map((p) => p.coordinate);
    if (coords.length === 0) {
      return planetaryDataService.getDataCoverage({ latitude: 18.4447, longitude: 77.4508 });
    }

    const samplePoints = [
      coords[0],
      coords[Math.floor(coords.length / 2)],
      coords[coords.length - 1],
    ];

    const coverages = await Promise.all(samplePoints.map((c) => planetaryDataService.getDataCoverage(c)));

    const ratingsRank = { HIGH: 3, MEDIUM: 2, LOW: 1, NONE: 0 };
    const rankRatings = ["NONE", "LOW", "MEDIUM", "HIGH"] as const;

    const aggregateRating = (key: keyof Pick<DataCoverage, "elevation" | "highResImagery" | "thermal" | "roverEvidence" | "scienceEvidence">): CoverageRating => {
      const avg = coverages.reduce((sum, c) => sum + ratingsRank[c[key]], 0) / coverages.length;
      return rankRatings[Math.round(avg)] || "LOW";
    };

    const elev = aggregateRating("elevation");
    const hirise = aggregateRating("highResImagery");
    const themis = aggregateRating("thermal");
    const rovers = aggregateRating("roverEvidence");
    const science = aggregateRating("scienceEvidence");

    const overallAvg = (ratingsRank[elev] + ratingsRank[hirise] + ratingsRank[themis] + ratingsRank[rovers] + ratingsRank[science]) / 5;
    const overall: CoverageRating = overallAvg >= 2.2 ? "HIGH" : overallAvg >= 1.4 ? "MEDIUM" : "LOW";

    const minRes = Math.min(...coverages.map((c) => c.sourceResolutionM || 463));

    return {
      elevation: elev,
      highResImagery: hirise,
      thermal: themis,
      roverEvidence: rovers,
      scienceEvidence: science,
      overallEvidence: overall,
      sourceResolutionM: minRes,
      dataAgeYears: 5,
      summary: `Route corridor evidence confidence is ${overall}. Elevation: ${elev}, HiRISE stereo: ${hirise}, Thermal IR: ${themis}, Rover in-situ: ${rovers}.`,
      provenance: coverages[0].provenance,
    };
  }
}

export const dataCoverageEngine = new DataCoverageEngine();
