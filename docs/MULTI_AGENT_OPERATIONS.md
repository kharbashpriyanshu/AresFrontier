# Multi-Agent Planetary Field Operations & Collaborative Teleoperations

## 1. Operational Roster & Agent Profiles

| Callsign | Type | Profile | Max Range | Speed | Hazard Tolerance | Key Payloads / Instruments |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **ASTRONAUT-01** | ASTRONAUT | Lead Field Explorer | 12 km | 2.8 km/h | 18.0° | xEMU Suit Life Support, Portable Field Spectrometer |
| **ROVER-01 SCOUT** | ROVER | Fast Reconnaissance | 25 km | 4.2 km/h | 20.0° | High-Resolution Laser Profiler, Hazcam Array |
| **ROVER-02 SCIENCE** | ROVER | In-Situ Astrobiology | 15 km | 2.4 km/h | 14.0° | Deep UV Raman Spectrometer, Abrasion Core Drill |
| **ROVER-03 RELAY** | ROVER | Tactical Comms Relay | 18 km | 3.2 km/h | 15.0° | UHF Electra Relay Mast (12 km range), Beacon |
| **ORBITER-01** | ORBITER | Mars Reconnaissance | 850 km cov. | 12,400 km/h | N/A | Electra UHF Transceiver (2048 kbps), HiRISE Camera |

---

## 2. Shared Resource Allocation & Conflict Resolution

In collaborative surface missions, multiple agents require access to shared resources such as traverse corridors, radio relay frequencies, drill sites, and recharge bays.

### Deterministic Priority Arbitration Rules:
1. **Crew Safety Precedence**: Human astronauts (`ASTRONAUT-01`) possess absolute operational priority over robotic agents for life-support corridors and safe egress paths.
2. **Priority Score Tie-Breaking**: For robotic-to-robotic contention, agents with higher task priority ratings win allocation.
3. **Cryptographic Audit**: All resource contention events generate an immutable audit block documenting requester, winner, loser, and rationale.

```typescript
// Conflict Resolution Matrix
if (requesterIsAstronaut && !existingIsAstronaut) {
  // Preempt autonomous rover for astronaut life safety
  winner = astronaut;
} else if (existingIsAstronaut && !requesterIsAstronaut) {
  // Astronaut retains corridor ownership
  winner = astronaut;
} else if (agentPriority > existing.priority) {
  winner = requestingAgent;
}
```

---

## 3. Collaborative Science Target Queue

Science operations in Jezero Crater follow a coordinated collection workflow:
- **`QUEUED`**: Target identified from orbital MRO/HiRISE imagery and MOLA altimetry.
- **`ASSIGNED`**: Target routed to best-fit agent based on instrument capability (e.g. Raman Spectrometer to `ROVER-02 SCIENCE`).
- **`EN_ROUTE`**: Rover autonomously traverses toward target coordinates with line-of-sight telemetry streaming.
- **`OBSERVING`**: Precision raster scan, spectroscopic sampling, or abrasion drilling.
- **`COMPLETED`**: Sample sealed in hermetic container (`SAMPLE-CONTAINER-JZ-xxxx`) and logged in persistent mission registry.
