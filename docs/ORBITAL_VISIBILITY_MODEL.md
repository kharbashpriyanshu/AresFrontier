# Orbital Visibility Model — Mars Reconnaissance Relay Dynamics

## 1. Physical Orbital Geometry
The communication engine models orbital relay passes using an analytical 112-minute Keplerian circular orbit representing Mars Reconnaissance Orbiter (MRO) in sun-synchronous orbit over Jezero Crater (`18.4447°N, 77.4508°E`).

### 1.1 Mathematical Formulation
Let $t$ be the current mission elapsed time (MET) in minutes. The orbital cycle phase $\phi(t)$ is defined as:
$$\phi(t) = t \pmod{112}$$

A pass window opens at $\phi_{\text{start}} = 42\text{ min}$ and closes at $\phi_{\text{end}} = 62\text{ min}$, providing a 20-minute line-of-sight pass every 112 minutes.

During the pass ($\tau = \phi(t) - 42$):
$$\theta_{\text{elev}}(\tau) = 15^\circ + 67^\circ \cdot \sin\left(\frac{\pi \tau}{20}\right)$$
$$R_{\text{slant}}(\tau) = 320\text{ km} + 480\text{ km} \cdot \cos\left(\frac{\pi \tau}{20}\right)$$

### 1.2 State Transition Matrix
- `NO_CONTACT`: $\theta_{\text{elev}} < 15^\circ$, bandwidth = 0 kbps.
- `PASS_APPROACHING`: Within 10 minutes of pass initiation ($32 \le \phi < 42$).
- `PASS_ACTIVE`: Pass open ($42 \le \phi \le 62$), bandwidth = 2048 kbps.
- `PASS_ENDING`: Final 3 minutes of pass ($59 \le \phi \le 62$).
