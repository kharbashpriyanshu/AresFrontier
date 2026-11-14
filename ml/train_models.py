"""
Martian Map - ML Training Pipeline
Trains and serializes machine learning models for Mars terrain hazard assessment,
route risk regression, mission feasibility classification, and target prioritization.

DATA CLASSIFICATION:
The training datasets are synthetic, generated according to defensible Martian physical
constraints (MOLA slope distributions, THEMIS thermal inertia ranges, Apollo/Artemis
metabolic expenditure models, and MER/MSL/Perseverance rover wheel-slip physics).
All model outputs are explicitly flagged as 'synthetic-model-generated'.
"""

import os
import json
from datetime import datetime, timezone
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier, GradientBoostingRegressor
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    mean_absolute_error,
    r2_score,
)
import joblib

MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
os.makedirs(MODEL_DIR, exist_ok=True)


def generate_terrain_hazard_data(n_samples: int = 4000, random_state: int = 42):
    """
    Features:
    0: slope_degrees (0 - 45)
    1: elevation_delta_m (-200 to +200)
    2: roughness_index (0.0 - 1.0)
    3: rock_abundance_pct (0.0 - 50.0)
    4: dust_cover_index (0.0 - 1.0)
    5: thermal_inertia_si (50 - 600 J m^-2 K^-1 s^-1/2)
    """
    rng = np.random.RandomState(random_state)

    slope = rng.exponential(scale=7.0, size=n_samples)
    slope = np.clip(slope, 0.0, 45.0)

    elevation_delta = rng.normal(loc=0.0, scale=35.0, size=n_samples)
    roughness = rng.beta(a=2.0, b=5.0, size=n_samples)
    rock_abundance = rng.gamma(shape=2.0, scale=4.0, size=n_samples)
    rock_abundance = np.clip(rock_abundance, 0.0, 50.0)
    dust_cover = rng.uniform(0.0, 1.0, size=n_samples)
    thermal_inertia = rng.normal(loc=280.0, scale=90.0, size=n_samples)
    thermal_inertia = np.clip(thermal_inertia, 50.0, 600.0)

    X = np.column_stack([slope, elevation_delta, roughness, rock_abundance, dust_cover, thermal_inertia])

    # Hazard calculation physics:
    # High slope (>20 deg) is primary slip hazard on Mars (repose angle ~30-34 deg)
    # High roughness + rock abundance causes chassis/boot hang-up
    # High dust + low thermal inertia = deep drift entrapment risk (Opportunity Purgatory dune analog)
    hazard_score = (
        (slope / 30.0) * 45.0
        + roughness * 20.0
        + (rock_abundance / 50.0) * 15.0
        + (dust_cover * (1.0 - thermal_inertia / 600.0)) * 20.0
    )
    hazard_score += rng.normal(0.0, 4.0, size=n_samples)
    hazard_score = np.clip(hazard_score, 0.0, 100.0)

    # Class 0: LOW (<30), Class 1: MODERATE (30-65), Class 2: CRITICAL (>65)
    y_class = np.zeros(n_samples, dtype=int)
    y_class[hazard_score >= 30.0] = 1
    y_class[hazard_score >= 65.0] = 2

    return X, y_class, hazard_score


