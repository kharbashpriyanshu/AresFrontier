import React from "react";
import { Link } from "react-router-dom";
import {
  Compass,
  Mountain,
  Target,
  Shield,
  Activity,
  ArrowRight,
  Database,
  Radio,
  Play,
} from "lucide-react";

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-space-950 text-slate-100 flex flex-col selection:bg-mars-rust selection:text-white">
      {/* Hero Section */}
      <section className="relative px-6 py-20 md:py-28 max-w-6xl mx-auto flex flex-col items-center text-center space-y-8">
        {/* Subtle Background Radial Grid */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(193,68,14,0.12)_0,transparent_70%)] pointer-events-none" />

        {/* Mission Classification Pill */}
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-space-900 border border-space-800 text-[11px] font-mono text-slate-300">
          <span className="w-2 h-2 rounded-full bg-mars-accent animate-pulse" />
          <span className="text-slate-400">NASA SPACE APPS CHALLENGE</span>
          <span className="text-slate-600">|</span>
          <span className="text-mars-accent font-semibold">PLANETARY MISSION PLANNER</span>
        </div>

        {/* Main Title */}
        <div className="space-y-4 max-w-4xl">
          <div className="text-xs md:text-sm font-mono tracking-widest text-slate-400 uppercase">
            Interplanetary Survival Guide
          </div>
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight font-sans text-slate-100">
            MARTIAN <span className="text-transparent bg-clip-text bg-gradient-to-r from-mars-accent to-amber-500">MAP</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-300 font-sans max-w-2xl mx-auto leading-relaxed">
            Explore Mars. Plan the route. Discover science along the way.
          </p>
        </div>

        {/* Description Brief */}
        <p className="text-sm md:text-base text-slate-400 max-w-2xl font-mono leading-relaxed">
          An interactive operational planning suite synthesizing datasets from multiple NASA planetary science missions.
          Designed to assist future astronauts and flight controllers in analyzing Martian topography, scoping science targets,
          and verifying extravehicular activity (EVA) route feasibility.
        </p>

        {/* Action CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 font-mono text-xs w-full sm:w-auto">
          <Link
            to="/map?demo=marswalk-001"
            className="w-full sm:w-auto px-6 py-3.5 rounded bg-gradient-to-r from-mars-rust to-mars-accent hover:from-mars-accent hover:to-orange-500 text-white font-bold flex items-center justify-center space-x-2 shadow-lg shadow-mars-rust/30 transition-all group"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>LAUNCH DEMO (MARSWALK-001)</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </Link>

          <Link
            to="/map"
            className="w-full sm:w-auto px-6 py-3.5 rounded bg-space-900 hover:bg-space-850 text-slate-200 border border-space-700 font-semibold flex items-center justify-center space-x-2 transition-colors"
          >
            <Compass className="w-4 h-4 text-telemetry-cyan" />
            <span>EXPLORE MARS MAP</span>
          </Link>
        </div>

        {/* Telemetry Status Bar */}
        <div className="pt-10 grid grid-cols-2 md:grid-cols-4 gap-4 w-full text-left font-mono text-xs">
          <div className="p-4 bg-space-900/80 border border-space-800 rounded space-y-1">
            <div className="text-[10px] text-slate-400 flex items-center space-x-1">
              <Radio className="w-3 h-3 text-telemetry-emerald" />
              <span>ORBITAL DATASETS</span>
            </div>
            <div className="text-base font-bold text-slate-100">5 Missions</div>
            <div className="text-[10px] text-slate-500">MGS, MRO, Odyssey, MSL, M2020</div>
          </div>

          <div className="p-4 bg-space-900/80 border border-space-800 rounded space-y-1">
            <div className="text-[10px] text-slate-400 flex items-center space-x-1">
              <Mountain className="w-3 h-3 text-telemetry-cyan" />
              <span>TOPOGRAPHY GRID</span>
            </div>
            <div className="text-base font-bold text-slate-100">MOLA Megdr</div>
            <div className="text-[10px] text-slate-500">128 pixels/degree datum</div>
          </div>

          <div className="p-4 bg-space-900/80 border border-space-800 rounded space-y-1">
            <div className="text-[10px] text-slate-400 flex items-center space-x-1">
              <Target className="w-3 h-3 text-telemetry-amber" />
              <span>SCIENCE TARGETS</span>
            </div>
            <div className="text-base font-bold text-slate-100">Cataloged</div>
            <div className="text-[10px] text-slate-500">Clays, sulfates, delta units</div>
          </div>

          <div className="p-4 bg-space-900/80 border border-space-800 rounded space-y-1">
            <div className="text-[10px] text-slate-400 flex items-center space-x-1">
              <Shield className="w-3 h-3 text-mars-accent" />
              <span>EVA SAFETY MARGINS</span>
            </div>
            <div className="text-base font-bold text-slate-100">Deterministic</div>
            <div className="text-[10px] text-slate-500">Metabolic & slope bounds</div>
          </div>
        </div>
      </section>

      {/* Core Capabilities */}
      <section className="border-t border-space-800 bg-space-900/50 py-16 px-6">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-2">
            <h2 className="text-xs font-mono uppercase tracking-widest text-mars-accent">
              Operational Architecture
            </h2>
            <p className="text-2xl font-bold font-sans text-slate-100">
              Built for Real Planetary Mission Planning
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 font-mono text-xs">
            <div className="p-6 bg-space-900 border border-space-800 rounded space-y-3">
              <div className="w-10 h-10 rounded bg-space-800 border border-space-700 flex items-center justify-center text-telemetry-cyan">
                <Mountain className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-100 font-sans">
                True Martian Topography & Slope
              </h3>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                Elevation cross-sections computed from Mars Orbiter Laser Altimeter (MOLA) grids. Accurate slope
                calculations help identify impassable escarpments and calculate metabolic traversal costs.
              </p>
            </div>

            <div className="p-6 bg-space-900 border border-space-800 rounded space-y-3">
              <div className="w-10 h-10 rounded bg-space-800 border border-space-700 flex items-center justify-center text-mars-accent">
                <Target className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-100 font-sans">
                Science Outcrops & Sampling
              </h3>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                Ground-truth geological units and priority sample targets based on NASA Mars 2020 (Jezero Delta) and MSL
                Curiosity (Gale Crater) discoveries. Seamlessly add sampling stops into your EVA traverse.
              </p>
            </div>

            <div className="p-6 bg-space-900 border border-space-800 rounded space-y-3">
              <div className="w-10 h-10 rounded bg-space-800 border border-space-700 flex items-center justify-center text-telemetry-emerald">
                <Activity className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-100 font-sans">
                EVA Feasibility & AI Scoring
              </h3>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                Enforces NASA flight safety rules: 30-minute reserve margins, oxygen consumption models, and pluggable AI/ML
                hazard scoring to assess crew risk before stepping out of the airlock.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* NASA Attribution Footer */}
      <footer className="mt-auto border-t border-space-800 bg-space-950 px-6 py-6 font-mono text-[11px] text-slate-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <Database className="w-3.5 h-3.5 text-mars-accent" />
            <span>NASA Space Apps Challenge — Planetary Exploration & Scientific Planning</span>
          </div>
          <div>
            Data: NASA PDS, USGS Astrogeology Science Center, MGS/MOLA, MRO/HiRISE, Mars 2020.
          </div>
        </div>
      </footer>
    </div>
  );
};
