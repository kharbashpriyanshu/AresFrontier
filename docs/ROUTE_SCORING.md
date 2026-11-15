# Ares Frontier Project Decision Model — Route Scoring & Pareto Optimization

**Status:** Ares Frontier Project Model (Not an official NASA-approved standard)  
**Version:** 3.0.0  
**Context:** NASA Space Apps Challenge — Planetary Mission Decision Support  

---

## 1. Overview & Decision Philosophy

Planetary EVA traverse planning cannot be solved via naive single-metric optimization (such as minimizing distance or blindly maximizing rock sample count). A traverse that visits 4 high-priority outcrops is operationally unacceptable if it forces the crew along a loose $22^\circ$ delta scarp talus or reduces life-support oxygen reserves below flight-rule margins.

The **Ares Frontier Project Decision Model** applies:
1. **Multi-Attribute Utility Decomposition**: Evaluates safety, scientific return, efficiency, terrain accessibility, and data evidence independently.
2. **Pareto Frontier Analysis**: Identifies non-dominated candidate routes where one attribute cannot be improved without degrading another.
3. **Uncertainty-Adjusted Valuation**: Penalizes routes that cross poorly characterized or high-variance terrain corridors.

---

## 2. Multi-Attribute Component Formulations

All component scores are normalized to the closed interval $[0, 100]$.

### 2.1 Safety Score ($S_{\text{safe}}$)
Quantifies terrain stability and scarp hazard standoff:

$$S_{\text{safe}} = \max\left(5, 100 - H_{\text{score}} - P_{\text{slope}}\right)$$

Where:
- $H_{\text{score}} \in [0, 70]$: Aggregated hazard penalty based on spatial proximity to documented scarps and chokepoints.
- $P_{\text{slope}}$: Slope penalty:
  $$P_{\text{slope}} = 2.5 \cdot \max(0, \theta_{\max} - 10) + 1.5 \cdot \theta_{\text{avg}}$$
  ($\theta_{\max}$ = maximum segment slope in degrees; $\theta_{\text{avg}}$ = mean traverse slope).

### 2.2 Science Yield Score ($S_{\text{sci}}$)
Factorized score computed from the **Factorized Science Engine**:

$$S_{\text{sci}} = R_{\text{obj}} + E_{\text{geo}} + U_{\text{tgt}} + Q_{\text{data}} + D_{\text{sample}}$$

Where:
- $R_{\text{obj}} \in [0, 30]$: Relevance to active MEPAG science objective.
- $E_{\text{geo}} \in [0, 25]$: Verified geological lithology and formation context.
- $U_{\text{tgt}} \in [0, 20]$: Planetary target rarity / uniqueness.
- $Q_{\text{data}} \in [0, 15]$: Data source quality (rover in-situ vs orbital CTX).
- $D_{\text{sample}} \in [0, 10]$: Diversity of potential geochemical samples.

### 2.3 Traversal Accessibility Score ($S_{\text{acc}}$)
Quantifies surface roughness and suit mobility:

$$S_{\text{acc}} = \max\left(10, 100 - 40 \cdot \rho - 20 \cdot \frac{\Delta h_{\text{gain}} + \Delta h_{\text{loss}}}{200}\right)$$

Where $\rho \in [0, 1]$ is the elevation standard deviation roughness index.

### 2.4 Operational Efficiency Score ($S_{\text{eff}}$)
Measures distance and duration parsimony:

$$S_{\text{eff}} = \max\left(10, 100 - 15 \cdot d_{\text{km}} - 25 \cdot \frac{T_{\text{dur}}}{T_{\max}}\right)$$

### 2.5 Evidence Confidence Score ($S_{\text{conf}}$)
Derived from multi-instrument data coverage:

$$S_{\text{conf}} = 25 \cdot (\text{Elev}_{\text{rank}} + \text{HiRISE}_{\text{rank}} + \text{THEMIS}_{\text{rank}} + \text{Rover}_{\text{rank}}) / 3$$

---

## 3. Risk-Adjusted Scoring (Uncertainty Penalty)

A route traversing uncharacterized Martian terrain incurs an operational risk penalty:

$$\text{Score}_{\text{adjusted}} = \max\left(5, \text{Score}_{\text{nominal}} - P_{\text{unc}}\right)$$

Where the uncertainty penalty $P_{\text{unc}}$ is:

$$P_{\text{unc}} = w_{\text{unc}} \cdot \left(\frac{\sigma_{\text{elev}}}{20\text{ m}} \cdot 15 + (1 - C_{\text{coverage}}) \cdot 20\right)$$

- $\sigma_{\text{elev}}$: Altimetry vertical uncertainty ($\pm 2.5\text{ m}$ for benchmark sites, $\pm 20\text{ m}$ for fallback models).
- $C_{\text{coverage}} \in [0, 1]$: Regional observational evidence index.

---

## 4. Pareto Frontier Non-Domination Analysis

A route candidate $A$ **dominates** candidate $B$ ($A \succ B$) if and only if:
1. $A$ is strictly better than $B$ in at least one metric:
   $$\exists m \in \{\text{Science}, \text{Safety}, \text{Efficiency}\}: M_m(A) > M_m(B)$$
2. $A$ is no worse than $B$ in all other metrics:
   $$\forall k: M_k(A) \ge M_k(B)$$

The **Pareto Frontier** is the set of all non-dominated candidates:

$$\mathcal{P} = \{ C \in \mathcal{C} \mid \nexists C' \in \mathcal{C}: C' \succ C \}$$

When presenting mission alternatives, the system explicitly highlights all candidates on the Pareto frontier and describes the trade-off.
