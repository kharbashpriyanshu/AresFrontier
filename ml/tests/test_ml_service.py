import pytest
from fastapi.testclient import TestClient
import sys
import os

ml_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ml_dir not in sys.path:
    sys.path.insert(0, ml_dir)

import importlib.util
spec = importlib.util.spec_from_file_location("ml_app_module", os.path.join(ml_dir, "app.py"))
ml_mod = importlib.util.module_from_spec(spec)
sys.modules["ml_app_module"] = ml_mod
spec.loader.exec_module(ml_mod)
app = ml_mod.app

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["models_loaded"] is True
    assert data["data_classification"] == "synthetic-physics-constrained"


def test_metadata():
    response = client.get("/api/v1/models/metadata")
    assert response.status_code == 200
    data = response.json()
    assert data["model_version"] == "1.0.0"
    assert "terrain_hazard_classifier" in data["models"]
    assert "route_risk_regressor" in data["models"]


def test_infer_hazard_low():
    payload = {
        "slope_degrees": 4.5,
        "elevation_delta_m": 5.0,
        "roughness_index": 0.1,
        "rock_abundance_pct": 3.0,
        "dust_cover_index": 0.2,
        "thermal_inertia_si": 350.0,
    }
    response = client.post("/api/v1/infer/hazard", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["hazard_class"] in ["LOW", "MODERATE"]
    assert data["hazard_score"] < 50.0
    assert 0.0 <= data["confidence"] <= 1.0


def test_infer_hazard_critical():
    payload = {
        "slope_degrees": 38.0,
        "elevation_delta_m": 120.0,
        "roughness_index": 0.95,
        "rock_abundance_pct": 45.0,
        "dust_cover_index": 0.95,
        "thermal_inertia_si": 60.0,
    }
    response = client.post("/api/v1/infer/hazard", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["hazard_class"] == "CRITICAL"
    assert data["hazard_score"] > 60.0


def test_infer_route_risk_and_feasibility():
    payload = {
        "total_distance_km": 4.2,
        "max_slope_degrees": 8.0,
        "avg_slope_degrees": 4.0,
        "elevation_gain_m": 45.0,
        "elevation_loss_m": 30.0,
        "duration_ratio": 0.7,
        "critical_hazard_count": 0,
        "science_point_count": 3,
    }
    response = client.post("/api/v1/infer/route-risk", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["risk_score"] < 50.0
    assert data["feasibility_status"] == "MISSION FEASIBLE"


def test_infer_traversability():
    payload = {
        "slope_degrees": 7.0,
        "roughness": 0.15,
        "rock_abundance_pct": 4.0,
        "loose_dust": False,
    }
    response = client.post("/api/v1/infer/traversability", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["terrain_classification"] == "PASSABLE"
    assert data["traversability_index"] > 0.65


def test_infer_target_priority():
    payload = {
        "targets": [
            {
                "target_id": "tgt-1",
                "target_name": "Jezero Delta Front",
                "distance_km": 1.2,
                "slope_degrees": 5.0,
                "base_scientific_value": 95.0,
                "roughness": 0.2,
                "accessibility_index": 0.9,
            },
            {
                "target_id": "tgt-2",
                "target_name": "Distant Crater Scarp",
                "distance_km": 11.5,
                "slope_degrees": 24.0,
                "base_scientific_value": 60.0,
                "roughness": 0.7,
                "accessibility_index": 0.3,
            },
        ]
    }
    response = client.post("/api/v1/infer/target-priority", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data["ranked_targets"]) == 2
    assert data["ranked_targets"][0]["target_id"] == "tgt-1"
    assert data["ranked_targets"][0]["rank"] == 1


def test_assess_mission_contract():
    payload = {
        "route": {
            "id": "route-test-1",
            "name": "Jezero Delta Traverse",
            "points": [
                {
                    "id": "p1",
                    "label": "Start",
                    "coordinate": {"latitude": 18.38, "longitude": 77.58},
                    "type": "start",
                },
                {
                    "id": "p2",
                    "label": "Delta Outcrop",
                    "coordinate": {"latitude": 18.40, "longitude": 77.60},
                    "type": "science",
                    "targetId": "tgt-1",
                },
            ],
            "segments": [
                {
                    "id": "s1",
                    "fromPointId": "p1",
                    "toPointId": "p2",
                    "distanceMeters": 1500.0,
                    "averageSlopeDegrees": 5.2,
                    "difficulty": "low",
                }
            ],
            "totalDistanceKm": 1.5,
            "estimatedDurationMinutes": 75.0,
            "maxSlopeDegrees": 9.0,
            "elevationGainM": 20.0,
            "elevationLossM": 10.0,
            "overallDifficulty": "low",
        },
        "parameters": {
            "maxDurationMinutes": 180.0,
            "astronautSkillLevel": "expert",
        },
    }
    response = client.post("/api/v1/assess", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "safetyScore" in data
    assert "scienceScore" in data
    assert "accessibilityScore" in data
    assert "overallScore" in data
    assert data["scoringSource"] == "model-generated"
    assert data["missionStatus"] == "MISSION FEASIBLE"
