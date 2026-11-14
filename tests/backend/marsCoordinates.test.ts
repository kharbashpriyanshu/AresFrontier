import { describe, it, expect } from "vitest";
import {
  calculateMarsDistanceKm,
  normalizeLongitude,
  validateMarsCoordinate,
  calculateSlopeDegrees,
  isCoordinateInBounds,
  MARS_RADIUS_KM,
} from "../../backend/src/utils/marsCoordinates.js";

describe("Mars Coordinates Math & Utilities", () => {
  it("validates Mars coordinates strictly", () => {
    expect(validateMarsCoordinate({ latitude: 18.44, longitude: 77.45 }).valid).toBe(true);
    expect(validateMarsCoordinate({ latitude: -95, longitude: 10 }).valid).toBe(false);
    expect(validateMarsCoordinate({ latitude: 10, longitude: 500 }).valid).toBe(false);
    expect(validateMarsCoordinate("invalid" as unknown).valid).toBe(false);
  });

  it("normalizes planetary longitude correctly into [-180, 180]", () => {
    expect(normalizeLongitude(0)).toBe(0);
    expect(normalizeLongitude(270)).toBe(-90);
    expect(normalizeLongitude(360)).toBe(0);
    expect(normalizeLongitude(-190)).toBe(170);
  });

  it("calculates great-circle distance on Mars accurately", () => {
    // Two points on equator separated by 1 degree longitude:
    // circumference on Mars = 2 * PI * 3389.5 ~ 21296.8 km
    // 1 degree = 21296.8 / 360 ~ 59.15 km
    const p1 = { latitude: 0, longitude: 0 };
    const p2 = { latitude: 0, longitude: 1 };
    const dist = calculateMarsDistanceKm(p1, p2);
    expect(dist).toBeGreaterThan(58.5);
    expect(dist).toBeLessThan(59.5);
  });

  it("computes slope degrees given horizontal distance and elevation change", () => {
    // 1000m horizontal, 100m rise -> tan(theta) = 0.1 -> theta ~ 5.71 degrees
    const slope = calculateSlopeDegrees(1.0, 100);
    expect(slope).toBeCloseTo(5.71, 1);
  });

  it("identifies bounding box containment properly", () => {
    const bounds = { north: 20, south: 10, east: 80, west: 70 };
    expect(isCoordinateInBounds({ latitude: 15, longitude: 75 }, bounds)).toBe(true);
    expect(isCoordinateInBounds({ latitude: 25, longitude: 75 }, bounds)).toBe(false);
  });
});
