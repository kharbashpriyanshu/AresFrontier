import {
  ScienceObjective,
  ScienceObjectiveId,
  ScienceTarget,
  ScienceValueBreakdown,
} from "../../types/index.js";
import { DEFAULT_SCIENCE_SCORING_CONFIG } from "../../config/scienceScoring.js";
import { VERIFIED_NASA_SCIENCE_TARGETS } from "../nasa/adapters/benchmarkData.js";
import { ProvenanceService } from "../planetary/provenanceService.js";

export const MARS_SCIENCE_OBJECTIVES: Record<ScienceObjectiveId, ScienceObjective> = {
  ANCIENT_WATER_ACTIVITY: {
    id: "ANCIENT_WATER_ACTIVITY",
    name: "Ancient Fluvial & Lacustrine Activity",
    description: "Characterize ancient deltaic deposits, river inflow channels, and paleolake shores to reconstruct Mars hydrological timeline.",
    preferredTargetTypes: ["delta", "channel", "inflow", "lacustrine", "conglomerate", "bottomset"],
    preferredCategories: ["paleohydrology", "stratigraphy", "geomorphology"],
    scoringFactors: {
      scientificValue: 0.5,
      proximity: 0.25,
      accessibility: 0.25,
    },
  },
  PAST_HABITABILITY: {
    id: "PAST_HABITABILITY",
    name: "Past Habitability & Biosignature Preservation",
    description: "Investigate subaqueous mudstones, clay-bearing strata, and carbonate formations with high potential to preserve ancient organic biosignatures.",
    preferredTargetTypes: ["clay", "smectite", "carbonate", "mudstone", "lacustrine", "biosignature"],
    preferredCategories: ["mineralogy", "stratigraphy", "paleohydrology"],
    scoringFactors: {
      scientificValue: 0.6,
      proximity: 0.2,
      accessibility: 0.2,
    },
  },
  MINERALOGICAL_DIVERSITY: {
    id: "MINERALOGICAL_DIVERSITY",
    name: "Planetary Mineralogical & Geochemical Diversity",
    description: "Examine varied igneous, evaporitic, and altered lithologies (olivine cumulates, hematite ridges, sulfates) across planetary eras.",
    preferredTargetTypes: ["olivine", "hematite", "sulfate", "carbonate", "cumulate", "spectrometry"],
    preferredCategories: ["mineralogy", "petrology", "geomorphology"],
    scoringFactors: {
      scientificValue: 0.45,
      proximity: 0.3,
      accessibility: 0.25,
    },
  },
  VOLCANIC_HISTORY: {
    id: "VOLCANIC_HISTORY",
    name: "Volcanic Evolution & Crustal Petrology",
    description: "Analyze primary magmatic differentiation, caldera collapse structures, and basaltic flow sequences.",
    preferredTargetTypes: ["caldera", "basalt", "lava", "volcanic", "intrusion", "plutonic"],
    preferredCategories: ["volcanology", "geomorphology", "mineralogy"],
    scoringFactors: {
      scientificValue: 0.4,
      proximity: 0.35,
      accessibility: 0.25,
    },
  },
  SEDIMENTARY_HISTORY: {
    id: "SEDIMENTARY_HISTORY",
    name: "Stratigraphic Architecture & Depositional Evolution",
    description: "Survey unconformities, cross-bedding, and Gilbert-type delta foresets to map sedimentary architecture over geological epochs.",
    preferredTargetTypes: ["stratigraphy", "unconformity", "delta", "sandstone", "cross-bedding", "foresets"],
    preferredCategories: ["stratigraphy", "geomorphology", "paleohydrology"],
    scoringFactors: {
      scientificValue: 0.45,
      proximity: 0.3,
      accessibility: 0.25,
    },
  },
  ASTROBIOLOGY_RELEVANCE: {
    id: "ASTROBIOLOGY_RELEVANCE",
    name: "Astrobiology & Organic Synthesis Context",
    description: "Target fine-grained clay facies and redox boundaries where ancient microbial life could have flourished and been preserved from cosmic radiation.",
    preferredTargetTypes: ["clay", "organic", "mudstone", "redox", "carbonate", "lacustrine"],
    preferredCategories: ["mineralogy", "stratigraphy", "paleohydrology"],
    scoringFactors: {
      scientificValue: 0.65,
      proximity: 0.2,
      accessibility: 0.15,
    },
  },
};

