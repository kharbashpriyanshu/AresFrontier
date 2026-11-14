from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    mepag_version: str
    supported_regions: List[str]


class ProvenanceRecord(BaseModel):
    provider: str
    dataset_version: str
    mission: str
    instrument: str
    doi_or_citation: str


# -------------------------------------------------------------
# Adapter Contract Schemas (scienceEngineAdapter.ts)
# -------------------------------------------------------------

class ScientificAssessment(BaseModel):
    geologicalContext: Optional[str] = None
    mineralContext: Optional[str] = None
    thermalContext: Optional[str] = None
    scientificValue: Literal["low", "medium", "high"]
    explanation: str
    sources: List[str]
    samplePriorities: Optional[List[str]] = None
    geologicalEpoch: Optional[Literal["Noachian", "Hesperian", "Amazonian", "Noachian-Hesperian Transition"]] = None
    mepagRelevance: Optional[List[str]] = None
    iceProbability: Optional[float] = Field(None, ge=0.0, le=1.0)
    confidence: Optional[float] = Field(0.85, ge=0.0, le=1.0)
    provenance: Optional[Dict[str, Any]] = None


# -------------------------------------------------------------
# Domain Assessment Schemas
# -------------------------------------------------------------

class TargetEvaluationRequest(BaseModel):
    target_id: str
    name: str
    latitude: float
    longitude: float
    target_type: str  # e.g., "delta", "clay", "carbonate", "crater_rim", "sulfate"
    description: Optional[str] = None
    primary_objective: Optional[str] = "ANCIENT_WATER_ACTIVITY"


class TargetEvaluationResponse(BaseModel):
    target_id: str
    name: str
    scientific_yield_score: float = Field(..., ge=0.0, le=100.0)
    geological_epoch: str
    mepag_goals_supported: List[str]
    biosignature_preservation_potential: Literal["LOW", "MODERATE", "HIGH", "EXCEPTIONAL"]
    recommended_instruments: List[str]
    sample_return_priority: Literal["PRIORITY_1", "PRIORITY_2", "PRIORITY_3"]
    justification: str


class ObjectivesEvaluationRequest(BaseModel):
    objective_id: str
    target_ids: List[str]
    coordinates: List[Dict[str, float]]  # List of {"latitude": ..., "longitude": ...}


class ObjectivesEvaluationResponse(BaseModel):
    objective_id: str
    mepag_alignment_score: float = Field(..., ge=0.0, le=100.0)
    scientific_diversity_score: float = Field(..., ge=0.0, le=100.0)
    covered_geological_eras: List[str]
    supported_investigations: List[str]
    evaluation_summary: str


class MineralClassificationRequest(BaseModel):
    latitude: float
    longitude: float
    spectral_features: Optional[List[str]] = None  # e.g. ["1.4um_oh", "1.9um_h2o", "2.3um_fe_mg"]
    region_hint: Optional[str] = None


class MineralGroupInfo(BaseModel):
    name: str
    category: Literal["phyllosilicate", "carbonate", "sulfate", "mafic_silicate", "iron_oxide", "evaporite"]
    formation_environment: str
    astrobiological_relevance: str


class MineralClassificationResponse(BaseModel):
    primary_minerals: List[MineralGroupInfo]
    crism_analog_unit: str
    aqueous_history_implication: str
    pH_regime: Literal["alkaline_neutral", "moderately_acidic", "hyper_acidic", "anhydrous_magmatic"]
    references: List[str]


class IceAssessmentRequest(BaseModel):
    latitude: float
    longitude: float
    elevation_meters: Optional[float] = None
    thermal_inertia_si: Optional[float] = None


class IceAssessmentResponse(BaseModel):
    subsurface_ice_probability: float = Field(..., ge=0.0, le=1.0)
    depth_to_ice_table_meters: Optional[float] = None
    ice_stability_zone: Literal["STABLE_SHALLOW", "STABLE_DEEP", "METASTABLE", "UNSTABLE"]
    isru_accessibility_rating: Literal["EXCELLENT", "MODERATE", "DIFFICULT", "NON_VIABLE"]
    sharad_swim_analog: str
    scientific_rationale: str
