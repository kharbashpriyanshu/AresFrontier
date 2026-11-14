import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from ml_schemas import (
    HealthResponse,
    ModelMetadataResponse,
    TerrainHazardRequest,
    TerrainHazardResponse,
    RouteRiskRequest,
    RouteRiskResponse,
    TraversabilityRequest,
    TraversabilityResponse,
    TargetPriorityRequest,
    TargetPriorityResponse,
    AssessMissionRequest,
    MissionAssessment,
)
from inference import ml_engine

app = FastAPI(
    title="Martian Map ML & AI Inference Service",
    description="Microservice providing machine-learning inference for terrain hazard classification, route risk regression, traversability, and multi-factor Mars mission assessment.",
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
def health_check():
    return HealthResponse(
        status="healthy" if ml_engine.is_ready else "degraded",
        service="martian-map-ml-service",
        version="1.0.0",
        models_loaded=ml_engine.is_ready,
        data_classification="synthetic-physics-constrained",
    )


@app.get("/api/v1/models/metadata", response_model=ModelMetadataResponse)
def get_metadata():
    if not ml_engine.metadata:
        raise HTTPException(status_code=503, detail="Model metadata is unavailable")
    return ml_engine.metadata


@app.post("/api/v1/infer/hazard", response_model=TerrainHazardResponse)
def infer_hazard(req: TerrainHazardRequest):
    result = ml_engine.predict_terrain_hazard(
        slope_deg=req.slope_degrees,
        elev_delta=req.elevation_delta_m,
        roughness=req.roughness_index,
        rock_pct=req.rock_abundance_pct,
        dust_idx=req.dust_cover_index,
        thermal_inertia=req.thermal_inertia_si,
    )
    return TerrainHazardResponse(**result)


@app.post("/api/v1/infer/route-risk", response_model=RouteRiskResponse)
def infer_route_risk(req: RouteRiskRequest):
    result = ml_engine.predict_route_risk(
        total_dist_km=req.total_distance_km,
        max_slope=req.max_slope_degrees,
        avg_slope=req.avg_slope_degrees,
        elev_gain=req.elevation_gain_m,
        elev_loss=req.elevation_loss_m,
        duration_ratio=req.duration_ratio,
        crit_hazards=req.critical_hazard_count,
        science_point_count=req.science_point_count,
    )
    return RouteRiskResponse(**result)


@app.post("/api/v1/infer/traversability", response_model=TraversabilityResponse)
def infer_traversability(req: TraversabilityRequest):
    result = ml_engine.evaluate_traversability(
        slope_deg=req.slope_degrees,
        roughness=req.roughness,
        rock_pct=req.rock_abundance_pct,
        loose_dust=req.loose_dust,
    )
    return TraversabilityResponse(**result)


@app.post("/api/v1/infer/target-priority", response_model=TargetPriorityResponse)
def infer_target_priority(req: TargetPriorityRequest):
    targets_dict = [t.model_dump() for t in req.targets]
    ranked = ml_engine.prioritize_targets(targets_dict)
    return TargetPriorityResponse(
        ranked_targets=ranked,
        evaluation_criteria=[
            "Base scientific value",
            "Traverse distance from ingress",
            "Terrain gradient / slope",
            "Topographic accessibility index",
        ],
        source="model-generated",
    )


@app.post("/api/v1/assess", response_model=MissionAssessment)
def assess_mission(req: AssessMissionRequest):
    """
    Contract endpoint called by backend/src/services/ml/mlEngineAdapter.ts
    """
    route_dict = req.route.model_dump()
    params_dict = req.parameters.model_dump()
    assessment = ml_engine.assess_route_full(route_dict, params_dict)
    return MissionAssessment(**assessment)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=False)
