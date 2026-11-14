import { MarsCoordinate, ScientificAssessment } from "../../types/index.js";
import { normalizeLongitude } from "../../utils/marsCoordinates.js";
import { marsDataService } from "../nasa/marsDataService.js";

export interface ScienceMethodMetadata {
  fallbackUsed: boolean;
  provenanceClassification: "MEASURED" | "DERIVED" | "PREDICTED" | "SIMULATED" | "BENCHMARK" | "SYNTHETIC";
  methodology: string;
  limitations: string[];
}

export interface TargetEvaluationResult extends ScienceMethodMetadata {
  target_id: string;
  name: string;
  scientific_yield_score: number;
  geological_epoch: string;
  mepag_goals_supported: string[];
  biosignature_preservation_potential: "LOW" | "MODERATE" | "HIGH" | "EXCEPTIONAL";
  recommended_instruments: string[];
  sample_return_priority: "PRIORITY_1" | "PRIORITY_2" | "PRIORITY_3";
  justification: string;
}

export interface ObjectivesEvaluationResult extends ScienceMethodMetadata {
  objective_id: string;
  mepag_alignment_score: number;
  scientific_diversity_score: number;
  covered_geological_eras: string[];
  supported_investigations: string[];
  evaluation_summary: string;
}

export interface MineralClassificationResult extends ScienceMethodMetadata {
  primary_minerals: Array<{
    name: string;
    category: string;
    formation_environment: string;
    astrobiological_relevance: string;
  }>;
  crism_analog_unit: string;
  aqueous_history_implication: string;
  pH_regime: string;
  references: string[];
}

export interface IceAssessmentResult extends ScienceMethodMetadata {
  subsurface_ice_probability: number;
  depth_to_ice_table_meters?: number | null;
  ice_stability_zone: "STABLE_SHALLOW" | "STABLE_DEEP" | "METASTABLE" | "UNSTABLE";
  isru_accessibility_rating: "EXCELLENT" | "MODERATE" | "DIFFICULT" | "NON_VIABLE";
  sharad_swim_analog: string;
  scientific_rationale: string;
}

/**
 * Planetary Science Engine Adapter (Person 4 Contract)
 * Connects to external scientific intelligence microservice (Python FastAPI)
 * with timeout handling, typed fallbacks, and deterministic geological rules.
 */
export class ScienceEngineAdapter {
  private scienceServiceUrl: string;
  private isExternalServiceEnabled: boolean;
  private timeoutMs: number;

  constructor() {
    this.scienceServiceUrl = process.env.SCIENCE_SERVICE_URL || "http://localhost:8001";
    this.isExternalServiceEnabled = process.env.ENABLE_SCIENCE_SERVICE === "true";
    this.timeoutMs = parseInt(process.env.SCIENCE_SERVICE_TIMEOUT_MS || "3000", 10);
  }

  public setServiceUrl(url: string): void {
    this.scienceServiceUrl = url;
  }

  public setEnabled(enabled: boolean): void {
    this.isExternalServiceEnabled = enabled;
  }

  public isEnabled(): boolean {
    return this.isExternalServiceEnabled;
  }

  public getServiceUrl(): string {
    return this.scienceServiceUrl;
  }

