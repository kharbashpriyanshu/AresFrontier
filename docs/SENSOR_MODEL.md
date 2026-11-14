# Sensor Model Specification — Planetary Onboard Instrumentation

## 1. Sensor Device Registry
The multi-agent platform equips each rover and human astronaut with a physically realistic sensor payload:

| Agent | Sensor Type | Output Parameter | Nominal Uncertainty | Provenance |
| :--- | :--- | :--- | :--- | :--- |
| `ROVER-01 SCOUT` | `LASER_ALTIMETER` | `ELEVATION` (m) | $\pm 0.15\text{ m}$ | `MOLA Ground Calibration` |
| `ROVER-01 SCOUT` | `HAZCAM` | `SLOPE_GRADIENT` (deg) | $\pm 0.8^\circ$ | `Stereo Point Cloud` |
| `ROVER-02 SCIENCE` | `RAMAN_SPECTROMETER`| `MINERAL_SIGNATURE` | 95% Confidence | `Astrobiology Spectral Library` |
| `ROVER-02 SCIENCE` | `THERMAL_IR` | `SURFACE_TEMP` (°C) | $\pm 1.2^\circ\text{C}$ | `Calibrated Radiometer` |
| `ROVER-03 RELAY` | `COMM_RF_SENSOR` | `CARRIER_SNR` (dB) | $\pm 0.5\text{ dB}$ | `UHF/X-Band Antenna Array` |
| `ASTRONAUT-01` | `NAVCAM` / `BIOMED` | `HEART_RATE`, `O2` | $\pm 1\text{ bpm}$ | `xEMU Telemetry Stream` |

## 2. Sensor-Hazard Fusion
Heterogeneous sensor streams are fused via inverse-variance weighting:
$$\bar{\theta} = \frac{\sum_{i} \theta_i \cdot w_i}{\sum_{i} w_i}, \quad w_i = \frac{1}{\sigma_i^2}$$
$$\sigma_{\text{fused}} = \sqrt{\frac{1}{\sum_i w_i}}$$

Hazards are classified into three levels of corroboration:
1. `TERRAIN_PREDICTED`: Topographic baseline only; no sensor corroboration.
2. `SENSOR_DERIVED`: Single sensor detects gradient above rover limit; replanning recommended.
3. `CORROBORATED_CONFIRMED`: Dual independent sensors (HazCam + Laser Altimeter) confirm slope violation; immediate autonomous pause and replan proposal required.
