# KNOWN SCIENTIFIC LIMITATIONS & MODEL BOUNDARIES

## 1. Overview & Transparency Mandate

Scientific integrity requires stating what a system cannot do as clearly as what it can do. Ares Frontier does not fabricate real-time connections to active rovers on Mars. Below are the documented boundaries of the current models and data abstractions.

---

## 2. Documented Model Boundaries

| Subsystem | Operational Implementation | Known Scientific Boundary |
|---|---|---|
| **Terrain Topography** | MGS MOLA MEGDR gridded digital elevation model (128 pixels/degree). | Regional resolution (~463 m/pixel). Sub-meter boulders, cracks, and decimeter sand ripples cannot be resolved by orbital MOLA data alone and require onboard stereo HazCam verification. |
| **Global Coordinate Reference** | IAU / IAG 2000 Mars Areoid oblate spheroid datum ($R_{\text{eq}} = 3396.19\text{ km}$, $R = 3389.5\text{ km}$). | Local gravitational anomalies and higher-order gravitational harmonics are omitted in surface great-circle distance equations. |
| **Orbital Mechanics** | Deterministic 112-minute circular Keplerian pass model with 14-minute pass windows. | Excludes J2 perturbation, atmospheric drag variations, orbital precession, and full SPICE kernel ephemeris integration. |
| **Sensor Observations** | Synthetic forward stereo HazCams and laser altimeters perturbed by seeded Box-Muller Gaussian noise ($\sigma = 1.2^\circ$). | Simulated sensor readings; does not receive live hardware downlinks from active NASA rovers currently on Mars. |
| **Mobility & Wheel Slip** | Adapted Tobler metabolic walking speed ($0.38g$) and heuristic regolith shear penalties above $15^\circ$. | Simplified terramechanics; does not simulate full 3D multibody dynamic terramechanics or Bekker soil shear equations. |
| **Telecom & RF Propagation** | Chord line-of-sight ray-tracing considering Mars planetary curvature and intervening MOLA relief. | Excludes atmospheric dust scattering (optical depth $\tau$), multipath diffraction, ionospheric scintillation, and antenna gain patterns. |
| **Battery & Power Consumption** | Constant power baseline with terrain slope penalty multipliers and Invariant S1 (20% reserve). | Does not model thermal battery cell degradation, temperature-dependent lithium-ion internal resistance, or dust accumulation on solar arrays over Martian years. |
| **Atmospheric Environment** | Standard Martian surface pressure ($600–900\text{ Pa}$) and gravity ($3.72\text{ m/s}^2$). | Excludes diurnal temperature swings ($-125^\circ\text{C}$ to $+20^\circ\text{C}$), seasonal $\text{CO}_2$ frost deposition, and local dust devils. |
| **Science Return Scoring** | Factorized scoring separating MEPAG objective relevance from sample diversity multipliers. | Heuristic scoring index based on scientific community consensus; not an automated substitute for peer-reviewed geological analysis. |
| **Command Replay Defense** | Persistent 300-second TTL bounds and nonce deduplication. | Enforces cyber integrity on simulation command envelopes; does not replace hardware-level NASA Consultative Committee for Space Data Systems (CCSDS) cryptographic uplink hardware. |

---

## 3. Frame as Engineering Strengths

These limitations represent conscious architectural boundaries designed for zero-friction evaluation, complete offline capability, and guaranteed reproducibility without requiring confidential government keys or multi-gigabyte orbital datasets.
