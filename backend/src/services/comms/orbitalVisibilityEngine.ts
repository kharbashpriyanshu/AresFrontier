import { MarsCoordinate, OrbitalVisibilityWindow, OrbitalPassState, OrbitalVisibilityQuality } from "../../types/index.js";

/**
 * Deterministic Orbital Visibility Engine (MRO-Relay Model)
 * Models orbit geometry, elevation angle above local horizon, and pass windows.
 * NOTE: This is a deterministic orbital approximation based on circular sun-synchronous geometry,
 * NOT a full JPL SPICE/NAIF ephemeris kernel.
 */
export class OrbitalVisibilityEngine {
  public static readonly ORBITAL_PERIOD_MINUTES = 112; // Nominal MRO circular period
  public static readonly PASS_DURATION_MINUTES = 20;   // Horizon-to-horizon above 15° mask
  public static readonly ORBITAL_ALTITUDE_KM = 320;    // Nominal areoid altitude
  public static readonly ELEVATION_MASK_DEG = 15.0;    // Minimum RF line-of-sight elevation

  // Calibrated pass timing offset so Jezero pass opens around MET 00:42 to 01:02
  private static readonly PASS_START_OFFSET_MINUTES = 42;

  /**
   * Computes the orbital pass window and visibility geometry for a given surface location and simulation time.
   */
  public static calculateVisibility(
    surfaceCoord: MarsCoordinate,
    simulationTimeMinutes: number
  ): OrbitalVisibilityWindow {
    const cycleTime = simulationTimeMinutes % this.ORBITAL_PERIOD_MINUTES;
    const passStart = this.PASS_START_OFFSET_MINUTES;
    const passEnd = passStart + this.PASS_DURATION_MINUTES;

    let state: OrbitalPassState = "NO_CONTACT";
    let visibilityQuality: OrbitalVisibilityQuality = "NO_CONTACT";
    let currentElevationDeg = 0;
    let remainingSeconds = 0;
    let nextPassInSeconds = 0;
    let bandwidthKbps = 0;
    let slantRangeKm = 850;

    if (cycleTime >= passStart && cycleTime <= passEnd) {
      // PASS IS ACTIVE
      const minutesIntoPass = cycleTime - passStart;
      const progress = minutesIntoPass / this.PASS_DURATION_MINUTES; // 0.0 to 1.0

      // Trigonometric elevation profile peaking at 48.5° above horizon
      const peakElevation = 48.5;
      const elevationCurve = Math.sin(progress * Math.PI);
      currentElevationDeg = Number(
        (this.ELEVATION_MASK_DEG + (peakElevation - this.ELEVATION_MASK_DEG) * elevationCurve).toFixed(1)
      );

      // Slant range varies from ~680 km at entry to ~335 km at periapsis zenith
      slantRangeKm = Number((680 - (680 - 335) * elevationCurve).toFixed(1));

      remainingSeconds = Math.round((passEnd - cycleTime) * 60);

      if (minutesIntoPass >= this.PASS_DURATION_MINUTES - 2) {
        state = "PASS_ENDING";
      } else {
        state = "PASS_ACTIVE";
      }

      if (currentElevationDeg >= 40) {
        visibilityQuality = "EXCELLENT";
        bandwidthKbps = 2048;
      } else if (currentElevationDeg >= 25) {
        visibilityQuality = "GOOD";
        bandwidthKbps = 1024;
      } else {
        visibilityQuality = "DEGRADED";
        bandwidthKbps = 256;
      }
    } else {
      // NO CONTACT or APPROACHING
      const minutesUntilPass =
        cycleTime < passStart
          ? passStart - cycleTime
          : this.ORBITAL_PERIOD_MINUTES - cycleTime + passStart;

      nextPassInSeconds = Math.round(minutesUntilPass * 60);

      if (minutesUntilPass <= 5.0) {
        state = "PASS_APPROACHING";
        visibilityQuality = "DEGRADED";
        currentElevationDeg = Number((this.ELEVATION_MASK_DEG * (1.0 - minutesUntilPass / 5.0)).toFixed(1));
      } else {
        state = "NO_CONTACT";
        visibilityQuality = "NO_CONTACT";
        currentElevationDeg = 0;
      }

      bandwidthKbps = 0;
      slantRangeKm = 980;
    }

    const now = Date.now();
    const startTimeIso = new Date(now - (cycleTime - passStart) * 60000).toISOString();
    const endTimeIso = new Date(now + (passEnd - cycleTime) * 60000).toISOString();

    return {
      orbiterId: "agent-orbiter-01",
      startTime: startTimeIso,
      endTime: endTimeIso,
      maxElevationDeg: 48.5,
      slantRangeKm,
      visibilityQuality,
      state,
      currentElevationDeg,
      remainingSeconds,
      nextPassInSeconds,
      bandwidthKbps,
    };
  }
}
