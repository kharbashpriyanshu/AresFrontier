# DATA PROVENANCE & TRUTHFULNESS REGISTRY

## 1. Overview

In scientific planetary exploration, data pedigree is paramount. Ares Frontier embeds a Data Provenance Registry that exposes full acquisition metadata, processing pipelines, uncertainty bounds, and truthfulness levels for every dataset utilized by the platform.

## 2. Truthfulness Levels & Evidence Categorization

The platform distinguishes four clear tiers of observation evidence:

1. **`MODEL_EVIDENCE`**: Theoretical or simulation predictions derived from physics models, orbital mechanics (Keplerian approximations), or thermal loss models.
2. **`SENSOR_EVIDENCE`**: Direct measurements from a single onboard instrument (e.g., Rover NavCam, MastCam, or UHF RSSI).
3. **`INDEPENDENT_SENSOR_EVIDENCE`**: Direct measurements from an independent instrument (e.g., Laser Altimeter or Descent IMU).
4. **`CORROBORATED_CONFIRMED`**: Measurements confirmed by two or more independent sensor modalities with overlapping footprints.

## 3. Real Planetary Datasets & Abstractions

| Dataset Name | Mission / Instrument | Processing Pipeline | Resolution / Precision | Data Mode |
|---|---|---|---|---|
| **MOLA MEGDR** | Mars Global Surveyor (MGS) | Gridded elevation products | 128 pixels/degree (~463 m/px) | `BENCHMARK` |
| **HiRISE DTM** | Mars Reconnaissance Orbiter (MRO) | Photogrammetric stereo disparity | 1.0 meter/pixel | `BENCHMARK` |
| **CRISM Mineralogy** | Mars Reconnaissance Orbiter (MRO) | Targeted hyperspectral mapping | 18–36 meters/pixel | `BENCHMARK` |
| **Mars 2020 Telemetry** | Perseverance Rover / Jezero | Calibration & benchmark replay | Metric coordinates | `SIMULATED / BENCHMARK` |
| **Monte Carlo Distributions** | Seeded LCG Engine (Seed 20261107) | 100-run stochastic simulation | Percentile distributions | `SIMULATED / MONTE CARLO`|

## 4. Transparent Provenance Inspector

Every metric or observation in the UI links to the Provenance Inspector, displaying:
- **Source Agency**: NASA / USGS / JPL.
- **Instrument PDS Label**: e.g., `MGS-M-MOLA-5-MEGDR-L3-V1.0`.
- **Datum Reference**: Areoid 3396.2 km radius sphere.
- **Acquisition Timestamp**: Mission Epoch / UTC.
- **Uncertainty Interval**: Explicit $95\%$ confidence bounds ($\pm \sigma$).
- **Verification Hash**: SHA-256 integrity digest.