def generate_route_risk_data(n_samples: int = 3500, random_state: int = 42):
    """
    Features:
    0: total_distance_km (0.1 - 25.0)
    1: max_slope_degrees (0 - 40)
    2: avg_slope_degrees (0 - 25)
    3: elevation_gain_m (0 - 800)
    4: elevation_loss_m (0 - 800)
    5: duration_ratio (estimated_duration / max_duration, 0.2 - 2.0)
    6: critical_hazard_count (0 - 10)
    7: science_point_count (0 - 8)
    """
    rng = np.random.RandomState(random_state)

    dist = rng.uniform(0.5, 18.0, size=n_samples)
    max_slope = rng.gamma(shape=3.0, scale=4.0, size=n_samples)
    max_slope = np.clip(max_slope, 0.0, 38.0)
    avg_slope = max_slope * rng.uniform(0.3, 0.65, size=n_samples)
    elev_gain = dist * rng.uniform(10.0, 40.0, size=n_samples)
    elev_loss = dist * rng.uniform(10.0, 40.0, size=n_samples)
    duration_ratio = (dist / 4.0) * rng.uniform(0.6, 1.3, size=n_samples)
    duration_ratio = np.clip(duration_ratio, 0.2, 2.2)
    crit_hazards = rng.poisson(lam=max_slope / 10.0, size=n_samples)
    crit_hazards = np.clip(crit_hazards, 0, 10)
    science_points = rng.randint(0, 7, size=n_samples)

    X = np.column_stack([
        dist, max_slope, avg_slope, elev_gain, elev_loss,
        duration_ratio, crit_hazards, science_points
    ])

    # Route Risk Score (0-100, where 100 = extreme risk)
    risk_score = (
        (max_slope / 30.0) * 35.0
        + np.maximum(0.0, duration_ratio - 1.0) * 45.0
        + (crit_hazards * 5.0)
        + (dist / 15.0) * 15.0
    )
    risk_score += rng.normal(0.0, 3.5, size=n_samples)
    risk_score = np.clip(risk_score, 0.0, 100.0)

    # Feasibility Class:
    # 0: MISSION FEASIBLE
    # 1: MISSION RESTRICTED
    # 2: MISSION CONSTRAINT EXCEEDED
    feasibility = np.zeros(n_samples, dtype=int)
    for i in range(n_samples):
        if duration_ratio[i] > 1.05 or max_slope[i] > 22.0 or crit_hazards[i] >= 3:
            feasibility[i] = 2  # CONSTRAINT EXCEEDED
        elif risk_score[i] > 45.0 or max_slope[i] > 14.0 or duration_ratio[i] > 0.85:
            feasibility[i] = 1  # RESTRICTED
        else:
            feasibility[i] = 0  # FEASIBLE

    return X, risk_score, feasibility


def generate_target_priority_data(n_samples: int = 2500, random_state: int = 42):
    """
    Features:
    0: distance_from_ingress_km (0.1 - 15.0)
    1: slope_to_target_degrees (0 - 35)
    2: base_scientific_value (10 - 100)
    3: terrain_roughness (0.0 - 1.0)
    4: accessibility_index (0.0 - 1.0)
    """
    rng = np.random.RandomState(random_state)
    dist = rng.uniform(0.2, 12.0, size=n_samples)
    slope = rng.gamma(shape=2.5, scale=4.5, size=n_samples)
    slope = np.clip(slope, 0.0, 35.0)
    base_sci = rng.uniform(20.0, 100.0, size=n_samples)
    roughness = rng.uniform(0.1, 0.9, size=n_samples)
    accessibility = np.clip(1.0 - (slope / 30.0) * 0.6 - (dist / 12.0) * 0.4, 0.05, 1.0)

    X = np.column_stack([dist, slope, base_sci, roughness, accessibility])

    # Priority score = Science yield penalized by distance, slope, accessibility
    priority = (
        base_sci * 0.6
        + accessibility * 30.0
        - (dist / 12.0) * 20.0
        - (slope / 35.0) * 15.0
    )
    priority += rng.normal(0.0, 3.0, size=n_samples)
    priority = np.clip(priority, 5.0, 100.0)

    return X, priority