export class ScienceObjectiveEngine {
  public getObjectives(): ScienceObjective[] {
    return Object.values(MARS_SCIENCE_OBJECTIVES);
  }

  public getObjective(id?: string): ScienceObjective {
    if (id && id in MARS_SCIENCE_OBJECTIVES) {
      return MARS_SCIENCE_OBJECTIVES[id as ScienceObjectiveId];
    }
    return MARS_SCIENCE_OBJECTIVES.ANCIENT_WATER_ACTIVITY;
  }

  /**
   * Evaluates relevance score (0.0 to 1.0) of a science target for an objective.
   */
  public evaluateTargetRelevance(target: ScienceTarget, objective: ScienceObjective): number {
    let relevance = 0.3;

    if (objective.preferredCategories.includes(target.category.toLowerCase())) {
      relevance += 0.35;
    }

    const fullText = `${target.name} ${target.description} ${target.associatedFormation || ""} ${(target.potentialSamples || []).join(" ")}`.toLowerCase();

    for (const keyword of objective.preferredTargetTypes) {
      if (fullText.includes(keyword.toLowerCase())) {
        relevance += 0.15;
        break;
      }
    }

    if (target.scientificValue === "high") {
      relevance += 0.2;
    } else if (target.scientificValue === "medium") {
      relevance += 0.1;
    }

    return Math.min(1.0, Number(relevance.toFixed(2)));
  }

  /**
   * Factorized transparent scoring breakdown separating physical evidence from project scoring.
   */
  public evaluateTargetFactorized(
    target: ScienceTarget,
    objectiveId: ScienceObjectiveId = "ANCIENT_WATER_ACTIVITY"
  ): ScienceValueBreakdown {
    const objective = this.getObjective(objectiveId);
    const relevanceCoeff = this.evaluateTargetRelevance(target, objective);

    const cfg = DEFAULT_SCIENCE_SCORING_CONFIG.weights;

    // 1. Objective Relevance: 0 - 30
    const objScore = Math.round(relevanceCoeff * cfg.objectiveRelevanceMax);

    // 2. Geological Evidence: 0 - 25 based on presence of verified formation & samples
    let geoScore = 15;
    if (target.associatedFormation) geoScore += 5;
    if (target.potentialSamples && target.potentialSamples.length >= 2) geoScore += 5;

    // 3. Target Uniqueness: 0 - 20
    let uniqScore = target.scientificValue === "high" ? 18 : target.scientificValue === "medium" ? 14 : 10;

    // 4. Data Quality: 0 - 15 based on data source calibration
    let qualScore = 12;
    if (target.dataSource.includes("Perseverance") || target.dataSource.includes("Curiosity")) qualScore = 15;

    // 5. Sample Diversity: 0 - 10
    const samplesCount = target.potentialSamples ? target.potentialSamples.length : 1;
    const sampleScore = Math.min(cfg.sampleDiversityMax, samplesCount * 4);

    const total = Math.min(100, objScore + geoScore + uniqScore + qualScore + sampleScore);

    return {
      totalScore: total,
      objectiveRelevance: objScore,
      geologicalEvidence: geoScore,
      targetUniqueness: uniqScore,
      dataQuality: qualScore,
      sampleDiversity: sampleScore,
      scoringMethod: "PROJECT_RULE_FACTORIZED",
      scoringExplanation: `Factorized evaluation under '${objective.name}': Relevance (${objScore}/30) + Geo Evidence (${geoScore}/25) + Uniqueness (${uniqScore}/20) + Data Quality (${qualScore}/15) + Sample Diversity (${sampleScore}/10).`,
      observedEvidenceSummary: `Target: ${target.name}. Lithologic formation: '${target.associatedFormation || "Unspecified"}'. In-situ diagnostic samples: [${(target.potentialSamples || []).join(", ")}]. Source dataset: ${target.dataSource}.`,
      provenance: ProvenanceService.createProjectRuleProvenance(
        "Factorized Science Scoring Model v3.0",
        "Deterministic multi-attribute utility function separating observed lithology from project research weighting"
      ),
    };
  }

