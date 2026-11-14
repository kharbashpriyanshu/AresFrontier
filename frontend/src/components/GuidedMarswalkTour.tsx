import React, { useState } from "react";
import {
  ChevronRight,
  ChevronLeft,
  X,
  Compass,
  Shield,
  Target,
  Play,
  Sparkles,
  Mountain,
  Radio,
  CheckCircle2,
  Navigation,
  FileText,
  RotateCcw,
} from "lucide-react";

export interface GuidedTourStep {
  stepNumber: number;
  title: string;
  subtitle: string;
  description: string;
  badge: string;
  badgeColor: string;
  metrics: { label: string; val: string }[];
  icon: React.ReactNode;
}

export interface GuidedMarswalkTourProps {
  onStepChange: (step: number) => void;
  onClose: () => void;
  onLaunchEvaPlayback?: () => void;
  onOpenRoutePlanner?: () => void;
  onOpenMissionStory?: () => void;
}

export const TOUR_STEPS: GuidedTourStep[] = [
  {
    stepNumber: 1,
    title: "1. Mission Briefing & Martian Weather",
    subtitle: "Octavia E. Butler Base • Sol 100 Ingress",
    description:
      "Welcome to Jezero Crater. Mars 2020 landing site (18.4447°N, 77.4508°E). MEDA environmental sensors confirm surface pressure at 610 Pa and ambient diurnal temperature of -62°C. MSL RAD confirms baseline surface radiation of 0.67 mSv/sol (Quiet Sun).",
    badge: "MEDA / RAD LIVE",
    badgeColor: "bg-amber-950/80 text-amber-300 border-amber-700",
    metrics: [
      { label: "Surface Air", val: "-62°C (211 K)" },
      { label: "Atm Pressure", val: "610 Pa (6.1 mbar)" },
      { label: "RAD Dosimeter", val: "0.67 mSv/sol" },
      { label: "Solar Alert", val: "Quiet (Safe)" },
    ],
    icon: <Compass className="w-4 h-4 text-amber-400" />,
  },
  {
    stepNumber: 2,
    title: "2. MOLA Altimetry & Scarp Hazards",
    subtitle: "Topographic Analysis • Delta Front Cliff",
    description:
      "MOLA laser altimetry reveals the 60m vertical Jezero Delta Scarp. Direct traversal incurs an unacceptable 26.5° slope and rollover risk. Safety Invariant S1 automatically geofences a 150m standoff corridor around the cliff brink.",
    badge: "MOLA 128 PPD",
    badgeColor: "bg-blue-950/80 text-blue-300 border-blue-700",
    metrics: [
      { label: "Scarp Drop", val: "60 m vertical" },
      { label: "Direct Incline", val: "26.5° (Hazard)" },
      { label: "Safety Margin", val: ">150 m buffer" },
      { label: "Invariant S1", val: "100% Enforced" },
    ],
    icon: <Mountain className="w-4 h-4 text-blue-400" />,
  },
  {
    stepNumber: 3,
    title: "3. CRISM Hyperspectral Target Scan",
    subtitle: "Mineralogy Mapping • MEPAG Goals I & II",
    description:
      "Orbital CRISM hyperspectral observations detect Fe/Mg-smectites (1.0 & 2.3 μm absorption) and Mg-carbonate units along the delta front. These fluvio-lacustrine sedimentary rocks hold the highest biosignature preservation potential on Mars.",
    badge: "CRISM / MRO PDS",
    badgeColor: "bg-purple-950/80 text-purple-300 border-purple-700",
    metrics: [
      { label: "Spectral Bands", val: "1.0 & 2.3 μm" },
      { label: "Primary Minerals", val: "Smectites & Carbonates" },
      { label: "MEPAG Focus", val: "Goal I: Ancient Life" },
      { label: "Preservation", val: "Highest Potential" },
    ],
    icon: <Target className="w-4 h-4 text-purple-400" />,
  },
  {
    stepNumber: 4,
    title: "4. A* Cost-Gradient Hazard Avoidance",
    subtitle: "Autonomous Pathfinding • Obstacle Bypass",
    description:
      "Our 2D cost-gradient A* pathfinder detects scarp intersection and computes a low-gradient detour. The route safely bends through an eroded valley breach, preserving a >100m standoff margin while keeping average slope under 4.2°.",
    badge: "A* ALGORITHM OPTIMAL",
    badgeColor: "bg-emerald-950/80 text-emerald-300 border-emerald-700",
    metrics: [
      { label: "Detour Corridor", val: "Valley Breach" },
      { label: "Max Traversal Slope", val: "4.2° (Safe)" },
      { label: "Total Distance", val: "4.2 km" },
      { label: "Rollover Probability", val: "0.0%" },
    ],
    icon: <Shield className="w-4 h-4 text-emerald-400" />,
  },
  {
    stepNumber: 5,
    title: "5. Live Astronaut Bioenergetics & Relay",
    subtitle: "0.38g Tobler Gait • MRO Orbiter Pass",
    description:
      "Traverse execution synchronized with MRO X-band pass (42 Mbps return link). Astronaut suit metabolic load modeled at 230W under 0.38g gravity, strictly preserving the mandatory NASA 30-minute emergency return reserve (Invariant S3).",
    badge: "100% INVARIANTS VERIFIED",
    badgeColor: "bg-cyan-950/80 text-cyan-300 border-cyan-700",
    metrics: [
      { label: "Metabolic Rate", val: "230 W (0.38g)" },
      { label: "O₂ Consumption", val: "0.058 kg/hr" },
      { label: "MRO Comm Pass", val: "42 Mbps X-Band" },
      { label: "Emergency Reserve", val: "30 min Margin" },
    ],
    icon: <Play className="w-4 h-4 text-cyan-400" />,
  },
];

