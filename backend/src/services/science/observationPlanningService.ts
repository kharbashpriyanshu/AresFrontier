import { MarsCoordinate } from "../../types/index.js";
import { crismProvider } from "../planetary/crismProvider.js";
import { geologyProvider } from "../planetary/geologyProvider.js";

export interface ScienceInstrumentStep {
  stepNumber: number;
  instrumentName: string;
  instrumentType: "IMAGING" | "GAS_BLAST" | "SURFACE_ABRASION" | "XRAY_LITHOCHEMISTRY" | "RAMAN_SPECTROMETRY" | "CORE_DRILL" | "HERMETIC_SEAL";
  durationMinutes: number;
  powerDrawWatts: number;
  objective: string;
  expectedOutput: string;
  dataVolumeMb: number;
}

export interface TargetObservationPlan {
  planId: string;
  targetId: string;
  targetName: string;
  coordinate: MarsCoordinate;
  geologicalFormation: string;
  dominantMineralogy: string;
  astrobiologySignificance: string;
  totalObservationDurationMinutes: number;
  totalPowerRequiredWh: number;
  assignedSampleTubeId: string;
  instrumentSteps: ScienceInstrumentStep[];
  hermeticSealVerificationProtocol: string;
}

/**
 * Scientific Observation Planning Service (Item 34)
 * Generates structured in-situ sampling protocols, instrument operational checklists,
 * and sample cache metadata for planetary science stops.
 */
export class ObservationPlanningService {
  public generateObservationPlan(
    targetId: string,
    targetName: string,
    coord: MarsCoordinate,
    tubeIndex = 1
  ): TargetObservationPlan {
    const min = crismProvider.evaluateMineralogy(coord);
    const geo = geologyProvider.getFormationAtCoordinate(coord);

    const steps: ScienceInstrumentStep[] = [
      {
        stepNumber: 1,
        instrumentName: "Navigation Camera (Navcam)",
        instrumentType: "IMAGING",
        durationMinutes: 4,
        powerDrawWatts: 35,
        objective: "Capture 360-degree high-contrast contextual stereo mosaic of the outcrop and surrounding regolith.",
        expectedOutput: "Calibrated 3D point cloud & hazard proximity check.",
        dataVolumeMb: 45.0,
      },
      {
        stepNumber: 2,
        instrumentName: "Multispectral Stereo Mast Camera (Mastcam-Z)",
        instrumentType: "IMAGING",
        durationMinutes: 8,
        powerDrawWatts: 55,
        objective: "Multispectral 11-filter imaging across visible and near-infrared bands (440 - 1020 nm).",
        expectedOutput: "Color composite and ferric/ferrous iron ratio maps.",
        dataVolumeMb: 120.0,
      },
      {
        stepNumber: 3,
        instrumentName: "Dust Removal Tool (DRT)",
        instrumentType: "GAS_BLAST",
        durationMinutes: 3,
        powerDrawWatts: 80,
        objective: "High-pressure gas puff and rotating wire brush to remove nanophase iron dust mantling.",
        expectedOutput: "Clean 50 mm diameter circular bedrock rock patch.",
        dataVolumeMb: 2.0,
      },
      {
        stepNumber: 4,
        instrumentName: "Rotary Rock Abrasion Bit",
        instrumentType: "SURFACE_ABRASION",
        durationMinutes: 12,
        powerDrawWatts: 240,
        objective: "Mill shallow 8 mm deep abrasion patch into unaltered subsurface rock matrix.",
        expectedOutput: "Fresh planar rock surface exposed for micro-spectroscopy.",
        dataVolumeMb: 5.0,
      },
      {
        stepNumber: 5,
        instrumentName: "Deep UV Raman & Fluorescence Spectrometer",
        instrumentType: "RAMAN_SPECTROMETRY",
        durationMinutes: 15,
        powerDrawWatts: 160,
        objective: "Scan 7x7 mm abrasion grid for aromatic organic carbon rings and bio-relevant amino/carboxylic bonds.",
        expectedOutput: "248.6 nm deep UV Raman spectra and organic molecule detection flags.",
        dataVolumeMb: 85.0,
      },
      {
        stepNumber: 6,
        instrumentName: "Planetary Instrument for X-Ray Lithochemistry",
        instrumentType: "XRAY_LITHOCHEMISTRY",
        durationMinutes: 18,
        powerDrawWatts: 110,
        objective: "Micro-focus X-ray fluorescence mapping of elemental abundances (Na, Mg, Al, Si, P, S, Cl, K, Ca, Ti, Fe).",
        expectedOutput: "High-resolution elemental distribution map at sub-millimeter scale.",
        dataVolumeMb: 115.0,
      },
      {
        stepNumber: 7,
        instrumentName: "Rotary-Percussive Hollow Core Drill",
        instrumentType: "CORE_DRILL",
        durationMinutes: 25,
        powerDrawWatts: 320,
        objective: "Extract cylindrical rock core (13 mm diameter x 65 mm length, ~15-20 grams mass).",
        expectedOutput: "Intact stratigraphic cylindrical rock core in titanium sample tube.",
        dataVolumeMb: 12.0,
      },
      {
        stepNumber: 8,
        instrumentName: "Sample Tube Hermetic Dispenser & Seal Tool",
        instrumentType: "HERMETIC_SEAL",
        durationMinutes: 8,
        powerDrawWatts: 90,
        objective: "Crimp and laser-braze hermetic Teflon seal to maintain Martian volatile pressure (<10^-6 atm leak rate).",
        expectedOutput: "Hermetically sealed sample tube ready for Earth return caching.",
        dataVolumeMb: 8.0,
      },
    ];

    const totalMinutes = steps.reduce((sum, s) => sum + s.durationMinutes, 0);
    const totalPowerWh = Math.round(steps.reduce((sum, s) => sum + (s.powerDrawWatts * s.durationMinutes) / 60.0, 0));

    const tubeId = `MARS-TUBE-${String(tubeIndex).padStart(3, "0")}-${targetId.substring(0, 10).toUpperCase()}`;

    return {
      planId: `plan-obs-${targetId}-${Date.now().toString().slice(-4)}`,
      targetId,
      targetName,
      coordinate: { ...coord },
      geologicalFormation: `${geo.unit.name} (${geo.unit.code})`,
      dominantMineralogy: min.dominantMineralClass,
      astrobiologySignificance: min.target?.astrobiologicalRelevance || min.summary,
      totalObservationDurationMinutes: totalMinutes,
      totalPowerRequiredWh: totalPowerWh,
      assignedSampleTubeId: tubeId,
      instrumentSteps: steps,
      hermeticSealVerificationProtocol: "Verify seal chamber delta-pressure > 15 kPa. Log spectrometer calibration baseline. Lock into rover internal storage carousel.",
    };
  }
}

export const observationPlanningService = new ObservationPlanningService();