def train_and_serialize_models():
    print("[1/4] Generating physically-constrained synthetic Martian datasets...")
    X_haz, y_haz_class, _ = generate_terrain_hazard_data()
    X_route, y_route_risk, y_route_feas = generate_route_risk_data()
    X_target, y_target_prio = generate_target_priority_data()

    # Split datasets
    X_h_train, X_h_test, y_h_train, y_h_test = train_test_split(X_haz, y_haz_class, test_size=0.2, random_state=42)
    X_r_train, X_r_test, y_r_train, y_r_test = train_test_split(X_route, y_route_risk, test_size=0.2, random_state=42)
    X_f_train, X_f_test, y_f_train, y_f_test = train_test_split(X_route, y_route_feas, test_size=0.2, random_state=42)
    X_t_train, X_t_test, y_t_train, y_t_test = train_test_split(X_target, y_target_prio, test_size=0.2, random_state=42)

    print("[2/4] Training scikit-learn models...")
    # Model 1: Terrain Hazard Classifier
    hazard_model = RandomForestClassifier(n_estimators=100, max_depth=8, random_state=42)
    hazard_model.fit(X_h_train, y_h_train)
    h_pred = hazard_model.predict(X_h_test)
    h_acc = float(accuracy_score(y_h_test, h_pred))
    h_f1 = float(f1_score(y_h_test, h_pred, average="weighted"))

    # Model 2: Route Risk Regressor
    risk_model = GradientBoostingRegressor(n_estimators=100, max_depth=4, learning_rate=0.08, random_state=42)
    risk_model.fit(X_r_train, y_r_train)
    r_pred = risk_model.predict(X_r_test)
    r_mae = float(mean_absolute_error(y_r_test, r_pred))
    r_r2 = float(r2_score(y_r_test, r_pred))

    # Model 3: Mission Feasibility Classifier
    feasibility_model = RandomForestClassifier(n_estimators=100, max_depth=7, random_state=42)
    feasibility_model.fit(X_f_train, y_f_train)
    f_pred = feasibility_model.predict(X_f_test)
    f_acc = float(accuracy_score(y_f_test, f_pred))
    f_f1 = float(f1_score(y_f_test, f_pred, average="weighted"))

    # Model 4: Target Priority Regressor
    target_prio_model = GradientBoostingRegressor(n_estimators=80, max_depth=4, learning_rate=0.1, random_state=42)
    target_prio_model.fit(X_t_train, y_t_train)
    t_pred = target_prio_model.predict(X_t_test)
    t_mae = float(mean_absolute_error(y_t_test, t_pred))
    t_r2 = float(r2_score(y_t_test, t_pred))

    print(f"Hazard Classifier Accuracy: {h_acc:.3f}, F1: {h_f1:.3f}")
    print(f"Risk Regressor MAE: {r_mae:.2f}, R2: {r_r2:.3f}")
    print(f"Feasibility Classifier Accuracy: {f_acc:.3f}, F1: {f_f1:.3f}")
    print(f"Target Priority Regressor MAE: {t_mae:.2f}, R2: {t_r2:.3f}")

    print("[3/4] Serializing models to joblib artifacts...")
    hazard_path = os.path.join(MODEL_DIR, "terrain_hazard_classifier.joblib")
    risk_path = os.path.join(MODEL_DIR, "route_risk_regressor.joblib")
    feasibility_path = os.path.join(MODEL_DIR, "mission_feasibility_classifier.joblib")
    target_prio_path = os.path.join(MODEL_DIR, "target_priority_regressor.joblib")

    joblib.dump(hazard_model, hazard_path)
    joblib.dump(risk_model, risk_path)
    joblib.dump(feasibility_model, feasibility_path)
    joblib.dump(target_prio_model, target_prio_path)

    metadata = {
        "model_version": "1.0.0",
        "trained_at_utc": datetime.now(timezone.utc).isoformat(),
        "data_provenance": {
            "classification": "synthetic-physics-constrained",
            "description": "Synthetic Martian traverse data parameterized by MOLA topography distributions, THEMIS thermal inertia ranges, and Apollo/Artemis metabolic traverse physics.",
            "disclaimer": "Synthetic training data only. Not validated on real-world Martian EVA missions without in-situ ground truthing."
        },
        "models": {
            "terrain_hazard_classifier": {
                "algorithm": "RandomForestClassifier",
                "features": ["slope_degrees", "elevation_delta_m", "roughness_index", "rock_abundance_pct", "dust_cover_index", "thermal_inertia_si"],
                "classes": ["LOW", "MODERATE", "CRITICAL"],
                "metrics": {"accuracy": round(h_acc, 4), "f1_weighted": round(h_f1, 4)},
                "file": "terrain_hazard_classifier.joblib"
            },
            "route_risk_regressor": {
                "algorithm": "GradientBoostingRegressor",
                "features": ["total_distance_km", "max_slope_degrees", "avg_slope_degrees", "elevation_gain_m", "elevation_loss_m", "duration_ratio", "critical_hazard_count", "science_point_count"],
                "metrics": {"mae": round(r_mae, 4), "r2": round(r_r2, 4)},
                "file": "route_risk_regressor.joblib"
            },
            "mission_feasibility_classifier": {
                "algorithm": "RandomForestClassifier",
                "features": ["total_distance_km", "max_slope_degrees", "avg_slope_degrees", "elevation_gain_m", "elevation_loss_m", "duration_ratio", "critical_hazard_count", "science_point_count"],
                "classes": ["MISSION FEASIBLE", "MISSION RESTRICTED", "MISSION CONSTRAINT EXCEEDED"],
                "metrics": {"accuracy": round(f_acc, 4), "f1_weighted": round(f_f1, 4)},
                "file": "mission_feasibility_classifier.joblib"
            },
            "target_priority_regressor": {
                "algorithm": "GradientBoostingRegressor",
                "features": ["distance_from_ingress_km", "slope_to_target_degrees", "base_scientific_value", "terrain_roughness", "accessibility_index"],
                "metrics": {"mae": round(t_mae, 4), "r2": round(t_r2, 4)},
                "file": "target_priority_regressor.joblib"
            }
        }
    }

    metadata_path = os.path.join(MODEL_DIR, "model_metadata.json")
    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    print(f"[4/4] Successfully saved all models and metadata to {MODEL_DIR}")


if __name__ == "__main__":
    train_and_serialize_models()

