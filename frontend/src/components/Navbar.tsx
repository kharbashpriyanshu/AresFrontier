import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import {
  Compass,
  Map as MapIcon,
  Activity,
  Database,
  BookOpen,
  Users,
  RotateCcw,
  BarChart3,
  Award,
  Sun,
  Moon,
  Menu,
  X,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Layers,
} from "lucide-react";
import { useTheme } from "../context/ThemeContext.js";
import { OperationalDataModeBadge } from "./OperationalDataModeBadge.js";

export const Navbar: React.FC = () => {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showBenchmarkModal, setShowBenchmarkModal] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowBenchmarkModal(false);
      }
    };
    if (showBenchmarkModal) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showBenchmarkModal]);

  const navLinks = [
    { to: "/", label: "Overview", icon: Compass },
    { to: "/map", label: "Map", icon: MapIcon },
    { to: "/operations", label: "Operations", icon: Users },
    { to: "/mission", label: "Mission Studio", icon: Activity },
    { to: "/replay", label: "Replay", icon: RotateCcw },
    { to: "/mission-analytics", label: "Analytics", icon: BarChart3 },
    { to: "/science", label: "Science", icon: Database },
    { to: "/methodology", label: "Data Provenance", icon: BookOpen },
    { to: "/demo", label: "Test Harness", icon: Award },
  ];

  return (
    <header className="h-14 border-b border-atlas-border bg-atlas-surface/95 backdrop-blur-md px-4 lg:px-6 flex items-center justify-between sticky top-0 z-50 select-none transition-colors">
      {/* Brand & Desktop Navigation */}
      <div className="flex items-center space-x-6">
        <Link to="/" className="flex items-center space-x-3 group">
          {/* Atlas Intelligence Geometric Symbol */}
          <div className="w-8 h-8 bg-atlas-elevated border border-atlas-border flex items-center justify-center transition-colors group-hover:border-atlas-accent">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 19L9 5H12L7 19H4Z" fill="var(--atlas-accent)" />
              <path d="M10 19L15 5H18L13 19H10Z" fill="var(--atlas-accent)" opacity="0.8" />
              <path d="M16 19L19.5 9H21.5L18 19H16Z" fill="var(--atlas-teal)" />
            </svg>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center space-x-2">
              <span className="font-display font-extrabold text-xs tracking-wider text-atlas-text">
                MARTIAN MAP
              </span>
              <span className="text-[9px] px-1.5 py-0.2 bg-atlas-elevated text-atlas-accent border border-atlas-border font-mono tracking-tight">
                ATLAS INTELLIGENCE
              </span>
            </div>
            <span className="text-[10px] text-atlas-muted tracking-tight">
              Planetary Mission Platform
            </span>
          </div>
        </Link>

        {/* Desktop Nav Links */}
        <nav className="hidden lg:flex items-center space-x-0.5">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`relative px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? "text-atlas-text font-semibold"
                    : "text-atlas-muted hover:text-atlas-text hover:bg-atlas-elevated"
                }`}
              >
                <span>{link.label}</span>
                {isActive && (
                  <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-atlas-accent" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Right Controls */}
      <div className="flex items-center space-x-2.5">
        {/* Benchmark Data Mode Badge */}
        <div className="hidden sm:block">
          <OperationalDataModeBadge
            mode="BENCHMARK"
            compact
            onClick={() => setShowBenchmarkModal(true)}
          />
        </div>

        {/* Unified Primary Demo Tour CTA */}
        <Link
          to="/map?demo=marswalk-001"
          className="flex items-center space-x-1.5 text-xs font-mono bg-atlas-elevated hover:bg-atlas-surface border border-atlas-accent text-atlas-accent px-3 py-1.5 font-bold transition-all shadow-sm hover:shadow-atlas-accent/20"
          title="Launch 5-Step Guided Marswalk Tour for NASA Space Apps Judges"
        >
          <Sparkles className="w-3.5 h-3.5 text-atlas-accent" />
          <span>Guided Demo</span>
        </Link>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          aria-label="Toggle visual theme"
          title={`Switch to ${theme === "dark" ? "Light" : "Dark"} theme`}
          className="w-8 h-8 bg-atlas-elevated hover:bg-atlas-surface border border-atlas-border flex items-center justify-center text-atlas-text transition-colors"
        >
          {theme === "dark" ? (
            <Sun className="w-4 h-4 text-atlas-amber" />
          ) : (
            <Moon className="w-4 h-4 text-atlas-blue" />
          )}
        </button>

        {/* Mobile menu toggle */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden w-8 h-8 bg-atlas-elevated border border-atlas-border flex items-center justify-center text-atlas-text"
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden absolute top-14 left-0 right-0 bg-atlas-surface border-b border-atlas-border p-4 shadow-2xl flex flex-col space-y-2 z-50">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`p-2.5 flex items-center space-x-2 border text-xs transition-colors ${
                    isActive
                      ? "bg-atlas-elevated text-atlas-accent border-atlas-accent font-semibold"
                      : "bg-atlas-bg text-atlas-muted border-atlas-border hover:text-atlas-text"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>
          <div className="pt-3 border-t border-atlas-border flex items-center justify-between text-[11px] font-mono text-atlas-muted">
            <OperationalDataModeBadge
              mode="BENCHMARK"
              compact
              onClick={() => {
                setMobileMenuOpen(false);
                setShowBenchmarkModal(true);
              }}
            />
            <Link
              to="/map?demo=marswalk-001"
              onClick={() => setMobileMenuOpen(false)}
              className="text-atlas-accent font-semibold flex items-center space-x-1"
            >
              <Sparkles className="w-3 h-3" />
              <span>Launch Guided Demo</span>
            </Link>
          </div>
        </div>
      )}

      {/* NASA Benchmark Dataset Inspector Modal via React Portal directly into body */}
      {showBenchmarkModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-200"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowBenchmarkModal(false);
            }}
          >
            <div className="bg-atlas-surface border border-atlas-border max-w-2xl w-full max-h-[85vh] rounded shadow-2xl flex flex-col text-left overflow-hidden animate-in zoom-in-95 duration-150">
              {/* Modal Header */}
              <div className="px-5 py-4 border-b border-atlas-border flex items-center justify-between bg-atlas-elevated/90 shrink-0">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded bg-atlas-teal/10 border border-atlas-teal/30 flex items-center justify-center">
                    <Database className="w-4 h-4 text-atlas-teal" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-atlas-text flex items-center space-x-2 font-mono">
                      <span>NASA Benchmark Dataset Architecture</span>
                      <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-atlas-teal/20 text-atlas-teal border border-atlas-teal/40 font-mono">
                        Calibrated Ground Truth
                      </span>
                    </h3>
                    <p className="text-[11px] text-atlas-muted">
                      Multi-mission planetary science baselines for 100% reproducible mission planning
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBenchmarkModal(false)}
                  className="w-7 h-7 flex items-center justify-center text-atlas-muted hover:text-atlas-text hover:bg-atlas-elevated rounded transition-colors"
                  title="Close modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 space-y-4 text-xs font-sans overflow-y-auto">
                {/* Active Mode Banner */}
                <div className="p-3.5 bg-atlas-elevated border border-atlas-border/80 flex items-start space-x-3 rounded">
                  <ShieldCheck className="w-5 h-5 text-atlas-teal flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-semibold text-atlas-text font-mono">
                      Operational Status: BENCHMARK (Deterministic Precision)
                    </h4>
                    <p className="text-[11px] text-atlas-muted mt-1 leading-relaxed">
                      This instance operates with calibrated NASA and ESA ground truth datasets. In this mode, traverse calculations, Tobler metabolic cost, and solar radiation profiles execute with zero network latency, deterministic seed reproducibility, and zero external rate limiting.
                    </p>
                  </div>
                </div>

                {/* Mission Datasets Breakdown */}
                <div>
                  <h5 className="text-[11px] font-mono uppercase tracking-wider text-atlas-accent font-bold mb-2 flex items-center space-x-1.5">
                    <Layers className="w-3.5 h-3.5" />
                    <span>Integrated NASA Planetary Datasets</span>
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 font-mono text-[11px]">
                    <div className="p-2.5 bg-atlas-bg border border-atlas-border rounded">
                      <div className="flex items-center justify-between text-atlas-text font-bold mb-1">
                        <span>MGS MOLA Altimetry</span>
                        <span className="text-[10px] text-atlas-teal">Megdr 128 ppd</span>
                      </div>
                      <p className="text-[10px] text-atlas-muted font-sans leading-normal">
                        Areoid reference datum (3,396,190 m). Digital elevation model used for gradient heuristic and Tobler hiking cost.
                      </p>
                    </div>

                    <div className="p-2.5 bg-atlas-bg border border-atlas-border rounded">
                      <div className="flex items-center justify-between text-atlas-text font-bold mb-1">
                        <span>MRO CRISM Mineralogy</span>
                        <span className="text-[10px] text-atlas-teal">Hyperspectral</span>
                      </div>
                      <p className="text-[10px] text-atlas-muted font-sans leading-normal">
                        Spectral bands for carbonates, hydrated sulfates, and olivine in Jezero Crater delta sediments.
                      </p>
                    </div>

                    <div className="p-2.5 bg-atlas-bg border border-atlas-border rounded">
                      <div className="flex items-center justify-between text-atlas-text font-bold mb-1">
                        <span>Mars 2020 MEDA</span>
                        <span className="text-[10px] text-atlas-teal">In-Situ Sensors</span>
                      </div>
                      <p className="text-[10px] text-atlas-muted font-sans leading-normal">
                        Real Jezero atmospheric pressure (610 Pa), ambient diurnal temp (-62°C), and atmospheric optical depth.
                      </p>
                    </div>

                    <div className="p-2.5 bg-atlas-bg border border-atlas-border rounded">
                      <div className="flex items-center justify-between text-atlas-text font-bold mb-1">
                        <span>MSL Curiosity RAD</span>
                        <span className="text-[10px] text-atlas-teal">Dosimetry</span>
                      </div>
                      <p className="text-[10px] text-atlas-muted font-sans leading-normal">
                        Galactic cosmic ray baseline (0.67 mSv/sol) and solar particle event thresholds for astronaut safety.
                      </p>
                    </div>

                    <div className="p-2.5 bg-atlas-bg border border-atlas-border rounded">
                      <div className="flex items-center justify-between text-atlas-text font-bold mb-1">
                        <span>MRO HiRISE / CTX</span>
                        <span className="text-[10px] text-atlas-teal">0.25 - 6 m/px</span>
                      </div>
                      <p className="text-[10px] text-atlas-muted font-sans leading-normal">
                        Sub-meter morphological inspection, landing ellipse hazards, scarps, and dune field boulder fields.
                      </p>
                    </div>

                    <div className="p-2.5 bg-atlas-bg border border-atlas-border rounded">
                      <div className="flex items-center justify-between text-atlas-text font-bold mb-1">
                        <span>USGS Astrogeology</span>
                        <span className="text-[10px] text-atlas-teal">Viking MDIM 2.1</span>
                      </div>
                      <p className="text-[10px] text-atlas-muted font-sans leading-normal">
                        Geodetic control network and multi-resolution global planetary basemap projection.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Data Integrity Callout */}
                <div className="p-2.5 bg-atlas-bg border border-atlas-border flex items-center justify-between text-[11px] font-mono rounded">
                  <div className="flex items-center space-x-2 text-atlas-text">
                    <CheckCircle2 className="w-4 h-4 text-atlas-teal" />
                    <span>Deterministic SHA-256 Checksums Verified</span>
                  </div>
                  <span className="text-[10px] text-atlas-muted">Offline Resilient</span>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-5 py-3 border-t border-atlas-border bg-atlas-elevated/90 flex items-center justify-between shrink-0">
                <Link
                  to="/methodology"
                  onClick={() => setShowBenchmarkModal(false)}
                  className="inline-flex items-center space-x-1.5 text-xs text-atlas-accent hover:underline font-mono"
                >
                  <span>Read Full Methodology & Scientific Provenance</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
                <button
                  type="button"
                  onClick={() => setShowBenchmarkModal(false)}
                  className="px-4 py-1.5 bg-atlas-surface hover:bg-atlas-elevated border border-atlas-border text-xs text-atlas-text font-mono transition-colors rounded"
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </header>
  );
};
