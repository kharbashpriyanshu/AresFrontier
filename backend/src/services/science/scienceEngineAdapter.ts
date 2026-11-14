import { MarsCoordinate, ScientificAssessment } from "../../types/index.js";
import { normalizeLongitude } from "../../utils/marsCoordinates.js";
import { marsDataService } from "../nasa/marsDataService.js";

/**
 * Planetary Science Engine Adapter (Person 4 Contract)
 * Connects to planetary geological interpretation rules and external science servers.
 */
export class ScienceEngineAdapter {
  private scienceServiceUrl: string;
  private isExternalServiceEnabled: boolean;

  constructor() {
    this.scienceServiceUrl = process.env.SCIENCE_SERVICE_URL || "http://localhost:8001";
    this.isExternalServiceEnabled = process.env.ENABLE_SCIENCE_SERVICE === "true";
  }

  /**
   * Generates scientific evaluation for a given Mars coordinate.
   */
  public async getScientificAssessment(coord: MarsCoordinate): Promise<ScientificAssessment> {
    if (this.isExternalServiceEnabled) {
      try {
        const response = await fetch(
          `${this.scienceServiceUrl}/api/v1/science/assess?lat=${coord.latitude}&lon=${coord.longitude}`
        );
        if (response.ok) {
          return (await response.json()) as ScientificAssessment;
        }
      } catch {
        console.warn("[ScienceEngineAdapter] External science service unreachable. Using baseline planetary science rules.");
      }
    }

    // Baseline Geological Rules Engine (Person 4 Pluggable Domain Rules)
    return this.evaluatePlanetaryGeology(coord);
  }

  /**
   * Deterministic planetary geological evaluation based on USGS and NASA CRISM/MOLA regional mapping.
   */
  private async evaluatePlanetaryGeology(coord: MarsCoordinate): Promise<ScientificAssessment> {
    const lat = coord.latitude;
    const lon = normalizeLongitude(coord.longitude);
    const elevation = marsDataService.estimateMolaElevation(coord);

    // Jezero Crater region
    if (lat >= 18.0 && lat <= 19.0 && lon >= 76.5 && lon <= 78.5) {
      return {
        geologicalContext: "Jezero Crater Western Delta fan and crater-floor olivine-carbonate cumulate unit.",
        mineralContext: "Mg-smectite clays, Fe/Mg-carbonates, olivine phenocrysts, and sulfate veins detected via CRISM and SuperCam.",
        thermalContext: "Variable thermal inertia: high inertia rocky delta scarps juxtaposed against low-inertia eolian bedforms.",
        scientificValue: "high",
        explanation: "Prime astrobiological landing area. Fluvial-lacustrine depositional environment ideal for biosignature preservation and radiometric age-dating of Mars crust.",
        sources: [
          "NASA Mars 2020 Mission Science Team (JGR Planets 2021)",
          "Ehlmann et al. (Nature 2008) - Clay minerals in Jezero crater",
        ],
        samplePriorities: ["Delta bottomset mudstone", "Séítah olivine cumulate", "Carbonate fracture fill"],
      };
    }

    // Gale Crater region
    if (lat >= -5.5 && lat <= -4.0 && lon >= 137.0 && lon <= 138.5) {
      return {
        geologicalContext: "Aeolis Mons (Mount Sharp) layered sulfate-bearing and phyllosilicate-bearing sedimentary sequence.",
        mineralContext: "Hematite, jarosite, akaganeite, magnesium and calcium sulfates identified by MSL CheMin.",
        thermalContext: "Bedrock pavements with high thermal inertia and wind-scoured dust mantles.",
        scientificValue: "high",
        explanation: "Continuous sedimentary record spanning the Noachian-Hesperian transition from wet habitable lakes to hyper-arid saline environments.",
        sources: [
          "Grotzinger et al. (Science 2014) - A Habitable Fluvio-Lacustrine Environment at Gale Crater",
          "MSL CheMin Instrument Archive (PDS Geosciences)",
        ],
        samplePriorities: ["Murray formation mudstone", "Vera Rubin hematite crest", "Sulfate-rich bedrock"],
      };
    }

    // Olympus Mons region
    if (lat >= 15.0 && lat <= 22.0 && lon >= -138.0 && lon <= -128.0) {
      return {
        geologicalContext: "Amazonian basaltic shield volcanic construct, collapse calderas, and aureole deposits.",
        mineralContext: "Tholeiitic basalt, pyroxene, plagioclase feldspar, and palagonite alteration rinds.",
        thermalContext: "Extremely low thermal inertia dust mantle on volcano flanks; high-relief rocky caldera floor.",
        scientificValue: "medium",
        explanation: "Youngest massive volcanism on Mars. Critical for understanding mantle plume dynamics, lithospheric thickness, and late-stage outgassing.",
        sources: ["Plescia (Icarus 2004) - Morphometric properties of Olympus Mons calderas"],
        samplePriorities: ["Caldera floor basalt flow", "Scarp collapse breccia"],
      };
    }

    // Regional baseline assessment
    const value = elevation < -2000 ? "medium" : "low";
    return {
      geologicalContext: `Martian crustal province at ${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E (${elevation}m datum).`,
      mineralContext: "Iron oxide-rich weathered basaltic dust and pyroxene-dominated basaltic regolith.",
      thermalContext: "Standard regolith thermal inertia (~200 to 350 J m^-2 K^-1 s^-1/2).",
      scientificValue: value,
      explanation: `Regional Mars terrain context. Topography indicates ${
        elevation < -2000 ? "basin sedimentation or lowland fill" : "impact-cratered crustal highlands"
      }.`,
      sources: ["USGS Planetary Geologic Mapping Program", "MGS MOLA Science Team"],
    };
  }
}

export const scienceEngineAdapter = new ScienceEngineAdapter();
