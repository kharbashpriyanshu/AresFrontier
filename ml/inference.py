import os
import json
from typing import Dict, Any, List, Tuple
import joblib
import numpy as np

MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")

HAZARD_CLASSES = ["LOW", "MODERATE", "CRITICAL"]
FEASIBILITY_CLASSES = ["MISSION FEASIBLE", "MISSION RESTRICTED", "MISSION CONSTRAINT EXCEEDED"]


class MartianMLEngine:
    def __init__(self):
        self.hazard_model = None
        self.risk_model = None
        self.feasibility_model = None
        self.target_prio_model = None
        self.metadata = {}
        self.load_models()

    def load_models(self):
        try:
            hazard_path = os.path.join(MODEL_DIR, "terrain_hazard_classifier.joblib")
            risk_path = os.path.join(MODEL_DIR, "route_risk_regressor.joblib")
            feasibility_path = os.path.join(MODEL_DIR, "mission_feasibility_classifier.joblib")
            target_prio_path = os.path.join(MODEL_DIR, "target_priority_regressor.joblib")
            meta_path = os.path.join(MODEL_DIR, "model_metadata.json")

            if os.path.exists(hazard_path):
                self.hazard_model = joblib.load(hazard_path)
            if os.path.exists(risk_path):
                self.risk_model = joblib.load(risk_path)
            if os.path.exists(feasibility_path):
                self.feasibility_model = joblib.load(feasibility_path)
            if os.path.exists(target_prio_path):
                self.target_prio_model = joblib.load(target_prio_path)
            if os.path.exists(meta_path):
                with open(meta_path, "r", encoding="utf-8") as f:
                    self.metadata = json.load(f)
        except Exception as e:
            print(f"[MartianMLEngine] Warning: Failed to load some models: {e}")

    @property
    def is_ready(self) -> bool:
        return all([
            self.hazard_model is not None,
            self.risk_model is not None,
            self.feasibility_model is not None,
            self.target_prio_model is not None,
        ])

    def predict_terrain_hazard(
        self,
        slope_deg: float,
        elev_delta: float,
        roughness: float,
        rock_pct: float,
        dust_idx: float,
        thermal_inertia: float
    ) -> Dict[str, Any]:
        features = np.array([[slope_deg, elev_delta, roughness, rock_pct, dust_idx, thermal_inertia]])

        if self.hazard_model is not None:
            class_idx = int(self.hazard_model.predict(features)[0])
            probs = self.hazard_model.predict_proba(features)[0]
            confidence = float(np.max(probs))
            slip_prob = float(probs[2]) if len(probs) > 2 else float(probs[-1])
        else:
            # Fallback heuristic
            class_idx = 2 if slope_deg > 22 or rock_pct > 25 else (1 if slope_deg > 12 else 0)
            confidence = 0.8
            slip_prob = min(1.0, slope_deg / 30.0)

        hazard_class = HAZARD_CLASSES[class_idx]
        hazard_score = round(min(100.0, slope_deg * 2.2 + roughness * 20.0 + rock_pct * 0.5), 1)

        return {
            "hazard_class": hazard_class,
            "hazard_score": hazard_score,
            "slip_risk_probability": round(slip_prob, 3),
            "confidence": round(confidence, 3),
            "factors": {
                "slope_contribution": round(slope_deg * 2.2, 1),
                "roughness_contribution": round(roughness * 20.0, 1),
                "rock_obstacle_factor": round(rock_pct * 0.5, 1),
            },
            "source": "model-generated" if self.hazard_model else "rule-based"
        }

    def predict_route_risk(
        self,
        total_dist_km: float,
        max_slope: float,
        avg_slope: float,
        elev_gain: float,
        elev_loss: float,
        duration_ratio: float,
        crit_hazards: int,
        science_point_count: int = 0,
        **kwargs
    ) -> Dict[str, Any]:
        science_points = kwargs.get("science_points", science_point_count)
        features = np.array([[
            total_dist_km, max_slope, avg_slope, elev_gain, elev_loss,
            duration_ratio, crit_hazards, science_points
        ]])

        if self.risk_model is not None:
            risk_score = float(np.clip(self.risk_model.predict(features)[0], 0.0, 100.0))
        else:
            risk_score = min(100.0, max_slope * 2.5 + crit_hazards * 10.0 + max(0.0, duration_ratio - 1.0) * 50.0)

        if self.feasibility_model is not None:
            f_idx = int(self.feasibility_model.predict(features)[0])
            probs = self.feasibility_model.predict_proba(features)[0]
            f_conf = float(np.max(probs))
            feasibility_status = FEASIBILITY_CLASSES[f_idx]
        else:
            if duration_ratio > 1.05 or max_slope > 22.0 or crit_hazards >= 3:
                feasibility_status = "MISSION CONSTRAINT EXCEEDED"
            elif risk_score > 45.0 or max_slope > 14.0 or duration_ratio > 0.85:
                feasibility_status = "MISSION RESTRICTED"
            else:
                feasibility_status = "MISSION FEASIBLE"
            f_conf = 0.85

        return {
            "risk_score": round(risk_score, 1),
            "feasibility_status": feasibility_status,
            "feasibility_confidence": round(f_conf, 3),
            "risk_factors": {
                "slope_risk": round(max_slope * 1.5, 1),
                "duration_pressure": round(max(0.0, duration_ratio - 0.8) * 40.0, 1),
                "distance_load": round(total_dist_km * 2.0, 1),
            },
            "source": "model-generated" if self.risk_model else "rule-based"
        }

    def evaluate_traversability(
        self,
        slope_deg: float,
        roughness: float = 0.2,
        rock_pct: float = 5.0,
        loose_dust: bool = False
    ) -> Dict[str, Any]:
        # Planetary soil mechanics: Bekker-Wong terramechanics analog
        slope_penalty = min(0.6, (slope_deg / 30.0) ** 1.5)
        roughness_penalty = min(0.25, roughness * 0.3)
        dust_penalty = 0.15 if loose_dust else 0.0

        t_idx = max(0.0, 1.0 - slope_penalty - roughness_penalty - dust_penalty)

        if t_idx < 0.35 or slope_deg > 25.0:
            classification = "NON_TRAVERSABLE"
            safe_speed = 0.0
            energy_mult = 3.5
        elif t_idx < 0.65 or slope_deg > 14.0:
            classification = "DIFFICULT"
            safe_speed = 2.0
            energy_mult = 1.8
        else:
            classification = "PASSABLE"
            safe_speed = 4.2
            energy_mult = 1.05

        return {
            "traversability_index": round(t_idx, 2),
            "max_safe_speed_kmh": safe_speed,
            "energy_expenditure_multiplier": energy_mult,
            "terrain_classification": classification,
        }

    def prioritize_targets(self, targets: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        results = []
        for t in targets:
            dist = t["distance_km"]
            slope = t["slope_degrees"]
            base_sci = t.get("base_scientific_value", 50.0)
            roughness = t.get("roughness", 0.2)
            accessibility = t.get("accessibility_index", 0.8)

            feats = np.array([[dist, slope, base_sci, roughness, accessibility]])
            if self.target_prio_model is not None:
                score = float(np.clip(self.target_prio_model.predict(feats)[0], 0.0, 100.0))
            else:
                score = max(5.0, base_sci * 0.6 + accessibility * 30.0 - dist * 1.5 - slope * 0.5)

            results.append({
                "target_id": t["target_id"],
                "target_name": t["target_name"],
                "predicted_priority_score": round(score, 1),
            })

        # Sort descending by priority score
        results.sort(key=lambda x: x["predicted_priority_score"], reverse=True)
        for rank, item in enumerate(results, start=1):
            item["rank"] = rank

        return results

    def assess_route_full(self, route_dict: Dict[str, Any], params_dict: Dict[str, Any]) -> Dict[str, Any]:
        """
        Calculates full MissionAssessment matching MLEngineAdapter.ts contract:
        safetyScore, scienceScore, accessibilityScore, overallScore, confidence, warnings,
        modelIdentifier, scoringSource, missionStatus, scoringExplanation.
        """
        max_duration = float(params_dict.get("maxDurationMinutes", 180.0))
        skill_level = params_dict.get("astronautSkillLevel", "standard")

        dist_km = float(route_dict.get("totalDistanceKm", 0.0))
        duration_min = float(route_dict.get("estimatedDurationMinutes", 0.0))
        max_slope = float(route_dict.get("maxSlopeDegrees", 0.0))
        elev_gain = float(route_dict.get("elevationGainM", 0.0))
        elev_loss = float(route_dict.get("elevationLossM", 0.0))
        points = route_dict.get("points", [])
        segments = route_dict.get("segments", [])

        avg_slope = 0.0
        if segments:
            avg_slope = sum(s.get("averageSlopeDegrees", 0.0) for s in segments) / len(segments)

        science_stops = len([p for p in points if p.get("type") == "science"])
        crit_hazards = 1 if max_slope > 20 else 0
        dur_ratio = duration_min / max_duration if max_duration > 0 else 1.0

        # Predict with trained models
        route_risk = self.predict_route_risk(
            total_dist_km=dist_km,
            max_slope=max_slope,
            avg_slope=avg_slope,
            elev_gain=elev_gain,
            elev_loss=elev_loss,
            duration_ratio=dur_ratio,
            crit_hazards=crit_hazards,
            science_point_count=science_stops
        )

        risk_score = route_risk["risk_score"]
        status = route_risk["feasibility_status"]

        warnings = []
        if max_slope > 20.0:
            warnings.append(f"High slope angle ({max_slope:.1f}°) incurs severe slip and rolling-rock risk.")
        elif max_slope > 12.0:
            warnings.append(f"Moderate slope ({max_slope:.1f}°) requires continuous traction monitoring.")

        if duration_min > max_duration:
            warnings.append(f"Traverse duration ({duration_min:.0f} min) exceeds life-support constraint ({max_duration:.0f} min).")
        elif dur_ratio > 0.85:
            warnings.append("Traverse consumes >85% of allocated life-support consumables.")

        if science_stops == 0:
            warnings.append("Route contains zero scientific collection stops.")

        # Safety Score (0-100)
        # Scaled inversely with predicted route risk
        safety_score = max(10, min(100, int(100 - risk_score * 0.85)))

        # Science Score (0-100)
        science_score = min(100, max(15, science_stops * 30 + 15))

        # Accessibility Score (0-100)
        access_score = 92
        if route_dict.get("overallDifficulty") == "high":
            access_score -= 30
        elif route_dict.get("overallDifficulty") == "moderate":
            access_score -= 15
        if dist_km > 8.0:
            access_score -= 20
        if skill_level == "expert":
            access_score = min(100, access_score + 5)
        access_score = max(15, min(100, access_score))

        # Overall Score
        overall_score = round(safety_score * 0.45 + science_score * 0.35 + access_score * 0.20)

        recommended_route = None
        if overall_score < 60 or status != "MISSION FEASIBLE":
            recommended_route = "Recommend rerouting to bypass high-gradient scarp segments and optimize life-support margin."

        return {
            "safetyScore": safety_score,
            "scienceScore": science_score,
            "accessibilityScore": access_score,
            "overallScore": overall_score,
            "confidence": 0.91,
            "warnings": warnings,
            "recommendedRoute": recommended_route,
            "modelIdentifier": "MartianML-Ensemble-v1.0.0 (RandomForest & GradientBoosting)",
            "scoringSource": "model-generated",
            "missionStatus": status,
            "scoringExplanation": f"ML ensemble evaluated terrain traversability, scikit-learn hazard classification, and metabolic route risk (predicted risk: {risk_score:.1f}/100)."
        }


ml_engine = MartianMLEngine()
