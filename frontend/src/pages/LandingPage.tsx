import React from "react";
import { Link } from "react-router-dom";
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
  Users,
  GitBranch,
} from "lucide-react";

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-atlas-bg text-atlas-text flex flex-col selection:bg-atlas-accent selection:text-white">
      {/* =========================================================================
          SECTION 1: HERO SECTION (Reference Image 1)
          ========================================================================= */}
      <section className="relative px-6 sm:px-10 lg:px-16 pt-20 pb-28 md:pt-28 md:pb-36 overflow-hidden border-b border-atlas-border">
        {/* Cinematic Martian Vista Background */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none">
          <img
            src="/mars-hero-bg.jpg"
            alt="Mars Jezero Crater Surface Vista"
            className="w-full h-full object-cover object-center opacity-45 brightness-90 contrast-105"
          />
          {/* Subtle atmospheric vignette gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-atlas-bg via-atlas-bg/60 to-atlas-bg/30" />
          <div className="absolute inset-0 bg-gradient-to-r from-atlas-bg via-transparent to-atlas-bg" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto space-y-12">
          {/* Eyebrow Pill */}
          <div className="inline-flex items-center space-x-2.5 px-3.5 py-1.5 bg-atlas-surface/85 backdrop-blur-md border border-atlas-border text-atlas-text text-xs font-mono shadow-md">
            <span className="w-2 h-2 rounded-full bg-atlas-accent animate-pulse" />
            <span className="text-atlas-muted uppercase tracking-wider font-semibold">NASA Space Apps Challenge</span>
            <span className="text-atlas-border">|</span>
            <span className="text-atlas-accent font-bold">Planetary Mission Intelligence</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            {/* Left Hero Narrative */}
            <div className="lg:col-span-6 space-y-8">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold font-display tracking-tight text-atlas-text leading-[1.12]">
                Planetary Mission Intelligence for{" "}
                <span className="text-atlas-accent">Real-World Mars Operations</span>
              </h1>

              <p className="text-base sm:text-lg text-atlas-muted font-sans leading-relaxed max-w-xl">
                A mission planning and operational intelligence suite synthesizing planetary datasets,
                EVA route planning, autonomous safety invariants, replay verification, and digital-twin
                simulation for authentic Jezero Crater exploration.
              </p>

              {/* Primary Call to Actions */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Link
                  to="/map?demo=marswalk-001"
                  className="px-7 py-3.5 bg-atlas-accent hover:bg-atlas-accent-hover text-white font-mono text-xs font-bold tracking-wide flex items-center space-x-2 transition-all shadow-xl hover:shadow-atlas-accent/20"
                >
                  <span>Plan a Mars Mission</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <Link
                  to="/map"
                  className="px-7 py-3.5 bg-atlas-surface/90 hover:bg-atlas-elevated border border-atlas-border text-atlas-text font-mono text-xs font-semibold tracking-wide transition-colors shadow-md"
                >
                  Explore the Platform
                </Link>
              </div>
            </div>

            {/* Right Hero Visual: Authentic UI Mockup Card (Reference Image 1 Composition) */}
            <div className="lg:col-span-6">
              <div className="relative bg-atlas-surface border border-atlas-border p-4 sm:p-6 shadow-2xl backdrop-blur-md space-y-4">
                {/* Window Chrome Header */}
                <div className="flex items-center justify-between border-b border-atlas-border pb-3">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-atlas-border" />
                    <span className="w-2.5 h-2.5 rounded-full bg-atlas-border" />
                    <span className="w-2.5 h-2.5 rounded-full bg-atlas-border" />
                    <span className="text-[11px] font-mono font-bold text-atlas-text ml-2">
                      MARTIAN MAP — ATLAS INTELLIGENCE
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 bg-atlas-elevated border border-atlas-border text-atlas-accent font-bold">
                    DEMO: MARSWALK-001
                  </span>
                </div>

                {/* Simulated Geospatial Viewport */}
                <div className="h-64 sm:h-72 bg-atlas-bg border border-atlas-border relative overflow-hidden flex items-center justify-center">
                  <div className="absolute inset-0 bg-[radial-gradient(#223A4E_1px,transparent_1px)] [background-size:20px_20px] opacity-40" />

                  {/* Waypoint Traversal Line Overlay */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none">
                    <path
                      d="M 60 190 Q 150 140 240 160 T 420 80"
                      fill="none"
                      stroke="var(--atlas-accent)"
                      strokeWidth="3"
                      strokeDasharray="6 4"
                    />
                    <circle cx="60" cy="190" r="6" fill="var(--atlas-teal)" />
                    <circle cx="160" cy="148" r="4" fill="white" />
                    <circle cx="260" cy="155" r="4" fill="white" />
                    <circle cx="420" cy="80" r="6" fill="var(--atlas-accent)" />
                  </svg>

                  {/* Floating Telemetry Badge Overlays */}
                  <div className="absolute top-4 left-4 p-3 bg-atlas-surface/90 border border-atlas-border shadow-lg space-y-1 font-mono text-[11px]">
                    <div className="text-[10px] text-atlas-muted uppercase flex items-center space-x-1">
                      <BarChart3 className="w-3 h-3 text-atlas-teal" />
                      <span>Mission Analytics</span>
                    </div>
                    <div className="text-xl font-bold font-mono text-atlas-text">88.5%</div>
                    <div className="text-[10px] text-atlas-muted">Fleet Utilization</div>
                  </div>

                  <div className="absolute bottom-4 right-4 p-3 bg-atlas-surface/90 border border-atlas-border shadow-lg space-y-1 font-mono text-[11px]">
                    <div className="text-[10px] text-atlas-teal uppercase flex items-center space-x-1">
                      <CheckCircle className="w-3 h-3 text-atlas-teal" />
                      <span>EVA Feasibility</span>
                    </div>
                    <div className="text-sm font-bold text-atlas-teal">FEASIBLE</div>
                    <div className="text-[10px] text-atlas-muted">Return Margin: 48 min</div>
                  </div>
                </div>

                {/* Plan Metrics Row */}
                <div className="grid grid-cols-3 gap-3 text-xs font-mono pt-1">
                  <div className="p-2.5 bg-atlas-elevated border border-atlas-border">
                    <div className="text-[10px] text-atlas-muted uppercase">Traverse</div>
                    <div className="font-bold text-atlas-text text-sm mt-0.5">4.14 km</div>
                  </div>
                  <div className="p-2.5 bg-atlas-elevated border border-atlas-border">
                    <div className="text-[10px] text-atlas-muted uppercase">Duration</div>
                    <div className="font-bold text-atlas-text text-sm mt-0.5">129 min</div>
                  </div>
                  <div className="p-2.5 bg-atlas-elevated border border-atlas-border">
                    <div className="text-[10px] text-atlas-muted uppercase">Max Incline</div>
                    <div className="font-bold text-atlas-accent text-sm mt-0.5">3.8°</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 2: NASA DATASETS INTEGRATION STRIP
          ========================================================================= */}
      <section className="bg-atlas-surface/60 border-b border-atlas-border py-12 px-6 sm:px-10 lg:px-16">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 lg:gap-8 font-mono text-xs">
            <div className="p-4 bg-atlas-surface border border-atlas-border space-y-1.5">
              <div className="flex items-center space-x-2 text-atlas-accent">
                <Database className="w-4 h-4" />
                <span className="font-bold uppercase tracking-wider text-[11px]">5 NASA Missions</span>
              </div>
              <div className="text-base font-bold text-atlas-text">Integrated PDS</div>
              <div className="text-[11px] text-atlas-muted">MGS, MRO, Odyssey, MSL, M2020</div>
            </div>

            <div className="p-4 bg-atlas-surface border border-atlas-border space-y-1.5">
              <div className="flex items-center space-x-2 text-atlas-teal">
                <Mountain className="w-4 h-4" />
                <span className="font-bold uppercase tracking-wider text-[11px]">MOLA MEGDR</span>
              </div>
              <div className="text-base font-bold text-atlas-text">128 px/deg Grid</div>
              <div className="text-[11px] text-atlas-muted">Precision laser altimetry datum</div>
            </div>

            <div className="p-4 bg-atlas-surface border border-atlas-border space-y-1.5">
              <div className="flex items-center space-x-2 text-atlas-amber">
                <Target className="w-4 h-4" />
                <span className="font-bold uppercase tracking-wider text-[11px]">Science Targets</span>
              </div>
              <div className="text-base font-bold text-atlas-text">Cataloged Outcrops</div>
              <div className="text-[11px] text-atlas-muted">Carbonates, clays, delta scarps</div>
            </div>

            <div className="p-4 bg-atlas-surface border border-atlas-border space-y-1.5">
              <div className="flex items-center space-x-2 text-atlas-blue">
                <Activity className="w-4 h-4" />
                <span className="font-bold uppercase tracking-wider text-[11px]">Deterministic</span>
              </div>
              <div className="text-base font-bold text-atlas-text">EVA Safety Margins</div>
              <div className="text-[11px] text-atlas-muted">Metabolic &amp; slope boundaries</div>
            </div>

            <div className="p-4 bg-atlas-surface border border-atlas-border space-y-1.5 col-span-2 sm:col-span-1">
              <div className="flex items-center space-x-2 text-atlas-teal">
                <Shield className="w-4 h-4" />
                <span className="font-bold uppercase tracking-wider text-[11px]">100% Verified</span>
              </div>
              <div className="text-base font-bold text-atlas-text">Audit Provenance</div>
              <div className="text-[11px] text-atlas-muted">Cryptographic event ledger</div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 3: PRIMARY CAPABILITY MATRIX (Spacious 2-Column Grid)
          ========================================================================= */}
      <section className="py-24 px-6 sm:px-10 lg:px-16 max-w-7xl mx-auto space-y-16">
        <div className="space-y-4 max-w-2xl">
          <div className="text-xs font-mono text-atlas-accent tracking-widest uppercase font-semibold">
            Platform Capabilities
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold font-display text-atlas-text tracking-tight">
            Engineered for High-Consequence Planetary Exploration
          </h2>
          <p className="text-base text-atlas-muted leading-relaxed">
            Every layer of the platform is designed around authentic Martian conditions—from the physics of
            bipedal walking on loose regolith to orbital line-of-sight relays.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10">
          {/* Card 1: Geospatial Navigation */}
          <div className="p-8 bg-atlas-surface border border-atlas-border space-y-4 hover:border-atlas-border-light transition-colors">
            <div className="w-10 h-10 bg-atlas-elevated border border-atlas-border flex items-center justify-center text-atlas-accent">
              <Compass className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold font-display text-atlas-text">
              Topographic Pathfinding &amp; Hazard Avoidance
            </h3>
            <p className="text-sm text-atlas-muted leading-relaxed">
              Computes optimal traverses across Martian terrain using A* cost-gradient pathfinding.
              Evaluates slope steepness against Tobler's hiking function adjusted for Martian gravity,
              detecting scarps, boulder fields, and excessive energy expenditure corridors.
            </p>
            <div className="pt-2 text-xs font-mono text-atlas-teal">
              NASA MOLA MEGDR 128 px/deg · Slope Cutoff: 15° Nominal
            </div>
          </div>

          {/* Card 2: Multi-Agent Field Operations */}
          <div className="p-8 bg-atlas-surface border border-atlas-border space-y-4 hover:border-atlas-border-light transition-colors">
            <div className="w-10 h-10 bg-atlas-elevated border border-atlas-border flex items-center justify-center text-atlas-teal">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold font-display text-atlas-text">
              Multi-Agent Fleet Coordination
            </h3>
            <p className="text-sm text-atlas-muted leading-relaxed">
              Synchronizes autonomous scouts, robotic science platforms, communication mules, and astronaut
              EVAs. Enforces capability constraints—ensuring science targets requiring rock-coring drills or
              Raman spectroscopy are assigned exclusively to equipped rovers.
            </p>
            <div className="pt-2 text-xs font-mono text-atlas-teal">
              Dynamic Role Allocation · Capability Match Matrix
            </div>
          </div>

          {/* Card 3: Deterministic Digital Twin & Replay */}
          <div className="p-8 bg-atlas-surface border border-atlas-border space-y-4 hover:border-atlas-border-light transition-colors">
            <div className="w-10 h-10 bg-atlas-elevated border border-atlas-border flex items-center justify-center text-atlas-blue">
              <RotateCcw className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold font-display text-atlas-text">
              Deterministic Simulation &amp; Mission Replay
            </h3>
            <p className="text-sm text-atlas-muted leading-relaxed">
              Every telemetry packet, hazard detection event, and command transmission is cryptographically
              hashed into an append-only event ledger. Mission controllers can replay any historical traverse
              at exact time indexes with bit-for-bit mathematical reproducibility.
            </p>
            <div className="pt-2 text-xs font-mono text-atlas-teal">
              SHA-256 Event Sourcing · Immutable Audit Chain
            </div>
          </div>

          {/* Card 4: Environmental Telemetry & Comms */}
          <div className="p-8 bg-atlas-surface border border-atlas-border space-y-4 hover:border-atlas-border-light transition-colors">
            <div className="w-10 h-10 bg-atlas-elevated border border-atlas-border flex items-center justify-center text-atlas-amber">
              <Radio className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold font-display text-atlas-text">
              Diurnal Weather &amp; Orbital Comms Relay
            </h3>
            <p className="text-sm text-atlas-muted leading-relaxed">
              Models diurnal temperature swings (-88°C to -18°C), atmospheric pressure, dust optical depth (Tau),
              and solar radiation flux. Calculates real-time line-of-sight communication windows with the
              Mars Reconnaissance Orbiter (MRO) constellation and handles store-and-forward telemetry queuing.
            </p>
            <div className="pt-2 text-xs font-mono text-atlas-teal">
              MEDA Meteorological Suite · Keplerian Orbital Propagation
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 4: DEMO SHOWCASE — MARSWALK-001 (Flagship Recon)
          ========================================================================= */}
      <section className="bg-atlas-surface/40 border-y border-atlas-border py-24 px-6 sm:px-10 lg:px-16">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-3">
              <div className="text-xs font-mono text-atlas-accent tracking-widest uppercase font-semibold">
                Flagship Benchmark Scenario
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold font-display text-atlas-text tracking-tight">
                MARSWALK-001: Jezero Delta &amp; Séítah Recon
              </h2>
              <p className="text-base text-atlas-muted max-w-2xl leading-relaxed">
                Experience an end-to-end multi-agent sortie departing Octavia E. Butler landing site,
                sampling olivine cumulates at South Séítah, and navigating the Kodiak Butte delta scarp.
              </p>
            </div>

            <Link
              to="/map?demo=marswalk-001&tour=true"
              className="px-6 py-3 bg-atlas-accent hover:bg-atlas-accent-hover text-white font-mono text-xs font-bold flex items-center space-x-2 shrink-0 transition-all shadow-lg"
            >
              <span>Launch Interactive Walkthrough</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 bg-atlas-surface border border-atlas-border space-y-2 font-mono">
              <div className="text-xs text-atlas-muted uppercase">Start Datum</div>
              <div className="text-lg font-bold text-atlas-text">Octavia Butler Base</div>
              <div className="text-xs text-atlas-teal">18.4447°N, 77.4508°E</div>
            </div>

            <div className="p-6 bg-atlas-surface border border-atlas-border space-y-2 font-mono">
              <div className="text-xs text-atlas-muted uppercase">Science Target 1</div>
              <div className="text-lg font-bold text-atlas-text">South Séítah Olivine</div>
              <div className="text-xs text-atlas-amber">Priority 94 · Carbonate Outcrop</div>
            </div>

            <div className="p-6 bg-atlas-surface border border-atlas-border space-y-2 font-mono">
              <div className="text-xs text-atlas-muted uppercase">Science Target 2</div>
              <div className="text-lg font-bold text-atlas-text">Kodiak Butte Delta</div>
              <div className="text-xs text-atlas-blue">Delta Front Sandstone</div>
            </div>

            <div className="p-6 bg-atlas-surface border border-atlas-border space-y-2 font-mono">
              <div className="text-xs text-atlas-muted uppercase">Destination Base</div>
              <div className="text-lg font-bold text-atlas-text">Delta Scarp Base Camp</div>
              <div className="text-xs text-atlas-teal">18.4400°N, 77.3950°E</div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 5: SYSTEM INTEGRITY & SCIENTIFIC RIGOR
          ========================================================================= */}
      <section className="py-24 px-6 sm:px-10 lg:px-16 max-w-7xl mx-auto space-y-14">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="text-xs font-mono text-atlas-accent tracking-widest uppercase font-semibold">
            Data Architecture &amp; Governance
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold font-display text-atlas-text tracking-tight">
            Scientific Truthfulness &amp; Complete Provenance
          </h2>
          <p className="text-base text-atlas-muted leading-relaxed">
            The platform makes zero compromises on scientific accuracy. Every metric is backed by
            verifiable NASA planetary instruments.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-8 bg-atlas-surface border border-atlas-border space-y-3">
            <div className="flex items-center space-x-2 text-atlas-teal">
              <CheckCircle className="w-5 h-5" />
              <h3 className="text-lg font-bold font-display text-atlas-text">Zero Mock Data</h3>
            </div>
            <p className="text-sm text-atlas-muted leading-relaxed">
              Topography, coordinates, rover telemetry, and mission logs are driven by canonical NASA
              datasets or calibrated physical models. If an external telemetry service is unavailable,
              the interface explicitly marks the data mode as benchmark rather than fabricating fake telemetry.
            </p>
          </div>

          <div className="p-8 bg-atlas-surface border border-atlas-border space-y-3">
            <div className="flex items-center space-x-2 text-atlas-accent">
              <FileCheck className="w-5 h-5" />
              <h3 className="text-lg font-bold font-display text-atlas-text">Cryptographic Audit Ledger</h3>
            </div>
            <p className="text-sm text-atlas-muted leading-relaxed">
              Every route plan, mission score, safety check, and teleoperation order is serialized with a
              SHA-256 hash linked to the previous block. This creates an unalterable operational record for
              independent verification and post-mission analysis.
            </p>
          </div>

          <div className="p-8 bg-atlas-surface border border-atlas-border space-y-3">
            <div className="flex items-center space-x-2 text-atlas-blue">
              <GitBranch className="w-5 h-5" />
              <h3 className="text-lg font-bold font-display text-atlas-text">Flight Director Authority</h3>
            </div>
            <p className="text-sm text-atlas-muted leading-relaxed">
              Autonomous copilots and AI optimizers provide advisory proposals only. Safety-critical
              operations, such as replanning past a newly detected scarp hazard, require explicit authorization
              through role-based flight director gates.
            </p>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 6: READY TO EXPLORE CTA BANNER
          ========================================================================= */}
      <section className="bg-atlas-surface border-t border-atlas-border py-20 px-6 sm:px-10 lg:px-16 text-center">
        <div className="max-w-3xl mx-auto space-y-6">
          <h2 className="text-3xl sm:text-4xl font-extrabold font-display text-atlas-text tracking-tight">
            Ready to Begin Planetary Mission Operations?
          </h2>
          <p className="text-base text-atlas-muted leading-relaxed">
            Launch the interactive map to construct a custom Jezero Crater traverse, inspect geological
            outcrops, or evaluate autonomous multi-agent coordination.
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/map"
              className="px-8 py-3.5 bg-atlas-accent hover:bg-atlas-accent-hover text-white font-mono text-xs font-bold tracking-wide transition-all shadow-xl"
            >
              Open Interactive Mars Map
            </Link>
            <Link
              to="/operations"
              className="px-8 py-3.5 bg-atlas-elevated hover:bg-atlas-elevated/80 border border-atlas-border text-atlas-text font-mono text-xs font-semibold tracking-wide transition-colors"
            >
              Planetary Operations Console
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
