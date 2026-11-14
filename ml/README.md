# AI / Data Science Module Interface (Person 3)

## Welcome Person 3 (AI / Machine Learning Engineer)

This directory is reserved for model definitions, training scripts, feature engineering, and inference pipelines.

### How your work integrates into the software:
The backend communicates with your model via the adapter located at:
`backend/src/services/ml/mlEngineAdapter.ts`

### Interface Contract:
```ts
export interface MissionAssessmentRequest {
    routeId: string;
    missionParameters: {
        maxDurationMinutes: number;
        astronautSkillLevel?: "standard" | "expert";
    };
}

export interface MissionAssessment {
    safetyScore: number;         // 0 - 100
    scienceScore: number;        // 0 - 100
    accessibilityScore: number;  // 0 - 100
    overallScore: number;        // 0 - 100
    confidence: number;          // 0.0 - 1.0
    warnings: string[];
    recommendedRoute?: string;
}
```

### Endpoints Powered by Your Module:
- `POST /api/assessment` - Evaluates an astronaut EVA traverse route for slope risk, hazard zones, duration overrun, and scientific yield.

### Standalone Inference Service (Optional):
If your model runs as a Python FastAPI or Flask service, configure `ML_SERVICE_URL` in `.env` (e.g. `http://localhost:8000`). The `mlEngineAdapter.ts` will automatically dispatch to your HTTP endpoint or use the fallback baseline scoring model.
