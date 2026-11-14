# Martian Map — Phase 3 Cybersecurity & Governance Architecture

## 1. Threat Model & Operational Risk Scenarios

Planetary EVA decision-support systems face severe mission-critical security risks:
- **Telemetry Spoofing**: Injection of false oxygen reserves or slope data resulting in life support depletion.
- **Route Tampering**: Unauthorized alteration of waypoints into unstable crater scarps.
- **Plan Drift**: Astronaut executing a draft or superseded route after ground control revisions.

---

## 2. Multi-Role Access Control (RBAC)

The system enforces 5 distinct operational roles with explicit permission boundaries:

| Role | Permissions | Responsibilities |
| :--- | :--- | :--- |
| **`MISSION_COMMAND`** | Full authorization: Create, Assess, Approve, Lock, Override | Flight Director / Station Commander |
| **`SCIENCE_OFFICER`** | Objective configuration, science scoring overrides, waypoint suggestions | Payload & Science Team |
| **`ASTRONAUT`** | Telemetry viewing, route navigation, field notes recording | Crew members executing surface EVA |
| **`ANALYST`** | Read-only simulation, model benchmarking, trade-off inspection | Telemetry analysts and flight engineers |
| **`VIEWER`** | Read-only inspection of approved & public mission plans | Public outreach and observation consoles |

---

## 3. Cryptographic SHA-256 Audit Chain

All mission critical events (route creation, evaluation, approval, locking) are appended to an immutable, persistent hash chain (`data/audit_chain.json`).

### Block Schema
```json
{
  "eventId": "evt-1762512800000-abcd",
  "blockHeight": 12,
  "timestamp": "2026-11-07T14:30:00.000Z",
  "userId": "commander-01",
  "role": "MISSION_COMMAND",
  "action": "LOCK_PLAN",
  "missionPlanId": "MARSWALK-001",
  "planVersion": 2,
  "previousHash": "a1b2c3d4e5f6...",
  "integrityHash": "f6e5d4c3b2a1...",
  "details": {
    "recommendedRouteId": "cand-balanced-001",
    "riskAdjustedScore": 88
  }
}
```

### Verification Endpoint
- `POST /api/security/verify-audit-chain`
- Validates genesis block `0000000000000000000000000000000000000000000000000000000000000000`.
- Traverses the entire chain recalculating `SHA-256(previousHash + eventId + timestamp + action + details)`.
- Instantly detects any modified or injected blocks.

---

## 4. Mission Plan Versioning & Cryptographic Locking

Mission plans progress through a formal 4-stage lifecycle:
1. **`DRAFT`**: Initial waypoint planning and iterative parameter adjustments.
2. **`ASSESSED`**: Multi-candidate optimization and multi-objective scoring executed.
3. **`APPROVED`**: Formally reviewed and signed by `MISSION_COMMAND`.
4. **`LOCKED`**: Cryptographically frozen; waypoints and parameters cannot be modified without generating a new version block.
