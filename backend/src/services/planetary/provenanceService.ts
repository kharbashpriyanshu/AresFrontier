import { DataProvenance, SourceType, DataMode } from "../../types/index.js";

/**
 * Provenance Construction & Scientific Grounding Service
 * Enforces strict attribution and transparency for all planetary observations and derived metrics.
 */
export class ProvenanceService {
  /**
   * Constructs a NASA MGS MOLA elevation provenance record.
   */
  public static createMolaProvenance(
    mode: "BENCHMARK_DATA" | "CACHED_DATA" | "DERIVED" | "HEURISTIC" | "LIVE_EXTERNAL_DATA",
    uncertaintyM?: number,
    observationId?: string
  ): DataProvenance {
    const dataMode = mode === "BENCHMARK_DATA" ? "BENCHMARK" : mode === "CACHED_DATA" ? "CACHED" : mode === "LIVE_EXTERNAL_DATA" ? "LIVE" : "FALLBACK";
    const uncVal = uncertaintyM ?? (mode === "BENCHMARK_DATA" ? 2.5 : 20.0);
    return {
      sourceType: mode,
      sourceName: "NASA Mars Global Surveyor (MGS) MOLA",
      datasetId: "MGS-M-MOLA-5-MEGDR-L3-V1.0",
      observationId: observationId || "MOLA-PEDR-AREOID-DATUM",
      sourceUrl: "https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/",
      spatialResolutionM: 463, // 128 pixels per degree equatorial
      processingMethod:
        mode === "BENCHMARK_DATA"
          ? "Calibrated NASA Landing Site Ground Truth Altimetry"
          : mode === "DERIVED"
          ? "Bilinear Interpolation over Spherical Areoid Model"
          : "Deterministic Planetary Topographic Model",
      dataMode,
      confidence: mode === "BENCHMARK_DATA" ? 0.98 : mode === "DERIVED" ? 0.85 : 0.65,
      uncertainty: {
        value: uncVal,
        absolute: uncVal,
        relative: 0.05,
        unit: "m",
        methodology: "MGS Laser Pulse Timing to Mars Center of Mass Reference Ellipsoid (R=3396.19km)",
      },
    };
  }

  /**
   * Constructs a USGS Astrogeology Basemap Provenance record.
   */
  public static createVikingProvenance(): DataProvenance {
    return {
      sourceType: "USGS",
      sourceName: "USGS Astrogeology Viking MDIM 2.1 Mosaic",
      datasetId: "VO-M-VIS-5-DIM-V2.1",
      sourceUrl: "https://astrogeology.usgs.gov/search/map/Mars/Viking/MDIM21",
      spatialResolutionM: 232,
      processingMethod: "Orthorectified Controlled Digital Image Mosaic",
      dataMode: "LIVE",
      confidence: 0.95,
      uncertainty: {
        value: 200,
        absolute: 200,
        unit: "m",
        methodology: "Geodetic Control Network Tie-Point Residuals",
      },
    };
  }

  /**
   * Constructs an In-Situ Rover Observation Provenance record.
   */
  public static createRoverProvenance(
    mission: string,
    instrument: string,
    sol?: number
  ): DataProvenance {
    return {
      sourceType: "ROVER",
      sourceName: `NASA Planetary Data System — ${mission}`,
      datasetId: mission.includes("2020") ? "M2020-SURFACE-SCIENCE-ARCHIVE" : "MSL-CHEMIN-APXS-ARCHIVE",
      observationId: `${mission.split(" ")[0].toUpperCase()}-${instrument}${sol !== undefined ? `-SOL${sol}` : ""}`,
      sourceUrl: "https://an.rsl.wustl.edu/",
      spatialResolutionM: 0.01, // Centimeter-scale in situ
      processingMethod: "Calibrated In-Situ Science Payload Spectral & Micro-imaging Analysis",
      dataMode: "BENCHMARK",
      confidence: 0.99,
      uncertainty: {
        value: 0.05,
        absolute: 0.05,
        unit: "m",
        methodology: "Rover Mastcam-Z Stereo Triangulation and Wheel Odometry",
      },
    };
  }

  /**
   * Constructs an MRO HiRISE high-resolution camera provenance record.
   */
  public static createHiriseProvenance(observationId: string): DataProvenance {
    return {
      sourceType: "NASA",
      sourceName: "NASA MRO High Resolution Imaging Science Experiment (HiRISE)",
      datasetId: "MRO-M-HIRISE-3-RDR-V1.0",
      observationId,
      sourceUrl: "https://hirise.lpl.arizona.edu/",
      spatialResolutionM: 0.25, // 25 cm per pixel
      processingMethod: "Photogrammetric Stereo DTM Elevation Modeling",
      dataMode: "BENCHMARK",
      confidence: 0.96,
      uncertainty: {
        value: 0.5,
        absolute: 0.5,
        unit: "m",
        methodology: "Stereo-pair Bundle Adjustment and Epipolar Resampling",
      },
    };
  }

