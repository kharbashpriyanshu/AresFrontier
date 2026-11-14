import { MarsCoordinate, DataProvenance } from "../../types/index.js";
import { calculateMarsDistanceKm } from "../../utils/marsCoordinates.js";
import {
  AuthenticSpectralMineralTarget,
  AUTHENTIC_CRISM_MINERAL_TARGETS,
} from "./authenticMarsData.js";

/**
 * MRO CRISM (Compact Reconnaissance Imaging Spectrometer for Mars) Provider
 * Delivers hyperspectral mineralogy, clay/carbonate identification, and biosignature preservation ratings.
 */
export class CrismProvider {
  /**
   * Retrieves all cataloged authentic CRISM hyperspectral targets
   */
  public getAllTargets(): AuthenticSpectralMineralTarget[] {
    return [...AUTHENTIC_CRISM_MINERAL_TARGETS];
  }

  /**
   * Finds CRISM mineral targets within proximity of a given coordinate, sorted by distance
   */
  public getTargetsNear(coord: MarsCoordinate, radiusKm = 30.0): AuthenticSpectralMineralTarget[] {
    return AUTHENTIC_CRISM_MINERAL_TARGETS
      .map((target) => ({
        target,
        distKm: calculateMarsDistanceKm(coord, target.coordinate),
      }))
      .filter((item) => item.distKm <= radiusKm)
      .sort((a, b) => a.distKm - b.distKm)
      .map((item) => item.target);
  }

  /**
   * Evaluates mineralogical context at a specific coordinate
   */
  public evaluateMineralogy(coord: MarsCoordinate): {
    detected: boolean;
    target?: AuthenticSpectralMineralTarget;
    summary: string;
    dominantMineralClass: string;
    biosignaturePotential: "EXTREME" | "HIGH" | "MODERATE" | "LOW";
    provenance: DataProvenance;
  } {
    const nearby = this.getTargetsNear(coord, 25.0);
    if (nearby.length > 0) {
      const prime = nearby[0];
      const primaryMin = prime.primaryMinerals[0];
      return {
        detected: true,
        target: prime,
        summary: `${prime.name}: Dominant mineral is ${primaryMin.name} (${primaryMin.formula}) with absorption bands at [${primaryMin.absorptionBandsMicrons.join(", ")}] µm.`,
        dominantMineralClass: primaryMin.spectralClass,
        biosignaturePotential: prime.biosignaturePreservationPotential,
        provenance: {
          sourceType: "NASA",
          sourceName: "MRO CRISM Targeted Observation",
          datasetId: `CRISM-MRDR-${prime.crismObservationId}`,
          spatialResolutionM: 18.0,
          confidence: primaryMin.confidenceScore,
        },
      };
    }

    // Baseline Mars crustal regolith mineralogy
    return {
      detected: false,
      summary: "Regional basaltic regolith: augite/pigeonite pyroxenes with plagioclase feldspar and nanophase ferric oxide dust mantle.",
      dominantMineralClass: "Pyroxene",
      biosignaturePotential: "LOW",
      provenance: {
        sourceType: "NASA",
        sourceName: "CRISM Global Multispectral Map (MRDR)",
        datasetId: "MRO-M-CRISM-5-RDR-V1.0",
        spatialResolutionM: 200.0,
        confidence: 0.78,
      },
    };
  }
}

export const crismProvider = new CrismProvider();
