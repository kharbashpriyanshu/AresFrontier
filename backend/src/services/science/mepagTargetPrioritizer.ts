import { MarsCoordinate } from "../../types/index.js";
import { calculateMarsDistanceKm } from "../../utils/marsCoordinates.js";
import { crismProvider } from "../planetary/crismProvider.js";
import { geologyProvider } from "../planetary/geologyProvider.js";
import { subsurfaceIceProvider } from "../planetary/subsurfaceIceProvider.js";
import { microTerrainService } from "../terrain/microTerrainService.js";

export interface MepagPrioritizedTarget {
  id: string;
  name: string;
  coordinate: MarsCoordinate;
  distanceKm: number;
  mepagGoals: {
    goalILifeScore: number; // 0 - 100 (Astrobiology & Biosignatures)
    goalIIClimateScore: number; // 0 - 100 (Volatiles, Subsurface Ice, Paleoclimate)
    goalIIIGeologyScore: number; // 0 - 100 (Stratigraphy, Igneous Petrology)
    goalIVHumanExplorationScore: number; // 0 - 100 (ISRU Water, Trafficability)
  };
  compositeScienceScore: number; // 0 - 100
  accessibilityScore: number; // 0 - 100
  recommendedSamplingInstrument: string;
  primaryScienceMotivation: string;
  samplingPriorityRank: number;
}

/**
 * NASA MEPAG (Mars Exploration Program Analysis Group) Science Target Prioritizer (Item 27)
 * Evaluates in-situ sampling targets against NASA Goals I-IV, mineralogical potential,
 * and terrain accessibility.
 */
export class MepagTargetPrioritizer {
  private static readonly SAMPLE_CATALOG = [
    {
      id: "tgt-jezero-delta-clay",
      name: "Western Fan Delta Scarp Clay Unit (Shenandoah Formation)",
      coordinate: { latitude: 18.438, longitude: 77.418 },
      geology: "Lacustrine mudstone with interbedded deltaic foresets",
      instrument: "Abrasion Core Drill + Deep UV Raman Spectrometer (SHERLOC Analog)",
    },
    {
      id: "tgt-seitah-olivine-core",
      name: "South Séítah Cumulate Olivine Ridge",
      coordinate: { latitude: 18.449, longitude: 77.441 },
      geology: "Noachian magmatic cumulate basement with carbonate veins",
      instrument: "Planetary Core Drill + X-Ray Lithochemistry (PIXL Analog)",
    },
    {
      id: "tgt-kodiak-delta-butte",
      name: "Kodiak Butte Gilbert Delta Remnant Outcrop",
      coordinate: { latitude: 18.435, longitude: 77.422 },
      geology: "Gilbert-type dipping foreset sandstone and bottomset strata",
      instrument: "Multispectral Mastcam-Z Stereo Array + Chisel Float Collection",
    },
    {
      id: "tgt-maaz-crater-floor",
      name: "Octavia Butler Máaz Floor Basalt",
      coordinate: { latitude: 18.4447, longitude: 77.4508 },
      geology: "Planar vesicular basalt flow capping crater floor",
      instrument: "Core Drill + Magnetic Susceptibility Sensor",
    },
    {
      id: "tgt-neretva-breach",
      name: "Neretva Vallis Fluvial Inflow Breach Channel",
      coordinate: { latitude: 18.495, longitude: 77.385 },
      geology: "Catastrophic megaflood boulder conglomerate and mudflow deposit",
      instrument: "Geological Hammer + Regolith Core Corer",
    },
  ];