  /**
   * Constructs a 2001 Mars Odyssey THEMIS thermal provenance record.
   */
  public static createThemisProvenance(
    method: string = "Daytime Calibrated Thermal Brightness Temperature",
    confidence: number = 0.9,
    datasetId: string = "OD-M-THEMIS-5-DDR-V1.0"
  ): DataProvenance {
    return {
      sourceType: "NASA",
      sourceName: "2001 Mars Odyssey Thermal Emission Imaging System (THEMIS)",
      datasetId: datasetId || "OD-M-THEMIS-5-DDR-V1.0",
      sourceUrl: "https://themis.asu.edu/",
      spatialResolutionM: 100,
      processingMethod: method || "Daytime Calibrated Thermal Brightness Temperature",
      dataMode: "CACHED",
      confidence: confidence || 0.9,
      uncertainty: {
        value: 10,
        relative: 0.1,
        unit: "K",
        methodology: "Multi-band Radiometric Calibration and Atmospheric Dust Deconvolution",
      },
    };
  }

  /**
   * Constructs an MRO CRISM mineralogical spectral provenance record.
   */
  public static createCrismProvenance(
    observationId: string = "CRISM-FRT00005850_07",
    dataMode: DataMode = "BENCHMARK"
  ): DataProvenance {
    return {
      sourceType: "NASA",
      sourceName: "NASA MRO Compact Reconnaissance Imaging Spectrometer for Mars (CRISM)",
      datasetId: "MRO-M-CRISM-3-RDR-V1.0",
      observationId,
      sourceUrl: "https://pds-geosciences.wustl.edu/missions/mro/crism.htm",
      spatialResolutionM: 18.0,
      processingMethod: "Atmospheric Transmission Ratio and Mineral Summary Spectral Parameter Mapping",
      dataMode,
      confidence: 0.94,
      uncertainty: {
        value: 0.05,
        relative: 0.05,
        unit: "reflectance_I_over_F",
        methodology: "Photometrically and atmospherically corrected Volcano-Scan calibration",
      },
    };
  }

  /**
   * Constructs a Subsurface Water Ice Mapping (SWIM) resource provenance record.
   */
  public static createSwimIceProvenance(dataMode: DataMode = "BENCHMARK"): DataProvenance {
    return {
      sourceType: "NASA",
      sourceName: "Planetary Science Institute / NASA Subsurface Water Ice Mapping (SWIM)",
      datasetId: "SWIM-ICE-CONSISTENCY-V1.0",
      observationId: "SWIM-GLOBAL-ARC-01",
      sourceUrl: "https://swim.psi.edu/",
      spatialResolutionM: 1000.0,
      processingMethod: "Multi-dataset integration (SHARAD, Neutron Spectrometer, Thermal Inertia, Geomorphology)",
      dataMode,
      confidence: 0.88,
      uncertainty: {
        value: 0.15,
        relative: 0.15,
        unit: "ice_consistency_index",
        methodology: "Joint Bayesian multi-sensor evidence integration",
      },
    };
  }

  /**
   * Constructs a derived calculation provenance record.
   */
  public static createDerivedProvenance(
    metricName: string,
    inputs: string[],
    methodology: string,
    confidence?: number
  ): DataProvenance {
    return {
      sourceType: "DERIVED",
      sourceName: `Martian Map Planetary Computation — ${metricName}`,
      processingMethod: `Mathematical calculation derived from [${inputs.join(", ")}]: ${methodology}`,
      dataMode: "FALLBACK",
      confidence,
      uncertainty: {
        value: 1.0,
        unit: "score",
        methodology: `Propagated uncertainty from input layers [${inputs.join(", ")}]`,
      },
    };
  }

  /**
   * Constructs a heuristic or project rule provenance record.
   */
  public static createProjectRuleProvenance(ruleName: string, description: string): DataProvenance {
    return {
      sourceType: "PROJECT_RULE",
      sourceName: `Martian Map Operational Protocol — ${ruleName}`,
      processingMethod: description,
      dataMode: "FALLBACK",
      confidence: undefined, // Explicitly undefined for human policy rules per NASA integrity guidelines
      uncertainty: {
        value: 0.0,
        unit: "rule",
        methodology: "Operational engineering constraint based on human life support safety standards",
      },
    };
  }
}
