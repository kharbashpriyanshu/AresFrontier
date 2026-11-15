# SEEDED MONTE CARLO UNCERTAINTY ANALYSIS

## 1. Overview

Mars surface operations are subject to planetary environmental uncertainties: terrain slope roughness, wheel slippage in scree, solar panel dust accumulation, thermal swings, and communication atmospheric attenuation. Ares Frontier includes a seeded 100-run Monte Carlo engine to evaluate mission risk profiles probabilistically.

## 2. Seeded Random Number Generator

To satisfy strict scientific reproducibility, the engine implements a pseudo-random Linear Congruential Generator (LCG) combined with the Box-Muller transform for normal variates:

```typescript
function lcg(state: number) {
  return (state * 1664525 + 1013904223) % 4294967296;
}
```

Given the default seed `20261107`, every run of the 100-iteration Monte Carlo yields identical output across client and server environments.

## 3. Stochastic Parameters

Across each iteration, the engine perturbs:
1. **Slope & Wheel Slip**: $\mu = 1.05$, $\sigma = 0.08$ slip coefficient.
2. **Thermal & Battery Drain**: $\mu = 1.0$, $\sigma = 0.06$ power consumption multiplier.
3. **Orbital Comms Window**: Jitter in satellite acquisition of signal (AOS) $\pm 90$ seconds.
4. **Instrument Measurement Noise**: Optical sensor noise variance $\pm 1.2^\circ$.

## 4. Statistical Outputs

The engine aggregates 100 iterations into percentile distributions:
- **Battery Reserve**:
  - **P10 (Pessimistic)**: $71.2\%$
  - **P50 (Median)**: $78.4\%$
  - **P90 (Optimistic)**: $84.6\%$
- **Traverse Duration**:
  - **P10**: 38.4 minutes
  - **P50**: 42.1 minutes
  - **P90**: 47.8 minutes
- **Outage Probability**: Computed probability of communication blackout exceeding 15 minutes ($12.0\%$).
- **Success Probability**: Probability that all safety invariants S1–S8 remain unviolated across the entire traverse ($98.0\%$).

All outputs are explicitly labeled:
> `DATA MODE: BENCHMARK | MODEL: SIMULATED / MONTE CARLO (100 SEEDED RUNS)`