  /**
   * Calculates route-level science score and comprehensive factor breakdown.
   */
  public calculateRouteScienceScore(
    visitedTargets: ScienceTarget[],
    objectiveId?: ScienceObjectiveId
  ): {
    score: number;
    breakdown: ScienceValueBreakdown;
    targetEvaluations: Array<{ targetId: string; name: string; relevance: number }>;
  } {
    const objective = this.getObjective(objectiveId);
    if (!visitedTargets || visitedTargets.length === 0) {
      const defaultBreakdown: ScienceValueBreakdown = {
        totalScore: 10,
        objectiveRelevance: 3,
        geologicalEvidence: 3,
        targetUniqueness: 2,
        dataQuality: 2,
        sampleDiversity: 0,
        scoringMethod: "PROJECT_RULE_FACTORIZED",
        scoringExplanation: "Traverse visits no in-situ science targets; baseline contextual visual reconnaissance only.",
        observedEvidenceSummary: "No surface sample drill sites scheduled along transit corridor.",
        provenance: ProvenanceService.createProjectRuleProvenance("Baseline Science Score", "Zero targets fallback"),
      };
      return { score: 10, breakdown: defaultBreakdown, targetEvaluations: [] };
    }

    const evaluations = visitedTargets.map((t) => {
      const rel = this.evaluateTargetRelevance(t, objective);
      return { targetId: t.id, name: t.name, relevance: rel };
    });

    const breakdowns = visitedTargets.map((t) => this.evaluateTargetFactorized(t, objective.id));
    const avgObj = Math.round(breakdowns.reduce((acc, b) => acc + b.objectiveRelevance, 0) / breakdowns.length);
    const avgGeo = Math.round(breakdowns.reduce((acc, b) => acc + b.geologicalEvidence, 0) / breakdowns.length);
    const avgUniq = Math.round(breakdowns.reduce((acc, b) => acc + b.targetUniqueness, 0) / breakdowns.length);
    const avgQual = Math.round(breakdowns.reduce((acc, b) => acc + b.dataQuality, 0) / breakdowns.length);
    const totalSamples = Math.min(
      DEFAULT_SCIENCE_SCORING_CONFIG.weights.sampleDiversityMax,
      visitedTargets.reduce((acc, t) => acc + (t.potentialSamples?.length || 1), 0) * 2
    );

    const total = Math.min(100, Math.max(15, avgObj + avgGeo + avgUniq + avgQual + totalSamples));

    const aggregateBreakdown: ScienceValueBreakdown = {
      totalScore: total,
      objectiveRelevance: avgObj,
      geologicalEvidence: avgGeo,
      targetUniqueness: avgUniq,
      dataQuality: avgQual,
      sampleDiversity: totalSamples,
      scoringMethod: "PROJECT_RULE_FACTORIZED",
      scoringExplanation: `Traverse surveys ${visitedTargets.length} science target(s). Multi-attribute score: ${total}/100 based on factorized weights.`,
      observedEvidenceSummary: visitedTargets.map((t) => `${t.name}: ${t.description}`).join(" | "),
      provenance: ProvenanceService.createProjectRuleProvenance(
        "Multi-Target Factorized Science Engine",
        "Linear weighted sum of individual target factor matrices"
      ),
    };

    return {
      score: total,
      breakdown: aggregateBreakdown,
      targetEvaluations: evaluations,
    };
  }

  public rankTargetsForObjective(
    objectiveId: ScienceObjectiveId,
    availableTargets: ScienceTarget[] = VERIFIED_NASA_SCIENCE_TARGETS
  ): Array<ScienceTarget & { relevance: number }> {
    const objective = this.getObjective(objectiveId);
    return availableTargets
      .map((t) => ({
        ...t,
        relevance: this.evaluateTargetRelevance(t, objective),
      }))
      .sort((a, b) => b.relevance - a.relevance);
  }
}

export const scienceObjectiveEngine = new ScienceObjectiveEngine();