  /**
   * Health check for external Science microservice.
   */
  public async checkHealth(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      const response = await fetch(`${this.scienceServiceUrl}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (response.ok) {
        const body = (await response.json()) as { status?: string };
        return body.status === "healthy";
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Generates scientific evaluation for a given Mars coordinate.
   */
  public async getScientificAssessment(coord: MarsCoordinate): Promise<ScientificAssessment> {
    if (this.isExternalServiceEnabled) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);

        const response = await fetch(
          `${this.scienceServiceUrl}/api/v1/science/assess?lat=${coord.latitude}&lon=${coord.longitude}`,
          { signal: controller.signal }
        );
        clearTimeout(timer);

        if (response.ok) {
          const external = (await response.json()) as ScientificAssessment;
          return {
            ...external,
            fallbackUsed: false,
            provenanceClassification: external.provenanceClassification || "DERIVED",
            methodology: external.methodology || "Python FastAPI Science Service (science_evaluator.py)",
            limitations: external.limitations || [
              "Regional geological province synthesis; localized outcrop verification requires in-situ instruments.",
            ],
          };
        }
      } catch (err: unknown) {
        console.warn(
          `[ScienceEngineAdapter] External science service (${this.scienceServiceUrl}) unreachable: ${
            err instanceof Error ? err.message : String(err)
          }. Using baseline planetary science rules.`
        );
      }
    }

    // Baseline Geological Rules Engine (Person 4 Pluggable Domain Rules)
    const fallback = await this.evaluatePlanetaryGeology(coord);
    return {
      ...fallback,
      fallbackUsed: true,
      provenanceClassification: "DERIVED",
      methodology: "TypeScript Deterministic Fallback Rules (External Python Science service inactive or unreachable)",
      limitations: [
        "Computed by local deterministic fallback rules rather than the external Python Science microservice.",
        "Confidence reflects province-level literature grounding, not live NASA telemetry.",
      ],
    };
  }

  /**
   * Evaluates a candidate science target against MEPAG standards.
   */
  public async evaluateTarget(target: {
    targetId: string;
    name: string;
    coordinate: MarsCoordinate;
    targetType: string;
    description?: string;
    primaryObjective?: string;
  }): Promise<TargetEvaluationResult> {
    if (this.isExternalServiceEnabled) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);

        const response = await fetch(`${this.scienceServiceUrl}/api/v1/science/evaluate-target`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            target_id: target.targetId,
            name: target.name,
            latitude: target.coordinate.latitude,
            longitude: target.coordinate.longitude,
            target_type: target.targetType,
            description: target.description,
            primary_objective: target.primaryObjective || "ANCIENT_WATER_ACTIVITY",
          }),
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (response.ok) {
          const external = (await response.json()) as Omit<TargetEvaluationResult, keyof ScienceMethodMetadata>;
          return {
            ...external,
            fallbackUsed: false,
            provenanceClassification: "DERIVED",
            methodology: "Python FastAPI Science Service (science_evaluator.py / MEPAG rubric)",
            limitations: [
              "Model-derived priority estimate; does not represent confirmed biosignatures.",
              "Dependent on catalogued orbital/in-situ context for target coordinates.",
            ],
          };
        }
      } catch {
        // Fall back to rule-based evaluation below
      }
    }

    // Fallback baseline evaluation
    const isDelta =
      target.targetType.toLowerCase().includes("delta") ||
      target.targetType.toLowerCase().includes("stratigraphy") ||
      target.targetType.toLowerCase().includes("astrobiology") ||
      (target.description || "").toLowerCase().includes("clay");
    return {
      target_id: target.targetId,
      name: target.name,
      scientific_yield_score: isDelta ? 90 : 65,
      geological_epoch: target.coordinate.latitude < 0 ? "Noachian" : "Hesperian",
      mepag_goals_supported: isDelta
        ? ["Goal I (Life): Habitability", "Goal III (Geology): Stratigraphy"]
        : ["Goal III (Geology): Crustal Evolution"],
      biosignature_preservation_potential: isDelta ? "HIGH" : "MODERATE",
      recommended_instruments: isDelta ? ["Raman Spectrometer", "Micro-XRF"] : ["APXS", "Context Camera"],
      sample_return_priority: isDelta ? "PRIORITY_1" : "PRIORITY_2",
      justification: `Fallback analytical evaluation for target ${target.name} under deterministic planetary geology rules.`,
      fallbackUsed: true,
      provenanceClassification: "DERIVED",
      methodology: "TypeScript Deterministic Fallback Rules (External Python Science service inactive or unreachable)",
      limitations: [
        "Computed by local deterministic fallback rules rather than the external Python Science microservice.",
        "Scores reflect qualitative MEPAG criteria weighting, not live telemetry.",
      ],
    };
  }

  /**
   * Evaluates mission science objectives across selected targets or coordinates.
   */
  public async evaluateObjectives(params: {
    objectiveId: string;
    targetTypes: string[];
    waypointsCount: number;
    routeLengthKm: number;
  }): Promise<ObjectivesEvaluationResult> {
    if (this.isExternalServiceEnabled) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);

        const response = await fetch(`${this.scienceServiceUrl}/api/v1/science/evaluate-objectives`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            objective_id: params.objectiveId,
            target_types: params.targetTypes,
            waypoints_count: params.waypointsCount,
            route_length_km: params.routeLengthKm,
          }),
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (response.ok) {
          const external = (await response.json()) as Omit<ObjectivesEvaluationResult, keyof ScienceMethodMetadata>;
          return {
            ...external,
            fallbackUsed: false,
            provenanceClassification: "DERIVED",
            methodology: "Python FastAPI Science Service (MEPAG Objectives Evaluator)",
            limitations: ["Alignment score is derived from target-type diversity and traverse length heuristics."],
          };
        }
      } catch {
        // Fallback below
      }
    }

    const uniqueTypes = Array.from(new Set(params.targetTypes.map((t) => t.toLowerCase())));
    const alignment = Math.min(98, 58 + uniqueTypes.length * 10 + Math.min(12, params.waypointsCount * 3));
    const diversity = Math.min(95, 40 + uniqueTypes.length * 18);
    return {
      objective_id: params.objectiveId,
      mepag_alignment_score: alignment,
      scientific_diversity_score: diversity,
      covered_geological_eras: ["Noachian", "Hesperian"],
      supported_investigations:
        uniqueTypes.length > 0
          ? uniqueTypes.map((t) => `MEPAG ${t} investigation`)
          : ["General crustal reconnaissance"],
      evaluation_summary: `Fallback MEPAG alignment assessment for ${params.objectiveId} across ${params.waypointsCount} waypoint(s) (${params.routeLengthKm.toFixed(1)} km).`,
      fallbackUsed: true,
      provenanceClassification: "DERIVED",
      methodology: "TypeScript Deterministic Fallback Rules (External Python Science service inactive or unreachable)",
      limitations: [
        "Computed by local deterministic fallback rules rather than the external Python Science microservice.",
        "Does not verify physical rover power or communication constraints.",
      ],
    };
  }

  /**
   * Classifies mineralogy and aqueous history for a coordinate or target.
   */
  public async classifyMineralogy(params: {
    coordinate: MarsCoordinate;
    geologicalContext?: string;
    observedFeatures?: string[];
  }): Promise<MineralClassificationResult> {
    if (this.isExternalServiceEnabled) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);

        const response = await fetch(`${this.scienceServiceUrl}/api/v1/science/classify-mineralogy`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latitude: params.coordinate.latitude,
            longitude: params.coordinate.longitude,
            geological_context: params.geologicalContext,
            observed_features: params.observedFeatures || [],
          }),
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (response.ok) {
          const external = (await response.json()) as Omit<MineralClassificationResult, keyof ScienceMethodMetadata>;
          return {
            ...external,
            fallbackUsed: false,
            provenanceClassification: "DERIVED",
            methodology: "Python FastAPI Science Service (CRISM Spectral Analog Classifier)",
            limitations: [
              "Mineral associations are derived from regional CRISM/CheMin analogs, not live spectrometer measurements.",
            ],
          };
        }
      } catch {
        // Fallback below
      }
    }

    const lat = params.coordinate.latitude;
    const lon = normalizeLongitude(params.coordinate.longitude);
    const isJezero = lat >= 18.0 && lat <= 19.5 && lon >= 76.5 && lon <= 78.5;
    const isGale = lat >= -5.5 && lat <= -4.0 && lon >= 137.0 && lon <= 138.8;

    if (isJezero) {
      return {
        primary_minerals: [
          {
            name: "Fe/Mg-Smectite Clay",
            category: "Phyllosilicate",
            formation_environment: "Neutral-pH lacustrine / deltaic alteration",
            astrobiological_relevance: "High — preserves organic molecules in fine-grained mudstones",
          },
          {
            name: "Mg-Carbonate",
            category: "Carbonate",
            formation_environment: "Marginal lacustrine precipitation / carbonation of olivine",
            astrobiological_relevance: "High — traps paleo-atmospheric CO2 and potential microfossils",
          },
        ],
        crism_analog_unit: "Jezero Western Delta & Marginal Carbonate Unit (CRISM HRL000040FF)",
        aqueous_history_implication: "Persistent neutral-to-alkaline surface lake followed by shoreline carbonate precipitation.",
        pH_regime: "Circum-neutral to mildly alkaline (pH 6.5–8.5)",
        references: ["Ehlmann et al., Nature 2008", "Horgan et al., Icarus 2020"],
        fallbackUsed: true,
        provenanceClassification: "BENCHMARK",
        methodology: "TypeScript Deterministic Fallback Rules grounded in published CRISM Jezero analog literature",
        limitations: [
          "Fallback regional analog; no live CRISM hyperspectral cube inversion executed in this session.",
        ],
      };
    }

    if (isGale) {
      return {
        primary_minerals: [
          {
            name: "Crystalline Hematite",
            category: "Iron Oxide",
            formation_environment: "Diagenetic redox boundary / groundwater oxidation",
            astrobiological_relevance: "Moderate-High — records redox gradients capable of supporting chemolithotrophy",
          },
          {
            name: "Ca/Mg-Sulfate",
            category: "Evaporite",
            formation_environment: "Desiccating saline lacustrine brines",
            astrobiological_relevance: "Moderate — records climate transition from wet to arid Mars",
          },
        ],
        crism_analog_unit: "Aeolis Mons (Mount Sharp) Hematite-Sulfate Sequence",
        aqueous_history_implication: "Long-lived lake system transitioning into acidic/saline evaporative groundwater alteration.",
        pH_regime: "Variable (neutral lacustrine to mildly acidic diagenetic)",
        references: ["Fraeman et al., JGR Planets 2020", "Grotzinger et al., Science 2014"],
        fallbackUsed: true,
        provenanceClassification: "BENCHMARK",
        methodology: "TypeScript Deterministic Fallback Rules grounded in MSL CheMin/CRISM literature",
        limitations: ["Fallback regional analog; localized outcrop mineralogy requires in-situ CheMin/APXS."],
      };
    }

    return {
      primary_minerals: [
        {
          name: "Low-Calcium Pyroxene & Plagioclase",
          category: "Primary Igneous Silicate",
          formation_environment: "Basaltic volcanism and impact-gardened regolith",
          astrobiological_relevance: "Low — primary igneous crust with limited aqueous alteration",
        },
      ],
      crism_analog_unit: "Undifferentiated Basaltic Crustal Province",
      aqueous_history_implication: "Minimal sustained surface water alteration inferred at regional orbital scale.",
      pH_regime: "Unaltered basaltic / dry regolith",
      references: ["Murchie et al., JGR 2009 — CRISM Global Mineralogy Survey"],
      fallbackUsed: true,
      provenanceClassification: "DERIVED",
      methodology: "TypeScript Deterministic Fallback Rules (External Python Science service inactive or unreachable)",
      limitations: [
        "Regional crustal baseline only; localized hydrated minerals below ~100m resolution are not resolved.",
      ],
    };
  }

  /**
   * Evaluates subsurface water-ice stability using SHARAD/SWIM model.
   */
  public async assessIceStability(coord: MarsCoordinate): Promise<IceAssessmentResult> {
    if (this.isExternalServiceEnabled) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);

        const response = await fetch(`${this.scienceServiceUrl}/api/v1/science/assess-ice`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latitude: coord.latitude,
            longitude: coord.longitude,
            elevation_meters: marsDataService.estimateMolaElevation(coord),
          }),
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (response.ok) {
          const external = (await response.json()) as Omit<IceAssessmentResult, keyof ScienceMethodMetadata>;
          return {
            ...external,
            fallbackUsed: false,
            provenanceClassification: "DERIVED",
            methodology: "Python FastAPI Science Service (SHARAD/SWIM Thermal Ice Stability Model)",
            limitations: [
              "Thermal equilibrium model; actual ice presence and purity require direct radar or drilling verification.",
            ],
          };
        }
      } catch {
        // Fall back
      }
    }

    const absLat = Math.abs(coord.latitude);
    const prob = absLat > 55 ? 0.85 : absLat > 35 ? 0.6 : 0.05;
    return {
      subsurface_ice_probability: prob,
      depth_to_ice_table_meters: absLat > 55 ? 0.8 : absLat > 35 ? 2.5 : null,
      ice_stability_zone: absLat > 55 ? "STABLE_SHALLOW" : absLat > 35 ? "STABLE_DEEP" : "UNSTABLE",
      isru_accessibility_rating: absLat > 55 ? "EXCELLENT" : absLat > 35 ? "MODERATE" : "NON_VIABLE",
      sharad_swim_analog: absLat > 35 ? "Mid-latitude lobate debris apron" : "Equatorial desiccated regolith",
      scientific_rationale: "Deterministic baseline model based on latitude thermal stability constraints.",
      fallbackUsed: true,
      provenanceClassification: "DERIVED",
      methodology: "TypeScript Deterministic Fallback Rules (Latitude-based thermal equilibrium approximation)",
      limitations: [
        "Fallback latitude approximation; does not model local slope insolation or regolith thermal inertia variations.",
      ],
    };
  }

  /**
   * Deterministic planetary geological evaluation based on USGS and NASA CRISM/MOLA regional mapping.
   */
  private async evaluatePlanetaryGeology(coord: MarsCoordinate): Promise<ScientificAssessment> {
    const lat = coord.latitude;
    const lon = normalizeLongitude(coord.longitude);
    const elevation = marsDataService.estimateMolaElevation(coord);

    // Jezero Crater region
    if (lat >= 18.0 && lat <= 19.5 && lon >= 76.5 && lon <= 78.5) {
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
        geologicalEpoch: "Noachian-Hesperian Transition",
        mepagRelevance: ["Goal I: Life", "Goal III: Geology"],
        iceProbability: 0.02,
        confidence: 0.94,
      };
    }

    // Gale Crater region
    if (lat >= -5.5 && lat <= -4.0 && lon >= 137.0 && lon <= 138.8) {
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
        geologicalEpoch: "Hesperian",
        mepagRelevance: ["Goal I: Life", "Goal II: Climate", "Goal III: Geology"],
        iceProbability: 0.01,
        confidence: 0.92,
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
        geologicalEpoch: "Amazonian",
        mepagRelevance: ["Goal III: Geology"],
        iceProbability: 0.05,
        confidence: 0.88,
      };
    }

    // Regional baseline assessment
    const value = elevation < -2000 ? "medium" : "low";
    const epoch = lat < 0 ? "Noachian" : "Hesperian";
    return {
      geologicalContext: `Martian crustal province at ${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E (${elevation}m datum).`,
      mineralContext: "Iron oxide-rich weathered basaltic dust and pyroxene-dominated basaltic regolith.",
      thermalContext: "Standard regolith thermal inertia (~200 to 350 J m^-2 K^-1 s^-1/2).",
      scientificValue: value,
      explanation: `Regional Mars terrain context. Topography indicates ${
        elevation < -2000 ? "basin sedimentation or lowland fill" : "impact-cratered crustal highlands"
      }.`,
      sources: ["USGS Planetary Geologic Mapping Program", "MGS MOLA Science Team"],
      geologicalEpoch: epoch,
      mepagRelevance: ["Goal III: Geology"],
      iceProbability: Math.abs(lat) > 45 ? 0.65 : 0.04,
      confidence: 0.80,
    };
  }
}

export const scienceEngineAdapter = new ScienceEngineAdapter();
