# MISSION KPI ANALYTICS & HEALTH BREAKDOWN

## 1. Overview

The Martian Map Analytics Engine (`/mission-analytics`) delivers continuous evaluation of surface operations across four pillars: Operations, Communications, Science Return, and Safety Invariants.

## 2. Transparent Health Score Breakdown

The mission health score is not an opaque percentage. It is computed as a weighted sum of seven verifiable components:

$$\text{Health Score} = \sum_{i=1}^{7} w_i \cdot C_i$$

| Component | Weight ($w_i$) | Nominal Score | Evaluation Criteria |
|---|---|---|---|
| **Safety Invariants ($C_1$)** | 25% | 98/100 | Zero active violations of S1–S8 invariants. |
| **Battery Margin ($C_2$)** | 20% | 88/100 | Distance to safe return reserve threshold (20%). |
| **Comms Reliability ($C_3$)** | 15% | 82/100 | Packet delivery ratio and blackout duration. |
| **Sensor Confidence ($C_4$)** | 10% | 91/100 | Dual-sensor corroboration index and calibration stability. |
| **Route Feasibility ($C_5$)** | 10% | 94/100 | Adherence to slope, roughness, and keep-out zones. |
| **Science Return ($C_6$)** | 10% | 85/100 | Percentage of high-priority MEPAG targets surveyed. |
| **Mission Progress ($C_7$)** | 10% | 76/100 | Actual vs scheduled waypoint arrival times. |

**Composite Mission Score (Flagship MARSWALK-001)**: **89 / 100 (OPTIMAL)**.

## 3. Automated S1–S8 Safety Invariant Suite

| Invariant | Category | Rule & Limit | Enforcement |
|---|---|---|---|
| **S1** | Power | Battery state-of-charge $\ge 20.0\%$ safe return reserve | Automatic vehicle halt & heater preservation |
| **S2** | Mobility | Vehicle slope $\le 20.0^\circ$ to prevent rollover | Traverse stop & closed-loop replan |
| **S3** | Life Support | Crew EVA consumable reserve $\ge 30.0$ minutes | Compulsory RTB (Return to Base) call |
| **S4** | Telecom | Communication blackout $\le 45.0$ minutes without mesh | Surface relay activation & packet buffering |
| **S5** | Teleops | Speed $\le 0.15$ m/s when comm latency $\ge 300$ seconds | Autonomous speed throttle |
| **S6** | Safety | Astronaut proximity $\le 100.0$ meters during dual-EVA | Companion beacon tether hold |
| **S7** | Geotechnical| Soil sinkage $\le 30.0\%$ in loose regolith | Traction control & detour routing |
| **S8** | Cyber | Command TTL $\le 300000$ ms; unique nonce required | Duplicate & stale command rejection |
