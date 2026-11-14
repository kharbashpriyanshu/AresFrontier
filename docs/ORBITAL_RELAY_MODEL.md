# Orbital Relay & Pass Window Mechanics

## 1. Orbiter Specifications & Orbital Mechanics

The platform incorporates realistic orbital mechanics modeled after the **Mars Reconnaissance Orbiter (MRO)**:

- **Orbiter Name**: Mars Reconnaissance Relay Orbiter (`ORBITER-01`)
- **Orbit Class**: Sun-synchronous circular polar orbit
- **Altitude**: $320\text{ km}$ above the Martian areoid
- **Inclination**: $92.8^\circ$
- **Orbital Period**: $112\text{ minutes}$ ($1.867\text{ hours}$)
- **Orbital Ground Speed**: $12,400\text{ km/h}$ ($3.44\text{ km/s}$)
- **Coverage Radius**: $850\text{ km}$ footprint
- **Communication Payload**: Electra UHF Transceiver ($2048\text{ kbps}$ peak uplink)

---

## 2. Deterministic Communication Windows

Because orbital passes recur on a precise 112-minute cycle, the `CommunicationCoverageEngine` projects surface visibility windows:
- **Pass Window Duration**: $14\text{ to }16\text{ minutes}$ per overhead pass.
- **Surface Elevation Mask**: Communications open when orbiter elevation angle exceeds $15^\circ$ above the local horizon.
- **Relay Scheduling**: Field agents buffer non-critical high-resolution imagery and spectral cubes, transmitting in high-speed burst mode during active overhead windows.
- **Deep-Space Uplink**: During pass windows, `ORBITER-01` serves as the primary bridge to NASA Deep Space Network (DSN) Earth stations (Goldstone, Madrid, Canberra).
