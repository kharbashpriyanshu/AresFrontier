# Security Model — Role-Based Access Control & Replay Protection

## 1. Zero-Trust Server Boundary
Client applications and telemetry payloads are considered untrusted. Teleoperation and commanding require explicit cryptographically verified authentication:
- Client-supplied `approvedBy`, `role`, or `issuer` fields in request bodies are ignored.
- Identity and role permissions are derived exclusively from verified JWT server tokens.

## 2. Role-Based Access Control (RBAC) Matrix
The system enforces five operational roles:

| Role | Telemetry Read | Assign Science | Command Rover | Approve Replan | Emergency Stop | Override Safety |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `VIEWER` | Yes | No | No | No | No | No |
| `ANALYST` | Yes | Yes | No | No | No | No |
| `ASTRONAUT` | Yes | Yes | Yes | Yes | Yes | No |
| `SCIENCE_OFFICER`| Yes | Yes | No | No | No | No |
| `MISSION_COMMAND`| Yes | Yes | Yes | Yes | Yes | Yes |

## 3. Anti-Replay Envelope Protocol
Every mission command must be submitted in a signed envelope:
```json
{
  "commandId": "cmd-8947238472-abcd",
  "agentId": "agent-rover-01",
  "command": "PAUSE",
  "nonce": "nonce-78a6fd34b1",
  "issuedAt": 1741400000000,
  "expiresAt": 1741400300000,
  "issuer": "Commander Alex Vance",
  "role": "MISSION_COMMAND"
}
```

Rejection occurs if:
1. `commandId` has already been executed within memory cache TTL.
2. `nonce` has already been spent.
3. System time exceeds `expiresAt` (TTL default = 300s).
4. Timestamp difference exceeds clock skew margin ($\pm 30\text{ seconds}$).
5. Role lacks permission in the RBAC matrix.
