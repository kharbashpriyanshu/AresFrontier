from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    models_loaded: bool
    data_classification: str


class ModelDetail(BaseModel):
    algorithm: str
    features: List[str]
    classes: Optional[List[str]] = None
    metrics: Dict[str, float]
    file: str


class ModelMetadataResponse(BaseModel):
    model_version: str
    trained_at_utc: str
    data_provenance: Dict[str, str]
    models: Dict[str, ModelDetail]


# -------------------------------------------------------------
# Individual Inference Schemas
# -------------------------------------------------------------

class TerrainHazardRequest(BaseModel):
    slope_degrees: float = Field(..., ge=0.0, le=90.0, description="Surface gradient in degrees")
    elevation_delta_m: float = Field(0.0, description="Local elevation change in meters")
    roughness_index: float = Field(0.2, ge=0.0, le=1.0, description="Surface roughness (0 smooth, 1 rugged)")
    rock_abundance_pct: float = Field(5.0, ge=0.0, le=100.0, description="CFA rock coverage percentage")
    dust_cover_index: float = Field(0.3, ge=0.0, le=1.0, description="Loose mantle dust index")
    thermal_inertia_si: float = Field(280.0, ge=10.0, le=1000.0, description="THEMIS thermal inertia in SI units")


class TerrainHazardResponse(BaseModel):
    hazard_class: Literal["LOW", "MODERATE", "CRITICAL"]
    hazard_score: float = Field(..., ge=0.0, le=100.0)
    slip_risk_probability: float = Field(..., ge=0.0, le=1.0)
    confidence: float
    factors: Dict[str, float]
    source: str = "model-generated"


class RouteRiskRequest(BaseModel):
    total_distance_km: float = Field(..., gt=0.0)
    max_slope_degrees: float = Field(..., ge=0.0)
    avg_slope_degrees: float = Field(..., ge=0.0)
    elevation_gain_m: float = Field(0.0, ge=0.0)
    elevation_loss_m: float = Field(0.0, ge=0.0)
    duration_ratio: float = Field(1.0, gt=0.0, description="estimated_duration / max_duration")
    critical_hazard_count: int = Field(0, ge=0)
    science_point_count: int = Field(0, ge=0)


class RouteRiskResponse(BaseModel):
    risk_score: float = Field(..., ge=0.0, le=100.0)
    feasibility_status: Literal["MISSION FEASIBLE", "MISSION RESTRICTED", "MISSION CONSTRAINT EXCEEDED"]
    feasibility_confidence: float
    risk_factors: Dict[str, float]
    source: str = "model-generated"


class TraversabilityRequest(BaseModel):
    slope_degrees: float
    roughness: float = 0.2
    rock_abundance_pct: float = 5.0
    loose_dust: bool = False


class TraversabilityResponse(BaseModel):
    traversability_index: float = Field(..., ge=0.0, le=1.0, description="1.0 = optimal, 0.0 = impassable")
    max_safe_speed_kmh: float
    energy_expenditure_multiplier: float
    terrain_classification: Literal["PASSABLE", "DIFFICULT", "NON_TRAVERSABLE"]


class TargetPriorityItem(BaseModel):
    target_id: str
    target_name: str
    distance_km: float
    slope_degrees: float
    base_scientific_value: float = Field(50.0, ge=0.0, le=100.0)
    roughness: float = 0.2
    accessibility_index: float = 0.8


class TargetPriorityRequest(BaseModel):
    targets: List[TargetPriorityItem]


class RankedTarget(BaseModel):
    target_id: str
    target_name: str
    predicted_priority_score: float
    rank: int


class TargetPriorityResponse(BaseModel):
    ranked_targets: List[RankedTarget]
    evaluation_criteria: List[str]
    source: str = "model-generated"


# -------------------------------------------------------------
# Adapter Full Route Assessment Schema (MLEngineAdapter Contract)
# -------------------------------------------------------------

class MarsCoordinate(BaseModel):
    latitude: float
    longitude: float
    elevationMeters: Optional[float] = None


class RoutePoint(BaseModel):
    id: str
    label: str
    coordinate: MarsCoordinate
    type: str
    targetId: Optional[str] = None


class RouteSegment(BaseModel):
    id: str
    fromPointId: str
    toPointId: str
    distanceMeters: float
    averageSlopeDegrees: float
    difficulty: Optional[str] = "low"
    elevationDeltaMeters: Optional[float] = 0.0


class MarsRoute(BaseModel):
    id: str
    name: str
    points: List[RoutePoint] = []
    segments: List[RouteSegment] = []
    totalDistanceKm: float = 0.0
    estimatedDurationMinutes: float = 0.0
    maxSlopeDegrees: float = 0.0
    elevationGainM: float = 0.0
    elevationLossM: float = 0.0
    overallDifficulty: Optional[str] = "low"


class AssessmentParameters(BaseModel):
    maxDurationMinutes: float = 180.0
    astronautSkillLevel: Optional[Literal["standard", "expert"]] = "standard"


class AssessMissionRequest(BaseModel):
    route: MarsRoute
    parameters: AssessmentParameters


class MissionAssessment(BaseModel):
    safetyScore: int = Field(..., ge=0, le=100)
    scienceScore: int = Field(..., ge=0, le=100)
    accessibilityScore: int = Field(..., ge=0, le=100)
    overallScore: int = Field(..., ge=0, le=100)
    confidence: float = Field(..., ge=0.0, le=1.0)
    warnings: List[str] = []
    recommendedRoute: Optional[str] = None
    modelIdentifier: str = "MartianML-Ensemble-v1.0.0"
    scoringSource: Literal["model-generated", "rule-based"] = "model-generated"
    missionStatus: Optional[Literal["MISSION FEASIBLE", "MISSION RESTRICTED", "MISSION CONSTRAINT EXCEEDED"]] = None
    scoringExplanation: Optional[str] = None
