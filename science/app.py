from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from science_schemas import (
    HealthResponse,
    ScientificAssessment,
    TargetEvaluationRequest,
    TargetEvaluationResponse,
    ObjectivesEvaluationRequest,
    ObjectivesEvaluationResponse,
    MineralClassificationRequest,
    MineralClassificationResponse,
    IceAssessmentRequest,
    IceAssessmentResponse,
)
from science_evaluator import science_evaluator

app = FastAPI(
    title="Ares Frontier Scientific Intelligence Service",
    description="Microservice providing MEPAG mission goal alignment, geological epoch mapping, mineralogical classification, and subsurface water-ice modeling.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
def health():
    return HealthResponse(
        status="healthy",
        service="ares-frontier-science-service",
        version="1.0.0",
        mepag_version="MEPAG Goals 2020",
        supported_regions=[p["name"] for p in science_evaluator.provinces],
    )


@app.get("/api/v1/science/assess", response_model=ScientificAssessment)
def assess_coordinate(
    lat: float = Query(..., ge=-90.0, le=90.0, description="Latitude in degrees"),
    lon: float = Query(..., description="Longitude in degrees"),
):
    """
    Contract endpoint called by backend/src/services/science/scienceEngineAdapter.ts
    """
    result = science_evaluator.assess_coordinate(lat=lat, lon=lon)
    return ScientificAssessment(**result)


@app.post("/api/v1/science/evaluate-target", response_model=TargetEvaluationResponse)
def evaluate_target(req: TargetEvaluationRequest):
    result = science_evaluator.evaluate_target(
        target_id=req.target_id,
        name=req.name,
        lat=req.latitude,
        lon=req.longitude,
        target_type=req.target_type,
        description=req.description,
        primary_obj=req.primary_objective or "ANCIENT_WATER_ACTIVITY",
    )
    return TargetEvaluationResponse(**result)


@app.post("/api/v1/science/evaluate-objectives", response_model=ObjectivesEvaluationResponse)
def evaluate_objectives(req: ObjectivesEvaluationRequest):
    result = science_evaluator.evaluate_objectives(
        objective_id=req.objective_id,
        target_ids=req.target_ids,
        coordinates=req.coordinates,
    )
    return ObjectivesEvaluationResponse(**result)


@app.post("/api/v1/science/classify-mineralogy", response_model=MineralClassificationResponse)
def classify_mineralogy(req: MineralClassificationRequest):
    result = science_evaluator.classify_mineralogy(
        lat=req.latitude,
        lon=req.longitude,
        spectral_features=req.spectral_features,
        region_hint=req.region_hint,
    )
    return MineralClassificationResponse(**result)


@app.post("/api/v1/science/assess-ice", response_model=IceAssessmentResponse)
def assess_ice(req: IceAssessmentRequest):
    result = science_evaluator.assess_subsurface_ice(
        lat=req.latitude,
        lon=req.longitude,
        elevation_meters=req.elevation_meters,
        thermal_inertia_si=req.thermal_inertia_si,
    )
    return IceAssessmentResponse(**result)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8001, reload=False)
