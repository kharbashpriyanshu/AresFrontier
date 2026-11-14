# Phase 5 Model Validation & Truthful Physics Specifications

## 1. Topographic & Elevation Validation
The terrain engine relies on the Mars Orbiter Laser Altimeter (MOLA) MEGDR elevation grid calibrated against Jezero Crater benchmark coordinates:
- Octavia E. Butler Landing: `(18.4447°N, 77.4508°E)`, reference elevation -2530m.
- Kodiak Delta Remnant: `(18.4520°N, 77.4180°E)`, scarp slope 24.5°.
- Jezero Delta Front: `(18.4485°N, 77.4320°E)`.

Elevations are interpolated across a 4-point cross grid (~207m offset) to compute gradient slopes and surface roughness indices.

## 2. Sensor Noise & Uncertainty Models
All onboard sensors utilize deterministic pseudo-random Gaussian perturbations parameterized by `seedKey` derived from `agentId` and 4-decimal coordinate coordinates:
- **Laser Altimeter**: $\sigma = 0.15\text{ m}$ (nominal), $\sigma = 0.85\text{ m}$ (degraded). Bounded to $\pm 3\sigma$.
- **Stereo HazCam**: Optical slope extraction with Gaussian error $\sigma = 0.8^\circ$ (nominal), $\sigma = 2.5^\circ$ (degraded).
- **Raman Spectrometer**: Astrobiological signature detection; mineral identification confidence scored between 0.70 and 0.99.

## 3. Orbital Pass Mechanics
The Keplerian orbiter pass model simulates Mars Reconnaissance Orbiter (MRO) with an orbital period of $T = 112\text{ minutes}$:
- Pass Duration: $W = 20\text{ minutes}$ ($42\le t \pmod{112} \le 62$).
- Zenith Elevation Angle: Reaches up to $82^\circ$ during pass culmination.
- Uplink/Downlink Bandwidth:
  - Inside pass: $2048\text{ kbps}$ (X-Band direct-to-orbiter).
  - Outside pass: $0\text{ kbps}$ (Orbital blackout). Direct rover-to-relay line of sight provides local UHF backup at $128\text{ kbps}$.
