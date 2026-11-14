# Science & Planetary Geology Module Interface (Person 4)

## Welcome Person 4 (Science / Planetary Domain Expert)

This directory houses scientific methodologies, geological categorization rules, and target assessment rules.

### How your work integrates into the software:
The backend calls a clean service adapter located at:
`backend/src/services/science/scienceEngineAdapter.ts`

### Interface Contract:
```ts
export interface ScientificAssessment {
    geologicalContext?: string;
    mineralContext?: string;
    thermalContext?: string;
    scientificValue: "low" | "medium" | "high";
    explanation: string;
    sources: string[];
}
```

### Endpoints Powered by Your Module:
- `GET /api/science/targets` - Returns planetary targets (deltas, layered sulfate outcrops, crater rims, phyllosilicate beds).
- `GET /api/science/assessment?lat={lat}&lon={lon}` - Returns geological interpretation and scientific scoring for any location on Mars.

### How to contribute:
1. Provide planetary science rules and geological datasets in JSON or TypeScript format.
2. If you create a standalone Python or Node service, update `backend/src/services/science/scienceEngineAdapter.ts` to call your service or import your rules directly.
3. Add scientific references and documentation in `docs/DATA_SOURCES.md` and this folder.
