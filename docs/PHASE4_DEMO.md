# Phase 4 Flagship Demo: Autonomous Scout Hazard Recon & Replanning

## 1. Demo Scenario Overview

The flagship demonstration showcases the full multi-agent collaborative teleoperations loop in Jezero Crater:

1. **Nominal Traverse**: `ROVER-01 SCOUT` is executing reconnaissance along the western delta flank toward science target `sci-queue-01` (Jezero Delta Front Sedimentary Scarp).
2. **Hazard Anomaly Encounter**: At MET 00:45:00, forward Hazcams and laser altimeter detect an unmapped 22.4° scarp with loose scree, exceeding the rover's 20.0° slope threshold.
3. **Autonomous Pause & Relay Uplink**: `ROVER-01 SCOUT` immediately halts, reports status via `ROVER-03 RELAY` elevated mast antenna.
4. **Automated Replanning Engine**: The system synthesizes alternative detour paths avoiding the slope scarp while preserving the mission's primary astrobiology objectives.
5. **Explainable Copilot Guidance**: The Operations Copilot explains why the valley detour is recommended (+0.35 km traverse, +4.2 min, +18 safety points, preserves ancient water objective).
6. **Mission Command Approval**: Flight Director reviews and authorizes the detour.
7. **Audit Chain Append**: An immutable SHA-256 block is signed and appended to the persistent ledger.
8. **Traverse Resumption**: `ROVER-01 SCOUT` receives uplinked route waypoints and resumes autonomous traverse.

---

## 2. Step-by-Step UI Walkthrough

1. Navigate to `http://localhost:5173/operations` in your web browser.
2. In the top command ribbon, click **"Execute Hazard Recon Flagship Demo"**.
3. Observe:
   - Simulation state advances and status badge changes to **DEMO ACTIVE**.
   - `ROVER-01 SCOUT` status transitions to `PAUSED`.
   - The Tactical Surface Map displays the high-slope hazard marker and detour corridor.
   - The Active Replanning Proposal card populates with quantitative trade-offs ($\Delta\text{ Distance}$, $\Delta\text{ Safety}$, $\Delta\text{ Duration}$).
   - The Operations Copilot panel provides real-time tactical directives.
4. Click **"Approve & Authorize Detour"** as Mission Commander.
5. The rover resumes execution and the cryptographic audit event counter increments!
