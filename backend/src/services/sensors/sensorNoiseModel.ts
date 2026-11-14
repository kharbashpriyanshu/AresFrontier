/**
 * Deterministic Sensor Noise & Uncertainty Simulation Model
 * Implements bounded pseudorandom perturbation based on a fixed seed and coordinate hashing.
 * NOTE: This is a SIMULATION MODEL for mission testing, NOT physical spacecraft telemetry.
 */
export class SensorNoiseModel {
  /**
   * Deterministic hash producing float in range [0, 1) based on a key and seed.
   */
  public static hashFloat(seedStr: string, salt: number = 0): number {
    let hash = 2166136261 + salt;
    for (let i = 0; i < seedStr.length; i++) {
      hash ^= seedStr.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return ((hash >>> 0) % 1000000) / 1000000;
  }

  /**
   * Simulates Laser Altimeter elevation reading with distance-dependent noise.
   */
  public static simulateLaserAltimeter(params: {
    trueElevationM: number;
    rangeM: number;
    quality: "GOOD" | "DEGRADED" | "INVALID";
    seedKey: string;
  }): { measuredElevationM: number; uncertaintyM: number } {
    if (params.quality === "INVALID") {
      return { measuredElevationM: NaN, uncertaintyM: 99.0 };
    }

    const degradation = params.quality === "DEGRADED" ? 2.5 : 1.0;
    const baseUncertainty = (0.08 + params.rangeM * 0.0015) * degradation;
    const noiseFactor = (this.hashFloat(params.seedKey, 101) - 0.5) * 2; // [-1, +1]
    const perturbation = noiseFactor * baseUncertainty;

    return {
      measuredElevationM: Number((params.trueElevationM + perturbation).toFixed(3)),
      uncertaintyM: Number(baseUncertainty.toFixed(3)),
    };
  }

  /**
   * Simulates HazCam obstacle and slope detection with illumination factor.
   */
  public static simulateHazCam(params: {
    trueSlopeDeg: number;
    rockDensity: number; // 0 to 1
    illuminationFactor: number; // 0 to 1
    quality: "GOOD" | "DEGRADED" | "INVALID";
    seedKey: string;
  }): { measuredSlopeDeg: number; slopeUncertaintyDeg: number; obstacleProbability: number; confidence: number } {
    if (params.quality === "INVALID") {
      return { measuredSlopeDeg: 0, slopeUncertaintyDeg: 45, obstacleProbability: 0, confidence: 0 };
    }

    const degradation = params.quality === "DEGRADED" ? 2.0 : 1.0;
    const illuminationPenalty = Math.max(0.2, params.illuminationFactor);
    const uncertaintyDeg = Number(((0.6 + params.rockDensity * 0.5) * degradation / illuminationPenalty).toFixed(2));

    const noiseFactor = (this.hashFloat(params.seedKey, 202) - 0.5) * 2;
    const measuredSlopeDeg = Number(Math.max(0, params.trueSlopeDeg + noiseFactor * uncertaintyDeg).toFixed(2));

    // Obstacle probability increases with steep slope and rock density
    const slopeRisk = Math.min(1.0, measuredSlopeDeg / 25.0);
    const obstacleProb = Number(Math.min(1.0, slopeRisk * 0.7 + params.rockDensity * 0.3).toFixed(3));
    const confidence = Number(Math.max(0.1, Math.min(0.99, 1.0 - uncertaintyDeg / 15.0)).toFixed(2));

    return {
      measuredSlopeDeg,
      slopeUncertaintyDeg: uncertaintyDeg,
      obstacleProbability: obstacleProb,
      confidence,
    };
  }

  /**
   * Simulates Thermal IR radiometer reading based on terrain class and solar heating.
   */
  public static simulateThermalIR(params: {
    terrainClass: string;
    solarExposure: number; // 0 to 1
    timeOfDayHours: number;
    seedKey: string;
  }): { surfaceTempK: number; thermalInertiaSI: number; uncertaintyK: number } {
    // Diurnal Mars surface temperature model (approx 170K to 270K at Jezero)
    const diurnalPhase = Math.sin(((params.timeOfDayHours - 8) / 24) * 2 * Math.PI);
    const baseTemp = 210 + diurnalPhase * 40 * params.solarExposure;
    const noise = (this.hashFloat(params.seedKey, 303) - 0.5) * 3.0;

    return {
      surfaceTempK: Number((baseTemp + noise).toFixed(1)),
      thermalInertiaSI: params.terrainClass.includes("bedrock") ? 420 : 210,
      uncertaintyK: 1.8,
    };
  }

  /**
   * Simulates Raman Spectrometer spectral feature matching for mineralogy.
   */
  public static simulateRaman(params: {
    mineralClass: string;
    dwellTimeSeconds: number;
    seedKey: string;
  }): { spectralConfidence: number; biosignatureProbability: number; detectedBands: string[] } {
    const snr = Math.min(1.0, params.dwellTimeSeconds / 60);
    const noise = (this.hashFloat(params.seedKey, 404) - 0.5) * 0.1;
    const spectralConfidence = Number(Math.min(0.98, Math.max(0.5, 0.85 * snr + noise)).toFixed(2));

    let detectedBands = ["Carbonate-512nm", "Phyllosilicate-1040nm"];
    if (params.mineralClass.toLowerCase().includes("olivine")) {
      detectedBands = ["Olivine-Peak-820nm", "Pyroxene-910nm"];
    }

    return {
      spectralConfidence,
      biosignatureProbability: 0.0, // Strictly NONE: synthetic Raman cannot claim biosignatures
      detectedBands,
    };
  }
}
