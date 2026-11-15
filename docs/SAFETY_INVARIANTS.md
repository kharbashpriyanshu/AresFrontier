# Safety Invariants (S1 – S8) — Verified Operational Rules

Ares Frontier enforces eight non-negotiable safety invariants to guarantee mission integrity:

| Invariant | Title | Rule Formulation | Enforcement Subsystem |
| :--- | :--- | :--- | :--- |
| **S1** | **Battery Reserve Limit** | Never command a rover below 20% safe return reserve. | `SafetyInvariantService.verifyS1_BatteryReserve` |
| **S2** | **Route Feasibility Gate** | Never execute a route with safety score < 40 or risk-adjusted score < 30. | `SafetyInvariantService.verifyS2_RouteSafety` |
| **S3** | **Human Authority Gate** | Never execute safety overrides or replan authorizations without `MISSION_COMMAND` role. | `SafetyInvariantService.verifyS3_HumanAuthorization` |
| **S4** | **No Event Discard** | Event ledger length must be strictly non-decreasing. | `SafetyInvariantService.verifyS4_NoEventDiscard` |
| **S5** | **No Lost-Link Routing** | Never route packets across communication links marked `LOST`. | `SafetyInvariantService.verifyS5_NoLostLinkTransmission` |
| **S6** | **Provenance Honesty** | Synthetic observations must never claim `LIVE` provenance. | `SafetyInvariantService.verifyS6_NoSimulatedAsLive` |
| **S7** | **Tamper-Evident Audit** | Cryptographic hash chain must verify 100% valid with zero broken links. | `SafetyInvariantService.verifyS7_NoAuditOverwrite` |
| **S8** | **Freshness Gate** | Replay tokens and approvals older than 300 seconds are rejected. | `SafetyInvariantService.verifyS8_NoStaleTokens` |
