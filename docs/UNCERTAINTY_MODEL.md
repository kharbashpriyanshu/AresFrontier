# Martian Map — Observational Uncertainty & Decision Model

## 1. Topographic & Slope Uncertainty

Topographic measurements on Mars are inherently scale-dependent:
1. **Vertical Altimetry Uncertainty**:
   - Calibrated MOLA crossover points: $\pm 2.5\text{ m}$.
   - Regional spherical harmonic areoid model: $\pm 20.0\text{ m}$.
2. **Slope Gradient Uncertainty**:
   - Baseline slope evaluated over 128 px/deg (approx. 463 m per step): $\pm 1.0^\circ$ on flat crater plains, increasing to $\pm 3.5^\circ$ on canyon walls and delta fronts.
   - Microtopographic roughness below MOLA footprint scale (sub-100m) can contain perched boulders and scree scarps not resolved in global altimetry.

---

## 2. Risk-Adjusted Decision Model

Mission route evaluation does not simply rank candidates by raw expected science yield. Planetary exploration requires penalizing candidate paths that cross high-uncertainty or poorly observed terrain.

The **Risk-Adjusted Score** ($S_{\text{risk-adj}}$) is formulated as:

$$S_{\text{risk-adj}} = \mathbb{E}[V_{\text{mission}}] - \lambda_{\text{unc}} \cdot U_{\text{penalty}}$$

Where:
- $\mathbb{E}[V_{\text{mission}}]$ is the expected multi-attribute utility ($0\text{--}100$):
  $$\mathbb{E}[V] = w_1 S_{\text{safety}} + w_2 S_{\text{science}} + w_3 S_{\text{accessibility}} + w_4 S_{\text{efficiency}}$$
- $U_{\text{penalty}}$ is the compound observational and terrain uncertainty penalty:
  $$U_{\text{penalty}} = (1 - C_{\text{evidence}}) \cdot 30 + \text{HazardExposure} \cdot 15 + \text{SlopeUncertaintyFactor} \cdot 10$$
- $\lambda_{\text{unc}}$ is the astronaut risk-aversion coefficient ($\lambda_{\text{unc}} = 1.0$ for crewed EVA, adjustable to $0.4$ for expendable robotic traverses).

---

## 3. Pareto Frontier Non-Domination Analysis

A candidate route $\mathbf{x}$ dominates another candidate $\mathbf{y}$ ($\mathbf{x} \succ \mathbf{y}$) if and only if:
1. $\mathbf{x}$ is at least as good as $\mathbf{y}$ in all four objectives (Safety, Science, Accessibility, Efficiency).
2. $\mathbf{x}$ is strictly better than $\mathbf{y}$ in at least one objective.

The Pareto Frontier ($\mathcal{P}$) is the set of all non-dominated candidates:
$$\mathcal{P} = \{ \mathbf{x} \in \mathcal{C} \mid \nexists \mathbf{y} \in \mathcal{C} \text{ s.t. } \mathbf{y} \succ \mathbf{x} \}$$

Routes on the Pareto frontier represent optimal trade-offs where science yield cannot be increased without sacrificing astronaut safety or traversal margin.
