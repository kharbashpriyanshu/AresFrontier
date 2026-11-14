# Phase 5 Live Demonstration Guide

## 1. Launching the Demo
1. Start backend server:
   ```bash
   cd backend && npm run dev
   ```
2. Start frontend development server:
   ```bash
   cd frontend && npm run dev
   ```
3. Open browser at `http://localhost:5173/operations`.

## 2. Interactive Operator Walkthrough
1. **Explore the Tactical Provenance Strip**:
   - Inspect the live badges: `BENCHMARK`, `SIMULATED`, `MOLA MEGDR`, `112m KEPLERIAN`, `RBAC SERVER ENFORCED`.
2. **Review Real-Time Orbital Relay Pass**:
   - Observe the MRO pass status, current elevation angle, distance, and real-time bandwidth (2048 kbps vs 0 kbps blackout).
3. **Trigger Scenario `COMM-BLACKOUT-001`**:
   - Click **Run Blackout** in the scenario strip.
   - Watch the packet queue buffer bulk science data while critical alert packets are prioritized.
4. **Trigger Scenario `SECURITY-001`**:
   - Click **Trigger Intrusion** to simulate an unauthorized command replay.
   - Notice the immediate HTTP 403 response and the new tamper-evident block in the Audit Chain.
5. **Inspect Sensor Observations**:
   - Review live HazCam, Laser Altimeter, and Raman spectrometry readings with explicit physical uncertainty bounds.
6. **Query the Operations Copilot**:
   - Observe structured reasoning cleanly partitioned into `[OBSERVED FACT]`, `[DERIVED INSIGHT]`, `[SIMULATED CONTEXT]`, and `[DIRECTIVES]`.
