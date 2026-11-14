import { CoverageRating, DataProvenance, MarsCoordinate } from "../../types/index.js";
import { ProvenanceService } from "./provenanceService.js";

/**
 * 2001 Mars Odyssey THEMIS Provider
 * Provides thermal inertia and day/night infrared surface characteristics.
 */
export class ThemisProvider {
  public getCoverage(coord: MarsCoordinate): {
    rating: CoverageRating;
    brightnessTempK: number;
    thermalInertiaJ: number; // J m^-2 K^-1 s^-1/2
    provenance: DataProvenance;
  } {
    const latAbs = Math.abs(coord.latitude);

    // Global THEMIS covers between -85 and +85 deg with higher signal near equatorial regions
    let rating: CoverageRating = "HIGH";
    if (latAbs > 75) rating = "LOW";
    else if (latAbs > 60) rating = "MEDIUM";

    // Daytime brightness temperature model: ~210K to ~270K depending on latitude
    const tempK = Math.round(270 - latAbs * 0.9);
    // Typical Martian thermal inertia ranges from 120 (fine dust) to 600 (bedrock)
    const inertia = Math.round(280 + Math.sin((coord.longitude * Math.PI) / 180) * 80);

    return {
      rating,
      brightnessTempK: tempK,
      thermalInertiaJ: inertia,
      provenance: ProvenanceService.createThemisProvenance(),
    };
  }
}

export const themisProvider = new ThemisProvider();
