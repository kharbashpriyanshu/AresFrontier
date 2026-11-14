import pytest
from fastapi.testclient import TestClient
import sys
import os

science_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if science_dir not in sys.path:
    sys.path.insert(0, science_dir)

import importlib.util
spec = importlib.util.spec_from_file_location("science_app_module", os.path.join(science_dir, "app.py"))
science_mod = importlib.util.module_from_spec(spec)
sys.modules["science_app_module"] = science_mod
spec.loader.exec_module(science_mod)
app = science_mod.app

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "Jezero Crater" in data["supported_regions"]
    assert "Gale Crater & Mount Sharp" in data["supported_regions"]


def test_assess_coordinate_jezero():
    # Jezero Delta coordinates (approx 18.38 N, 77.58 E)
    response = client.get("/api/v1/science/assess?lat=18.38&lon=77.58")
    assert response.status_code == 200
    data = response.json()
    assert data["scientificValue"] == "high"
    assert "Jezero" in data["geologicalContext"]
    assert "Mg-smectite" in data["mineralContext"]
    assert len(data["samplePriorities"]) > 0
    assert "Noachian-Hesperian" in data["geologicalEpoch"]
    assert len(data["sources"]) >= 2


def test_assess_coordinate_regional():
    # Regional point away from named provinces
    response = client.get("/api/v1/science/assess?lat=-32.5&lon=12.0")
    assert response.status_code == 200
    data = response.json()
    assert data["scientificValue"] in ["low", "medium"]
    assert "Noachian" in data["geologicalEpoch"]
    assert len(data["sources"]) > 0


def test_evaluate_target_delta():
    payload = {
        "target_id": "tgt-delta-1",
        "name": "Western Fan Bottomset Strata",
        "latitude": 18.42,
        "longitude": 77.55,
        "target_type": "delta",
        "description": "Fine-grained laminated bottomset mudstones",
        "primary_objective": "PAST_HABITABILITY",
    }
    response = client.post("/api/v1/science/evaluate-target", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["biosignature_preservation_potential"] in ["HIGH", "EXCEPTIONAL"]
    assert data["scientific_yield_score"] >= 90.0
    assert data["sample_return_priority"] == "PRIORITY_1"


def test_evaluate_objectives():
    payload = {
        "objective_id": "ANCIENT_WATER_ACTIVITY",
        "target_ids": ["t1", "t2"],
        "coordinates": [
            {"latitude": 18.42, "longitude": 77.55},
            {"latitude": -4.6, "longitude": 137.4},
        ],
    }
    response = client.post("/api/v1/science/evaluate-objectives", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["mepag_alignment_score"] > 60.0
    assert data["scientific_diversity_score"] > 50.0
    assert len(data["covered_geological_eras"]) >= 1


def test_classify_mineralogy():
    payload = {
        "latitude": 18.38,
        "longitude": 77.58,
        "spectral_features": ["1.4um_oh", "1.9um_h2o", "2.3um_fe_mg"],
    }
    response = client.post("/api/v1/science/classify-mineralogy", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data["primary_minerals"]) >= 2
    assert data["pH_regime"] in ["alkaline_neutral", "moderately_acidic"]


def test_assess_subsurface_ice_polar():
    payload = {
        "latitude": 62.0,
        "longitude": 110.0,
    }
    response = client.post("/api/v1/science/assess-ice", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["subsurface_ice_probability"] > 0.70
    assert data["ice_stability_zone"] == "STABLE_SHALLOW"
    assert data["isru_accessibility_rating"] == "EXCELLENT"


def test_assess_subsurface_ice_equatorial():
    payload = {
        "latitude": 5.0,
        "longitude": -45.0,
    }
    response = client.post("/api/v1/science/assess-ice", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["subsurface_ice_probability"] < 0.10
    assert data["ice_stability_zone"] == "UNSTABLE"
    assert data["isru_accessibility_rating"] == "NON_VIABLE"
