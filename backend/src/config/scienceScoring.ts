/**
 * Factorized Planetary Science Scoring Configuration
 * Defines configurable scoring weights across geological, astrobiological, and operational factors.
 * Reference: Ares Frontier Project Decision Model (not a NASA official standard).
 */
export interface ScienceScoringConfig {
  version: string;
  scoringModel: string;
  weights: {
    objectiveRelevanceMax: number;  // 30 points
    geologicalEvidenceMax: number;  // 25 points
    targetUniquenessMax: number;    // 20 points
    dataQualityMax: number;         // 15 points
    sampleDiversityMax: number;     // 10 points
  };
  description: string;
}

export const DEFAULT_SCIENCE_SCORING_CONFIG: ScienceScoringConfig = {
  version: "3.0.0",
  scoringModel: "PROJECT_RULE_FACTORIZED",
  weights: {
    objectiveRelevanceMax: 30,
    geologicalEvidenceMax: 25,
    targetUniquenessMax: 20,
    dataQualityMax: 15,
    sampleDiversityMax: 10,
  },
  description: "Factorized multi-attribute evaluation separating observed physical evidence from project-defined mission relevance.",
};