export const GuidedMarswalkTour: React.FC<GuidedMarswalkTourProps> = ({
  onStepChange,
  onClose,
  onLaunchEvaPlayback,
  onOpenRoutePlanner,
  onOpenMissionStory,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isFinished, setIsFinished] = useState<boolean>(false);

  const step = TOUR_STEPS[currentStep];

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      const next = currentStep + 1;
      setCurrentStep(next);
      onStepChange(next);
    } else {
      setIsFinished(true);
    }
  };

  const handlePrev = () => {
    if (isFinished) {
      setIsFinished(false);
      return;
    }
    if (currentStep > 0) {
      const prev = currentStep - 1;
      setCurrentStep(prev);
      onStepChange(prev);
    }
  };

  const handleJumpToStep = (index: number) => {
    setIsFinished(false);
    setCurrentStep(index);
    onStepChange(index);
  };

  return (
    <div className="bg-atlas-surface/95 backdrop-blur-md border border-atlas-border text-atlas-text shadow-2xl p-4 font-mono text-xs max-w-xl w-full space-y-3 pointer-events-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-atlas-border pb-2">
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 rounded-full bg-atlas-accent animate-ping" />
          <span className="font-bold uppercase tracking-wider text-sm text-atlas-text flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-atlas-accent" />
            NASA Space Apps Guided Marswalk Tour
          </span>
          <span
            className={`px-2 py-0.5 rounded border text-[10px] font-bold ${
              isFinished
                ? "bg-emerald-950/80 text-emerald-300 border-emerald-700"
                : step.badgeColor
            }`}
          >
            {isFinished ? "100% READY" : step.badge}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-atlas-elevated text-atlas-muted hover:text-atlas-text transition-colors"
          title="Exit Tour"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {isFinished ? (
        /* Completion View: Mission Authorized & Ready for Execution */
        <div className="space-y-3 animate-fadeIn">
          {/* Status Banner */}
          <div className="p-3 bg-emerald-950/40 border border-emerald-700/60 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <span className="font-bold text-white text-xs block">
                  MISSION AUTHORIZED • READY FOR EXECUTION
                </span>
                <span className="text-[10px] text-emerald-300">
                  All 8 NASA safety invariants verified • Zero cliff hazards on path
                </span>
              </div>
            </div>
            <span className="px-2 py-0.5 bg-emerald-900 border border-emerald-500 text-emerald-200 text-[9px] font-bold">
              FLIGHT READY
            </span>
          </div>

          <p className="text-[11px] text-atlas-muted font-sans leading-relaxed">
            You have completed the guided briefing. Select an operational mode below to explore the mission further:
          </p>

          {/* Action Choice Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              onClick={() => {
                if (onLaunchEvaPlayback) onLaunchEvaPlayback();
              }}
              className="p-2.5 bg-atlas-elevated hover:bg-atlas-accent/20 border border-atlas-border hover:border-atlas-accent text-left transition-all group shadow-sm"
            >
              <div className="flex items-center space-x-1.5 text-atlas-accent font-bold mb-1">
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Launch EVA</span>
              </div>
              <span className="text-[10px] text-atlas-muted block group-hover:text-atlas-text leading-tight">
                Watch real-time animated traverse with live suit bioenergetics.
              </span>
            </button>

            <button
              onClick={() => {
                if (onOpenRoutePlanner) onOpenRoutePlanner();
              }}
              className="p-2.5 bg-atlas-elevated hover:bg-cyan-950/40 border border-atlas-border hover:border-cyan-600 text-left transition-all group shadow-sm"
            >
              <div className="flex items-center space-x-1.5 text-cyan-400 font-bold mb-1">
                <Navigation className="w-3.5 h-3.5" />
                <span>Route Planner</span>
              </div>
              <span className="text-[10px] text-atlas-muted block group-hover:text-atlas-text leading-tight">
                Inspect 4 waypoints, alter stops, or synthesize Pareto alternatives.
              </span>
            </button>

            <button
              onClick={() => {
                if (onOpenMissionStory) onOpenMissionStory();
              }}
              className="p-2.5 bg-atlas-elevated hover:bg-purple-950/40 border border-atlas-border hover:border-purple-600 text-left transition-all group shadow-sm"
            >
              <div className="flex items-center space-x-1.5 text-purple-400 font-bold mb-1">
                <FileText className="w-3.5 h-3.5" />
                <span>Mission Story</span>
              </div>
              <span className="text-[10px] text-atlas-muted block group-hover:text-atlas-text leading-tight">
                Read scientific rationale and SHA-256 cryptographic audit chain.
              </span>
            </button>
          </div>

          {/* Bottom Controls */}
          <div className="flex items-center justify-between pt-1 border-t border-atlas-border">
            <button
              onClick={() => {
                setIsFinished(false);
                setCurrentStep(0);
                onStepChange(0);
              }}
              className="px-2.5 py-1 text-atlas-muted hover:text-atlas-text flex items-center space-x-1 text-[11px] transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Replay Tour</span>
            </button>

            <button
              onClick={onClose}
              className="px-3.5 py-1.5 bg-atlas-surface hover:bg-atlas-elevated border border-atlas-border text-atlas-text text-[11px] font-semibold transition-colors"
            >
              Close &amp; Explore Freely
            </button>
          </div>
        </div>
      ) : (
        /* Normal Step-by-Step Tour View */
        <>
          {/* Step Indicators */}
          <div className="grid grid-cols-5 gap-1.5 pt-1">
            {TOUR_STEPS.map((s, idx) => (
              <button
                key={s.stepNumber}
                onClick={() => handleJumpToStep(idx)}
                className={`py-1 text-center border transition-all text-[10px] ${
                  idx === currentStep
                    ? "bg-atlas-accent text-white font-bold border-atlas-accent shadow-sm"
                    : idx < currentStep
                    ? "bg-atlas-elevated text-atlas-teal border-atlas-border font-semibold"
                    : "bg-atlas-surface text-atlas-muted border-atlas-border hover:bg-atlas-elevated"
                }`}
              >
                {idx < currentStep ? "✓ Step " + (idx + 1) : "Step " + (idx + 1)}
              </button>
            ))}
          </div>

          {/* Content Card */}
          <div className="p-3 bg-atlas-elevated border border-atlas-border space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {step.icon}
                <span className="font-bold text-atlas-text text-sm">{step.title}</span>
              </div>
              <span className="text-[10px] text-atlas-muted">{step.subtitle}</span>
            </div>

            <p className="text-atlas-muted text-[11px] leading-relaxed font-sans">
              {step.description}
            </p>

            {/* Inline Scientific Telemetry Chips */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1 border-t border-atlas-border/60">
              {step.metrics.map((m, mIdx) => (
                <div
                  key={mIdx}
                  className="bg-atlas-surface/80 p-1.5 border border-atlas-border text-[10px]"
                >
                  <span className="text-atlas-muted block text-[9px]">{m.label}:</span>
                  <span className="font-bold text-atlas-text">{m.val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Controls & Nav */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center space-x-2">
              <button
                onClick={handlePrev}
                disabled={currentStep === 0}
                className="px-2.5 py-1.5 bg-atlas-surface hover:bg-atlas-elevated border border-atlas-border text-atlas-text disabled:opacity-40 flex items-center space-x-1 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>

              <button
                onClick={handleNext}
                className="px-3.5 py-1.5 bg-atlas-accent hover:brightness-110 text-white font-bold flex items-center space-x-1 shadow-sm transition-all"
              >
                <span>
                  {currentStep === TOUR_STEPS.length - 1
                    ? "Finish Tour & Options"
                    : "Next Step"}
                </span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center space-x-3 text-[10px] text-atlas-muted">
              <span className="flex items-center space-x-1">
                <Radio className="w-3 h-3 text-atlas-teal" />
                <span>MGS • MRO • M2020</span>
              </span>
              <span className="text-atlas-border">|</span>
              <span className="font-bold text-atlas-text">{currentStep + 1} of 5</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
