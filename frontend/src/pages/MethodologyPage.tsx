import React, { useEffect, useState } from "react";
import { api } from "../services/api.js";
import { DataSourceInfo } from "../types/index.js";
import {
  BookOpen,
  Database,
  Layers,
  Activity,
  ExternalLink,
  CheckCircle,
  AlertTriangle,
  Shield,
} from "lucide-react";

export const MethodologyPage: React.FC = () => {
  const [dataSources, setDataSources] = useState<DataSourceInfo[]>([]);

  useEffect(() => {
    async function loadSources() {
      try {
        const sources = await api.getDataSources();
        setDataSources(sources);
      } catch (err) {
        console.error("Failed to load data sources", err);
      }
    }
    loadSources();
  }, []);

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-space-950 text-slate-100 p-4 md:p-8 font-mono text-xs selection:bg-mars-rust selection:text-white">
      <div className="max-w-6xl mx-auto space-y-10">
        {/* Header */}
        <div className="border-b border-space-800 pb-5 space-y-2">
          <div className="text-[10px] text-slate-400 tracking-wider flex items-center space-x-1.5 uppercase">
            <BookOpen className="w-3.5 h-3.5 text-telemetry-cyan" />
            <span>SCIENTIFIC ARCHITECTURE & NASA DATA PROVENANCE</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold font-sans text-slate-100">
            Planetary Geodesy, Truthfulness Tiers & Methodology
          </h1>
          <p className="text-slate-400 text-[11px] max-w-3xl font-sans leading-relaxed">
            Full documentation of planetary geodetic models, 5-tier scientific truthfulness classification,
            metabolic EVA equations, and integrated NASA mission datasets for the Martian Map digital twin.
          </p>
        </div>

        {/* 1. Scientific Truthfulness Tiers (Section 26) */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            <h2 className="text-base font-bold font-sans text-slate-100">
              1. Five-Tier Scientific Truthfulness Classification
            </h2>
          </div>
          <p className="text-slate-400 text-[11px] font-sans">
            To prevent deceptive claims of real-time telemetry from Mars, every dataset, calculation, and model output in Martian Map is strictly categorized into one of five transparent tiers:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="p-3.5 bg-space-900 border border-space-800 rounded space-y-1.5">
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-bold uppercase">
                1. DATA
              </span>
              <div className="font-bold text-white text-xs mt-1">Real NASA Datasets</div>
              <p className="text-slate-400 text-[10px] leading-relaxed">
                MGS MOLA MEGDR elevation, Viking MDIM 2.1 visible mosaic, THEMIS daytime infrared, and PDS Analyst's Notebook ground-truth sample logs.
              </p>
            </div>

            <div className="p-3.5 bg-space-900 border border-space-800 rounded space-y-1.5">
              <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-bold uppercase">
                2. DERIVED
              </span>
              <div className="font-bold text-white text-xs mt-1">Physical Calculations</div>
              <p className="text-slate-400 text-[10px] leading-relaxed">
                Continuous great-circle MOLA cross sections, slope gradients, Tobler metabolic walk paces, and chord line-of-sight ray-tracing.
              </p>
            </div>

            <div className="p-3.5 bg-space-900 border border-space-800 rounded space-y-1.5">
              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800 font-bold uppercase">
                3. SIMULATED
              </span>
              <div className="font-bold text-white text-xs mt-1">Physics Models</div>
              <p className="text-slate-400 text-[10px] leading-relaxed">
                Gaussian sensor noise perturbation, 112m Keplerian orbital pass windows, battery motor drain rates, and UHF surface mesh relays.
              </p>
            </div>

            <div className="p-3.5 bg-space-900 border border-space-800 rounded space-y-1.5">
              <span className="text-[10px] px-2 py-0.5 rounded bg-purple-950 text-purple-400 border border-purple-800 font-bold uppercase">
                4. HEURISTIC
              </span>
              <div className="font-bold text-white text-xs mt-1">Flight Rules & Weights</div>
              <p className="text-slate-400 text-[10px] leading-relaxed">
                NASA 30-min return safety reserve, 20% safe-return battery threshold, and MEPAG factorized scientific priority weights.
              </p>
            </div>

            <div className="p-3.5 bg-space-900 border border-space-800 rounded space-y-1.5">
              <span className="text-[10px] px-2 py-0.5 rounded bg-red-950 text-red-400 border border-red-800 font-bold uppercase">
                5. DEMO
              </span>
              <div className="font-bold text-white text-xs mt-1">Scenario Injections</div>
              <p className="text-slate-400 text-[10px] leading-relaxed">
                Pre-staged testbed scenarios: Flagship Recon (MARSWALK-001), Comms Blackout, Sensor Degradation, Battery Emergency, and Replay Defense.
              </p>
            </div>
          </div>
        </div>

        {/* 2. Integrated NASA Data Sources Table */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Database className="w-4 h-4 text-mars-accent" />
            <h2 className="text-base font-bold font-sans text-slate-100">
              2. NASA Mission Datasets & Tile Pipelines
            </h2>
          </div>

          <div className="overflow-x-auto border border-space-800 rounded bg-space-900 shadow-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-space-850 border-b border-space-800 text-[10px] text-slate-400 uppercase">
                  <th className="p-3">Data Pipeline</th>
                  <th className="p-3">Mission</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Coverage</th>
                  <th className="p-3">Attribution</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-space-800 text-[11px]">
                {dataSources.map((ds) => (
                  <tr key={ds.id} className="hover:bg-space-850/50 transition-colors">
                    <td className="p-3 font-semibold text-slate-200">
                      <a
                        href={ds.url}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-mars-accent flex items-center space-x-1"
                      >
                        <span>{ds.name}</span>
                        <ExternalLink className="w-3 h-3 text-slate-500" />
                      </a>
                    </td>
                    <td className="p-3 text-slate-400">{ds.mission}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-space-800 text-slate-300 border border-space-700 text-[10px] uppercase">
                        {ds.type}
                      </span>
                    </td>
                    <td className="p-3 text-slate-400 text-[10px]">{ds.coverage}</td>
                    <td className="p-3 text-slate-400 text-[10px]">{ds.attribution}</td>
                    <td className="p-3">
                      <span className="flex items-center space-x-1 text-telemetry-emerald text-[10px]">
                        <CheckCircle className="w-3 h-3" />
                        <span className="uppercase">{ds.status}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. Planetary Geodesy & Coordinates */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-telemetry-cyan" />
            <h2 className="text-base font-bold font-sans text-slate-100">
              3. Martian Coordinate Reference System & Topography
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <div className="p-5 bg-space-900 border border-space-800 rounded space-y-3">
              <h3 className="font-bold text-slate-200 text-xs uppercase text-mars-accent">
                IAU / IAG Mars Areoid Datum
              </h3>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                Mars is modeled using an oblate spheroid reference ellipsoid with equatorial radius{" "}
                <span className="text-slate-100 font-bold">R_eq = 3396.19 km</span> and polar radius{" "}
                <span className="text-slate-100 font-bold">R_pol = 3376.20 km</span>, with a mean volumetric radius of{" "}
                <span className="text-slate-100 font-bold">R = 3389.5 km</span> used for surface great-circle distance
                approximations.
              </p>
              <div className="p-3 bg-space-850 rounded border border-space-800 text-[10px] space-y-1 text-slate-400">
                <div>• Zero Elevation: MOLA Mars Areoid (equipotential gravitational surface)</div>
                <div>• Longitude Convention: Planetographic / East Longitude [0° to 360° or -180° to +180°]</div>
                <div>• Prime Meridian: Defined by Airy-0 crater in Sinus Meridiani</div>
              </div>
            </div>

            <div className="p-5 bg-space-900 border border-space-800 rounded space-y-3">
              <h3 className="font-bold text-slate-200 text-xs uppercase text-telemetry-cyan">
                MOLA Topographic Interpolation
              </h3>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                Elevation cross-sections are evaluated from Mars Global Surveyor (MGS) MOLA MEGDR data. For arbitrary
                coordinates, the engine combines verified landmark anchors (Jezero, Gale, Olympus Mons, Hellas, Valles Marineris)
                with the Mars crustal dichotomy gradient.
              </p>
              <div className="p-3 bg-space-850 rounded border border-space-800 text-[10px] space-y-1 text-slate-400">
                <div>• Vertical Resolution: ~1 meter laser altimetry precision</div>
                <div>• Spatial Sampling: Multi-step great circle interpolation</div>
                <div>• Slope Gradient: Evaluated across ~300m baseline steps</div>
              </div>
            </div>
          </div>
        </div>

        {/* 4. EVA Traversal Physics Formulation */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-telemetry-amber" />
            <h2 className="text-base font-bold font-sans text-slate-100">
              4. EVA Traversal Physics & Metabolic Rates
            </h2>
          </div>

          <div className="p-5 bg-space-900 border border-space-800 rounded space-y-4">
            <p className="text-slate-300 leading-relaxed text-[11px]">
              Traverse time estimation is governed by an adapted Tobler Hiking Model calibrated for Martian gravity (0.38g)
              and pressurized exploration suits:
            </p>

            <div className="p-4 bg-space-850 rounded border border-space-800 text-center font-mono text-sm text-mars-accent">
              V(slope) = 3.2 · exp(-3.2 · |tan(slope) + 0.04|) [km/h]
            </div>

            <div className="grid md:grid-cols-3 gap-4 text-[10px] text-slate-400 pt-2">
              <div className="p-3 bg-space-950 rounded border border-space-800">
                <span className="font-bold text-slate-200">Flat Terrain:</span> ~3.2 km/h unencumbered walking speed.
              </div>
              <div className="p-3 bg-space-950 rounded border border-space-800">
                <span className="font-bold text-slate-200">10° Slope:</span> Speed reduced to ~1.8 km/h due to regolith shear.
              </div>
              <div className="p-3 bg-space-950 rounded border border-space-800">
                <span className="font-bold text-slate-200">&gt;20° Escarpment:</span> Flags mission hazard, requiring climbing gear or detour.
              </div>
            </div>
          </div>
        </div>

        {/* 5. Limitations & Operational Caveats */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-telemetry-rose" />
            <h2 className="text-base font-bold font-sans text-slate-100">
              5. Known Model Boundaries & Operational Caveats
            </h2>
          </div>

          <div className="p-5 bg-space-900 border border-space-800 rounded space-y-3 text-slate-300 text-[11px] leading-relaxed">
            <p>
              • <strong className="text-slate-100">Sub-meter Hazards:</strong> Orbital MOLA elevation models provide regional topography;
              unmapped meter-scale boulders, loose regolith ripples, and meter-deep fissures require rover forward-looking stereo
              hazcams during tactical execution.
            </p>
            <p>
              • <strong className="text-slate-100">Atmospheric Variability:</strong> Seasonal dust storms (e.g. MY34 global storm)
              and diurnal atmospheric pressure fluctuations (600 to 900 Pa) alter thermal cooling margins and visibility.
            </p>
            <p>
              • <strong className="text-slate-100">Offline & Simulation Scope:</strong> Outside of verified NASA PDS benchmark footprints,
              planetary coordinates use synthetic mathematical dichotomy approximations; they are labeled SIMULATED to guarantee scientific honesty.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
