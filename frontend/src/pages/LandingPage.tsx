import React from "react";
import { Link } from "react-router-dom";
import { useTheme } from "../context/ThemeContext.js";
import {
  Mountain,
  Target,
  Shield,
  Activity,
  ArrowRight,
  Database,
  Radio,
  RotateCcw,
  BarChart3,
  CheckCircle,
  FileCheck,
  Compass,
} from "lucide-react";

export const LandingPage: React.FC = () => {
  const { theme } = useTheme();

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-atlas-bg text-atlas-text flex flex-col selection:bg-atlas-accent selection:text-white transition-colors duration-200">
      {/* Hero Section with Dynamic Theme-Adaptive Martian Surface Background */}
      <section className="relative px-4 sm:px-6 lg:px-8 pt-12 pb-20 md:pt-16 md:pb-28 overflow-hidden">
        {/* Martian Cinematic Background Vista (Switches between Dark Twilight and Light Daytime) */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none">
          <img
            key={theme}
            src={theme === "light" ? "/mars-hero-light-bg.jpg" : "/mars-hero-bg.jpg"}
            alt={theme === "light" ? "Daytime Martian surface landscape vista" : "Cinematic twilight Martian surface vista"}
            className={`w-full h-full object-cover object-bottom transition-opacity duration-300 ${
              theme === "light" ? "opacity-90" : "opacity-90"
            }`}
          />
          {/* Gradients to blend seamlessly into canvas (Dark: #080F19, Light: #F5F6F4) and preserve crisp text contrast */}
          <div
            className={`absolute inset-0 pointer-events-none transition-colors duration-300 ${
              theme === "light"
                ? "bg-gradient-to-t from-atlas-bg via-atlas-bg/30 to-atlas-bg/85"
                : "bg-gradient-to-t from-atlas-bg via-atlas-bg/40 to-atlas-bg/90"
            }`}
          />
          <div
            className={`absolute inset-0 pointer-events-none transition-colors duration-300 ${
              theme === "light"
                ? "bg-gradient-to-r from-atlas-bg/95 via-atlas-bg/70 to-transparent"
                : "bg-gradient-to-r from-atlas-bg/95 via-atlas-bg/75 to-atlas-bg/30"
            }`}
          />
        </div>

        {/* Hero Content Container */}
        <div className="relative z-10 max-w-7xl mx-auto space-y-12">
          {/* Main Hero Split Grid (Reference Image 1) */}
          <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left Column: Typography, Badges & CTAs */}
            <div className="lg:col-span-5 text-left space-y-6">
              {/* Challenge Classification Badge */}
              <div className="inline-flex items-center space-x-2 px-3 py-1.5 bg-atlas-surface/85 backdrop-blur-md border border-atlas-border text-[11px] font-mono text-atlas-muted shadow-sm">
                <span className="w-2 h-2 rounded-circle bg-atlas-accent animate-pulse" />
                <span className="text-atlas-text font-medium">NASA SPACE APPS CHALLENGE</span>
                <span className="text-atlas-border">|</span>
                <span className="text-atlas-accent font-semibold tracking-wide">PLANETARY MISSION PLANNER</span>
              </div>

              {/* Hero Title */}
              <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.25rem] font-extrabold tracking-tight text-atlas-text leading-[1.08]">
                Planetary Mission
                <br />
                Intelligence for
                <br />
                <span className="text-atlas-accent font-extrabold">Real-World Mars</span>
                <br />
                Operations
              </h1>

              {/* Subheading Description */}
              <p className="text-sm sm:text-base text-atlas-muted font-sans max-w-xl leading-relaxed">
                A mission planning suite that synthesizes planetary datasets,
                EVA route planning, science target selection, replay and digital
                twin validation, analytics, and provenance-aware intelligence
                for realistic Mars operations.
              </p>

              {/* Action Buttons (Strict 0px Corners) */}
              <div className="flex flex-wrap items-center gap-4 pt-2 font-sans">
                <Link
                  to="/map?demo=marswalk-001"
                  className="px-6 py-3.5 bg-atlas-accent hover:bg-atlas-accent-dark text-white font-bold text-xs uppercase tracking-wider flex items-center space-x-2 shadow-lg shadow-atlas-accent/25 transition-all border border-transparent"
                >
                  <span>Plan a Mars Mission</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Link>

                <Link
                  to="/map"
                  className="px-6 py-3.5 bg-atlas-surface/85 hover:bg-atlas-elevated text-atlas-text border border-atlas-border font-bold text-xs uppercase tracking-wider flex items-center space-x-2 backdrop-blur-md transition-colors shadow-sm"
                >
                  <Compass className="w-4 h-4 text-atlas-teal" />
                  <span>Explore the Platform</span>
                </Link>
              </div>
            </div>

            {/* Right Column: Product Interface Mockup (Reference Image 1) */}
            <div className="lg:col-span-7 relative">
              <div className="border border-atlas-border/80 bg-atlas-surface/90 backdrop-blur-md shadow-2xl p-2 sm:p-3 relative overflow-hidden group">
                {/* Tablet Frame Header */}
                <div className="flex items-center justify-between border-b border-atlas-border pb-2.5 mb-2.5 px-2">
                  <div className="flex items-center space-x-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 rounded-circle bg-atlas-border" />
                      <div className="w-2 h-2 rounded-circle bg-atlas-border" />
                      <div className="w-2 h-2 rounded-circle bg-atlas-border" />
                    </div>
                    <span className="text-[10px] font-mono text-atlas-accent font-bold tracking-wider">
                      MARTIAN MAP
                    </span>
                    <span className="text-[9px] font-mono text-atlas-muted uppercase tracking-tight hidden sm:inline">
                      • Atlas Intelligence
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 font-mono text-[10px]">
                    <span className="text-atlas-muted hidden sm:inline">DEMO:</span>
                    <span className="text-atlas-accent bg-atlas-elevated px-2 py-0.5 border border-atlas-border font-semibold">
                      MARSWALK-001
                    </span>
                  </div>
                </div>

                {/* Inner Mockup Grid: Map on Left + Route Planner on Right */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-2 relative bg-[#0a121d] border border-atlas-border overflow-hidden">
                  {/* Left / Center: Interactive Map Surface Canvas */}
                  <div className="md:col-span-8 relative h-72 sm:h-96 overflow-hidden">
                    {/* Radial Topographic Contour Simulation */}
                    <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 800 480">
                      <defs>
                        <radialGradient id="jezeroCraterGlow" cx="60%" cy="40%" r="45%">
                          <stop offset="0%" stopColor="#c1440e" stopOpacity="0.22" />
                          <stop offset="65%" stopColor="#29384b" stopOpacity="0.10" />
                          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
                        </radialGradient>
                      </defs>

                      {/* Terrain Grid Lines */}
                      <g stroke="#1b2a3a" strokeWidth="0.5" opacity="0.6">
                        <line x1="0" y1="120" x2="800" y2="120" />
                        <line x1="0" y1="240" x2="800" y2="240" />
                        <line x1="0" y1="360" x2="800" y2="360" />
                        <line x1="200" y1="0" x2="200" y2="480" />
                        <line x1="400" y1="0" x2="400" y2="480" />
                        <line x1="600" y1="0" x2="600" y2="480" />
                      </g>

                      {/* Jezero Crater Geological Rims */}
                      <ellipse cx="500" cy="210" rx="220" ry="140" fill="url(#jezeroCraterGlow)" stroke="#384f68" strokeWidth="1.5" strokeDasharray="4 4" />
                      <ellipse cx="500" cy="210" rx="150" ry="95" fill="none" stroke="#25374a" strokeWidth="1" />

                      {/* Traverse Route Path */}
                      <path
                        d="M 120 330 L 250 280 L 390 230 L 520 195 L 680 150"
                        fill="none"
                        stroke="var(--atlas-accent)"
                        strokeWidth="2.5"
                        strokeDasharray="6 4"
                      />

                      {/* Waypoint Dots */}
                      <circle cx="120" cy="330" r="6" fill="var(--atlas-teal)" stroke="#ffffff" strokeWidth="2" />
                      <circle cx="250" cy="280" r="4.5" fill="#ffffff" stroke="var(--atlas-accent)" strokeWidth="1.5" />
                      <circle cx="390" cy="230" r="4.5" fill="#ffffff" stroke="var(--atlas-accent)" strokeWidth="1.5" />
                      <circle cx="520" cy="195" r="4.5" fill="#ffffff" stroke="var(--atlas-accent)" strokeWidth="1.5" />
                      <rect x="673" y="143" width="14" height="14" fill="var(--atlas-accent)" stroke="#ffffff" strokeWidth="1.5" />
                    </svg>

                    {/* Coordinates & Location Header Banner */}
                    <div className="absolute top-2 left-2 font-mono text-[10px] bg-atlas-surface/85 backdrop-blur-sm px-2 py-1 border border-atlas-border text-atlas-text">
                      <div className="font-bold">Jezero Crater • EVA Route Planner</div>
                      <div className="text-atlas-muted text-[9px]">18.4447°N, 77.4508°E • MOLA MEGDR 128 px/deg</div>
                    </div>

                    {/* Floating Telemetry Card 1: Mission Analytics (Top Left) */}
                    <div className="absolute top-12 left-2 p-2 bg-atlas-surface/95 border border-atlas-border shadow-xl w-36 hidden sm:block">
                      <div className="text-[9px] font-mono text-atlas-muted flex items-center space-x-1 uppercase">
                        <BarChart3 className="w-3 h-3 text-atlas-teal" />
                        <span>Mission Analytics</span>
                      </div>
                      <div className="text-base font-bold font-mono text-atlas-text mt-0.5">88.5%</div>
                      <div className="text-[9px] text-atlas-muted font-mono">Fleet Utilization</div>
                      <div className="flex items-end space-x-1 h-3 mt-1.5 pt-0.5 border-t border-atlas-border">
                        <div className="w-1.5 bg-atlas-teal h-1.5" />
                        <div className="w-1.5 bg-atlas-teal h-2.5" />
                        <div className="w-1.5 bg-atlas-teal h-3" />
                        <div className="w-1.5 bg-atlas-teal h-2" />
                        <div className="w-1.5 bg-atlas-teal h-3" />
                      </div>
                    </div>

                    {/* Floating Telemetry Card 2: Replay / Digital Twin (Mid Left) */}
                    <div className="absolute top-36 left-2 p-2 bg-atlas-surface/95 border border-atlas-border shadow-xl w-40 hidden sm:block">
                      <div className="text-[9px] font-mono text-atlas-muted flex items-center space-x-1 uppercase">
                        <RotateCcw className="w-3 h-3 text-atlas-accent" />
                        <span>Replay / Digital Twin</span>
                      </div>
                      <div className="text-[11px] font-bold text-atlas-text mt-0.5">8 Events Recorded</div>
                      <div className="flex items-center space-x-1.5 mt-1.5">
                        <span className="w-1.5 h-1.5 rounded-circle bg-atlas-teal" />
                        <span className="w-1.5 h-1.5 rounded-circle bg-atlas-teal" />
                        <span className="w-1.5 h-1.5 rounded-circle bg-atlas-teal" />
                        <span className="w-1.5 h-1.5 rounded-circle bg-atlas-accent animate-pulse" />
                        <span className="w-1.5 h-1.5 rounded-circle bg-atlas-border" />
                      </div>
                    </div>

                    {/* Floating Telemetry Card 3: Provenance & Benchmark (Bottom Left) */}
                    <div className="absolute bottom-2 left-2 p-1.5 bg-atlas-surface/95 border border-atlas-border shadow-xl hidden md:flex items-center space-x-2 text-[10px] font-mono">
                      <Database className="w-3.5 h-3.5 text-atlas-blue" />
                      <span className="text-atlas-muted">MGS / MOLA:</span>
                      <span className="text-atlas-teal font-bold flex items-center space-x-1">
                        <CheckCircle className="w-3 h-3" />
                        <span>ONLINE</span>
                      </span>
                    </div>

                    {/* Floating Telemetry Card 4: EVA Feasibility Card (Bottom Center / Right) */}
                    <div className="absolute bottom-2 right-2 p-2.5 bg-atlas-surface/95 border border-atlas-border shadow-2xl max-w-[14rem] text-left">
                      <div className="flex items-center justify-between border-b border-atlas-border pb-1 mb-1">
                        <div className="flex items-center space-x-1">
                          <Shield className="w-3.5 h-3.5 text-atlas-teal" />
                          <span className="font-mono text-[10px] font-bold text-atlas-text uppercase">EVA Feasibility</span>
                        </div>
                        <span className="px-1.5 py-0.2 bg-atlas-elevated text-atlas-teal font-mono text-[9px] font-bold border border-atlas-border">
                          FEASIBLE
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1 font-mono text-[10px]">
                        <div>
                          <span className="text-atlas-muted text-[8px]">Distance:</span>
                          <div className="font-bold text-atlas-text">4.14 km</div>
                        </div>
                        <div>
                          <span className="text-atlas-muted text-[8px]">Duration:</span>
                          <div className="font-bold text-atlas-text">129 min</div>
                        </div>
                        <div>
                          <span className="text-atlas-muted text-[8px]">Slope:</span>
                          <div className="font-bold text-atlas-amber">3.8°</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column of Mockup: Route Planner Sidebar Panel */}
                  <div className="md:col-span-4 p-3 bg-atlas-surface/95 border-t md:border-t-0 md:border-l border-atlas-border flex flex-col justify-between space-y-3 font-mono text-xs">
                    <div>
                      <div className="text-[10px] text-atlas-muted uppercase tracking-wider flex items-center space-x-1 pb-1.5 border-b border-atlas-border">
                        <Compass className="w-3 h-3 text-atlas-accent" />
                        <span>Route Planner</span>
                      </div>

                      <div className="text-[9px] text-atlas-muted mt-2">Traverse Sequence (4 Waypoints)</div>
                      <div className="space-y-1.5 mt-1.5 text-[10px]">
                        <div className="p-1.5 bg-atlas-elevated border border-atlas-border flex items-center space-x-1.5">
                          <span className="w-4 h-4 bg-atlas-teal text-white flex items-center justify-center font-bold text-[9px]">S</span>
                          <span className="truncate text-atlas-text">Octavia E. Butler Site</span>
                        </div>
                        <div className="p-1.5 bg-atlas-elevated border border-atlas-border flex items-center space-x-1.5">
                          <span className="w-4 h-4 bg-atlas-blue text-white flex items-center justify-center font-bold text-[9px]">W1</span>
                          <span className="truncate text-atlas-text">South Séítah Olivine</span>
                        </div>
                        <div className="p-1.5 bg-atlas-elevated border border-atlas-border flex items-center space-x-1.5">
                          <span className="w-4 h-4 bg-atlas-blue text-white flex items-center justify-center font-bold text-[9px]">W2</span>
                          <span className="truncate text-atlas-text">Kodiak Butte Delta</span>
                        </div>
                        <div className="p-1.5 bg-atlas-elevated border border-atlas-border flex items-center space-x-1.5">
                          <span className="w-4 h-4 bg-atlas-accent text-white flex items-center justify-center font-bold text-[9px]">D</span>
                          <span className="truncate text-atlas-text">Delta Scarp Base Camp</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-atlas-border">
                      <div className="text-[9px] text-atlas-muted">Target Science Outcrop:</div>
                      <div className="p-1.5 bg-atlas-elevated border border-atlas-border text-[10px] text-atlas-text font-bold truncate">
                        Olivine Cumulate Outcrop
                      </div>

                      <Link
                        to="/mission?route=demo"
                        className="w-full py-2 bg-atlas-accent hover:bg-atlas-accent-dark text-white font-bold text-[10px] uppercase text-center block transition-colors shadow-sm"
                      >
                        Assess EVA & Mission Score
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Telemetry Status Ribbon (Bottom of Hero - Reference Image 1) */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 w-full text-left font-mono text-xs">
            <div className="p-3.5 bg-atlas-surface/85 backdrop-blur-md border border-atlas-border space-y-1 shadow-sm">
              <div className="text-[10px] text-atlas-muted flex items-center space-x-1 uppercase">
                <Radio className="w-3 h-3 text-atlas-teal" />
                <span>5 Missions</span>
              </div>
              <div className="text-sm font-bold text-atlas-text font-display">Integrated</div>
              <div className="text-[10px] text-atlas-muted truncate">MGS, MRO, Odyssey, MSL, M2020</div>
            </div>

            <div className="p-3.5 bg-atlas-surface/85 backdrop-blur-md border border-atlas-border space-y-1 shadow-sm">
              <div className="text-[10px] text-atlas-muted flex items-center space-x-1 uppercase">
                <Mountain className="w-3 h-3 text-atlas-blue" />
                <span>MOLA MEGDR</span>
              </div>
              <div className="text-sm font-bold text-atlas-text font-display">128 px/deg</div>
              <div className="text-[10px] text-atlas-muted">Laser altimetry areoid grid</div>
            </div>

            <div className="p-3.5 bg-atlas-surface/85 backdrop-blur-md border border-atlas-border space-y-1 shadow-sm">
              <div className="text-[10px] text-atlas-muted flex items-center space-x-1 uppercase">
                <Target className="w-3 h-3 text-atlas-amber" />
                <span>Cataloged</span>
              </div>
              <div className="text-sm font-bold text-atlas-text font-display">Science Targets</div>
              <div className="text-[10px] text-atlas-muted">Clays, carbonates, delta scarps</div>
            </div>

            <div className="p-3.5 bg-atlas-surface/85 backdrop-blur-md border border-atlas-border space-y-1 shadow-sm">
              <div className="text-[10px] text-atlas-muted flex items-center space-x-1 uppercase">
                <Shield className="w-3 h-3 text-atlas-accent" />
                <span>Deterministic</span>
              </div>
              <div className="text-sm font-bold text-atlas-text font-display">EVA Safety Margins</div>
              <div className="text-[10px] text-atlas-muted">Metabolic & slope boundaries</div>
            </div>

            <div className="p-3.5 bg-atlas-surface/85 backdrop-blur-md border border-atlas-border space-y-1 shadow-sm col-span-2 md:col-span-1">
              <div className="text-[10px] text-atlas-muted flex items-center space-x-1 uppercase">
                <FileCheck className="w-3 h-3 text-atlas-teal" />
                <span>100% Verified</span>
              </div>
              <div className="text-sm font-bold text-atlas-text font-display">Audit & Provenance</div>
              <div className="text-[10px] text-atlas-muted">Cryptographic event ledger</div>
            </div>
          </div>
        </div>
      </section>

      {/* Operational Architecture & Capabilities Section */}
      <section className="border-t border-atlas-border bg-atlas-surface/50 py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <div className="text-xs font-mono uppercase tracking-widest text-atlas-accent font-semibold">
              Operational Architecture
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold font-display text-atlas-text">
              Precision Planetary Science Meets Enterprise Operations
            </h2>
            <p className="text-sm text-atlas-muted max-w-2xl mx-auto leading-relaxed">
              Designed for mission planners, flight directors, and surface science teams navigating high-risk extraterrestrial environments.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-6 bg-atlas-surface border border-atlas-border space-y-4 hover:border-atlas-border-light transition-colors shadow-sm">
              <div className="w-10 h-10 bg-atlas-elevated border border-atlas-border flex items-center justify-center text-atlas-blue">
                <Mountain className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-atlas-text font-display">
                Topography & Geodesy
              </h3>
              <p className="text-atlas-muted leading-relaxed text-xs">
                MOLA MEGDR 128 px/deg elevation grids evaluate slope cross-sections and metabolic traversal pacing using the Mars-calibrated Tobler formulation.
              </p>
              <div className="pt-2 border-t border-atlas-border flex items-center justify-between text-[11px] font-mono text-atlas-muted">
                <span>IAU/IAG 2000 Areoid</span>
                <span className="text-atlas-teal">R = 3389.5 km</span>
              </div>
            </div>

            <div className="p-6 bg-atlas-surface border border-atlas-border space-y-4 hover:border-atlas-border-light transition-colors shadow-sm">
              <div className="w-10 h-10 bg-atlas-elevated border border-atlas-border flex items-center justify-center text-atlas-accent">
                <Target className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-atlas-text font-display">
                Science Outcrops & Sampling
              </h3>
              <p className="text-atlas-muted leading-relaxed text-xs">
                Ground-truth geological units and priority sample targets based on NASA Mars 2020 (Jezero Delta) and MSL Curiosity (Gale Crater) discoveries.
              </p>
              <div className="pt-2 border-t border-atlas-border flex items-center justify-between text-[11px] font-mono text-atlas-muted">
                <span>Mineralogy Catalog</span>
                <span className="text-atlas-accent">PDS Verified</span>
              </div>
            </div>

            <div className="p-6 bg-atlas-surface border border-atlas-border space-y-4 hover:border-atlas-border-light transition-colors shadow-sm">
              <div className="w-10 h-10 bg-atlas-elevated border border-atlas-border flex items-center justify-center text-atlas-teal">
                <Activity className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-atlas-text font-display">
                EVA Feasibility & Risk Models
              </h3>
              <p className="text-atlas-muted leading-relaxed text-xs">
                Strict NASA flight safety constraints: 30-minute reserve margins, metabolic oxygen consumption, and multi-objective Pareto route candidates.
              </p>
              <div className="pt-2 border-t border-atlas-border flex items-center justify-between text-[11px] font-mono text-atlas-muted">
                <span>Safety Invariants</span>
                <span className="text-atlas-teal">S1–S8 Audited</span>
              </div>
            </div>

            <div className="p-6 bg-atlas-surface border border-atlas-border space-y-4 hover:border-atlas-border-light transition-colors shadow-sm">
              <div className="w-10 h-10 bg-atlas-elevated border border-atlas-border flex items-center justify-center text-atlas-violet">
                <RotateCcw className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-atlas-text font-display">
                Digital Twin & Mission Replay
              </h3>
              <p className="text-atlas-muted leading-relaxed text-xs">
                Deterministic event replay with state restoration, decision lineage inspection, and counterfactual what-if simulation branching.
              </p>
              <div className="pt-2 border-t border-atlas-border flex items-center justify-between text-[11px] font-mono text-atlas-muted">
                <span>Deterministic Seed</span>
                <span className="text-atlas-violet">Reproducible</span>
              </div>
            </div>

            <div className="p-6 bg-atlas-surface border border-atlas-border space-y-4 hover:border-atlas-border-light transition-colors shadow-sm">
              <div className="w-10 h-10 bg-atlas-elevated border border-atlas-border flex items-center justify-center text-atlas-teal">
                <Shield className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-atlas-text font-display">
                Cryptographic Governance
              </h3>
              <p className="text-atlas-muted leading-relaxed text-xs">
                Role-based command authorization (MISSION_COMMAND gate), SHA-256 block hash integrity, and replay-attack defense verification.
              </p>
              <div className="pt-2 border-t border-atlas-border flex items-center justify-between text-[11px] font-mono text-atlas-muted">
                <span>Ledger Security</span>
                <span className="text-atlas-teal">SHA-256 Chain</span>
              </div>
            </div>

            <div className="p-6 bg-atlas-surface border border-atlas-border space-y-4 hover:border-atlas-border-light transition-colors shadow-sm">
              <div className="w-10 h-10 bg-atlas-elevated border border-atlas-border flex items-center justify-center text-atlas-amber">
                <Database className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-atlas-text font-display">
                Data Provenance & Truthfulness
              </h3>
              <p className="text-atlas-muted leading-relaxed text-xs">
                Five-tier classification strictly distinguishing real NASA observations, derived physics, simulations, heuristics, and demo testbeds.
              </p>
              <div className="pt-2 border-t border-atlas-border flex items-center justify-between text-[11px] font-mono text-atlas-muted">
                <span>Truthfulness Tiers</span>
                <span className="text-atlas-amber">Tier 1–5 Classified</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* NASA Attribution Footer */}
      <footer className="mt-auto border-t border-atlas-border bg-atlas-surface px-4 sm:px-6 py-8 text-xs text-atlas-muted transition-colors">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <Database className="w-4 h-4 text-atlas-accent" />
            <span className="font-display font-semibold text-atlas-text">
              Martian Map — Atlas Intelligence
            </span>
            <span className="text-atlas-border">|</span>
            <span>NASA Space Apps Challenge</span>
          </div>
          <div className="text-center md:text-right text-[11px] text-atlas-muted font-mono">
            Datasets: NASA Planetary Data System (PDS), USGS Astrogeology Science Center, MGS/MOLA, MRO/HiRISE, Mars 2020.
          </div>
        </div>
      </footer>
    </div>
  );
};