  /**
   * Prioritizes science targets relative to current astronaut location and mission focus
   */
  public async prioritizeTargets(
    astronautCoord: MarsCoordinate,
    primaryMepagFocus: "GOAL_I_LIFE" | "GOAL_II_CLIMATE" | "GOAL_III_GEOLOGY" | "GOAL_IV_HUMAN" = "GOAL_I_LIFE"
  ): Promise<MepagPrioritizedTarget[]> {
    const scored: MepagPrioritizedTarget[] = [];

    for (const tgt of MepagTargetPrioritizer.SAMPLE_CATALOG) {
      const distKm = calculateMarsDistanceKm(astronautCoord, tgt.coordinate);
      const mineral = crismProvider.evaluateMineralogy(tgt.coordinate);
      const geo = geologyProvider.getFormationAtCoordinate(tgt.coordinate);
      const sub = subsurfaceIceProvider.evaluateSubsurface(tgt.coordinate);
      const terrain = await microTerrainService.evaluateMicroTerrain(tgt.coordinate, 8.0);

      // 1. Goal I: Life (Highest in smectite clays, hydrated silica, carbonates)
      let goal1 = 30;
      if (mineral.biosignaturePotential === "EXTREME") goal1 = 98;
      else if (mineral.biosignaturePotential === "HIGH") goal1 = 85;
      else if (mineral.dominantMineralClass === "Phyllosilicate") goal1 = 92;

      // 2. Goal II: Climate (Subsurface ice, carbonates recording atmospheric CO2)
      let goal2 = 25;
      if (sub.iceDetected) goal2 = 95;
      else if (mineral.summary.includes("Carbonate")) goal2 = 88;
      else if (tgt.id.includes("delta")) goal2 = 78;

      // 3. Goal III: Geology (Igneous basement, stratigraphy, impactites)
      let goal3 = 60;
      if (geo.unit.stratigraphicOrder === 1) goal3 = 96; // Oldest Noachian basement
      else if (geo.unit.code === "Hdf" || geo.unit.code === "Hdt") goal3 = 90;

      // 4. Goal IV: Human Exploration (ISRU water, flat pavement accessibility)
      let goal4 = 50;
      if (sub.isruWaterExtractionPotential === "EXCELLENT") goal4 = 98;
      else if (geo.unit.traverseObstacleScore < 30) goal4 = 85;

      // Accessibility Score: penalize distance and boulder/scarp obstacles
      let accessibility = 100 - distKm * 12.0 - (100 - terrain.golombekRockDistribution.traversabilityIndex) * 0.4;
      accessibility = Math.max(15, Math.min(98, Math.round(accessibility)));

      // Composite Science Score weighted by chosen focus
      let composite = 0;
      if (primaryMepagFocus === "GOAL_I_LIFE") {
        composite = goal1 * 0.50 + goal3 * 0.25 + goal2 * 0.15 + goal4 * 0.10;
      } else if (primaryMepagFocus === "GOAL_IV_HUMAN") {
        composite = goal4 * 0.50 + goal1 * 0.20 + goal3 * 0.20 + goal2 * 0.10;
      } else {
        composite = goal3 * 0.40 + goal1 * 0.30 + goal2 * 0.15 + goal4 * 0.15;
      }

      scored.push({
        id: tgt.id,
        name: tgt.name,
        coordinate: tgt.coordinate,
        distanceKm: Number(distKm.toFixed(2)),
        mepagGoals: {
          goalILifeScore: Math.round(goal1),
          goalIIClimateScore: Math.round(goal2),
          goalIIIGeologyScore: Math.round(goal3),
          goalIVHumanExplorationScore: Math.round(goal4),
        },
        compositeScienceScore: Math.round(composite),
        accessibilityScore: accessibility,
        recommendedSamplingInstrument: tgt.instrument,
        primaryScienceMotivation: `${tgt.geology}. ${mineral.summary}`,
        samplingPriorityRank: 0,
      });
    }

    // Rank targets by composite score penalized by distance
    scored.sort((a, b) => (b.compositeScienceScore + b.accessibilityScore * 0.3) - (a.compositeScienceScore + a.accessibilityScore * 0.3));
    scored.forEach((t, i) => {
      t.samplingPriorityRank = i + 1;
    });

    return scored;
  }
}

export const mepagTargetPrioritizer = new MepagTargetPrioritizer();
