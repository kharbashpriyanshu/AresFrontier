import React, { useState, useEffect, useRef } from "react";
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
  Menu,
  X,
  ShieldCheck,
  ExternalLink,
  ChevronDown,
} from "lucide-react";
import { OperationalDataModeBadge } from "./OperationalDataModeBadge.js";

export const Navbar: React.FC = () => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toolsDropdownOpen, setToolsDropdownOpen] = useState(false);
  const [showBenchmarkModal, setShowBenchmarkModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowBenchmarkModal(false);
        setToolsDropdownOpen(false);
        setMobileMenuOpen(false);
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setToolsDropdownOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const primaryLinks = [
    { to: "/", label: "Overview", icon: Compass },
    { to: "/map", label: "Map", icon: MapIcon },
    { to: "/operations", label: "Operations", icon: Users },
    { to: "/mission", label: "Mission Studio", icon: Activity },
    { to: "/replay", label: "Replay", icon: RotateCcw },
    { to: "/mission-analytics", label: "Analytics", icon: BarChart3 },
    { to: "/science", label: "Science", icon: Database },
  ];

  const secondaryTools = [
    { to: "/methodology", label: "Data Provenance", icon: BookOpen, desc: "NASA datasets & cryptographic validation" },
    { to: "/demo", label: "Test Harness", icon: Award, desc: "Reproducible evaluation testbeds & verification" },
  ];

  const isToolActive = secondaryTools.some((t) => location.pathname === t.to);

  return (
    <header className="h-16 border-b border-atlas-border bg-atlas-surface/95 backdrop-blur-md px-4 lg:px-8 flex items-center justify-between sticky top-0 z-50 select-none">
      {/* Brand & Desktop Navigation */}
      <div className="flex items-center space-x-8">
        <Link to="/" className="flex items-center space-x-3 group">
          {/* Atlas Intelligence Geometric Symbol */}
          <div className="w-9 h-9 bg-atlas-elevated border border-atlas-border flex items-center justify-center transition-colors group-hover:border-atlas-accent">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 19L9 5H12L7 19H4Z" fill="var(--atlas-accent)" />
              <path d="M10 19L15 5H18L13 19H10Z" fill="var(--atlas-accent)" opacity="0.8" />
              <path d="M16 19L19.5 9H21.5L18 19H16Z" fill="var(--atlas-teal)" />
            </svg>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center space-x-2">
              <span className="font-display font-bold text-sm tracking-wide text-atlas-text">
                ARES FRONTIER
              </span>
              <span className="text-[10px] px-1.5 py-0.2 bg-atlas-elevated text-atlas-accent border border-atlas-border font-mono tracking-tight font-semibold">
                ATLAS INTELLIGENCE
              </span>
            </div>
            <span className="text-[11px] text-atlas-muted tracking-tight">
              Planetary Mission Platform
            </span>
          </div>
        </Link>

        {/* Desktop Nav Links */}
        <nav className="hidden lg:flex items-center space-x-1 font-sans">
          {primaryLinks.map((link) => {
            const isActive = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`relative px-3 py-2 text-[13px] font-medium transition-colors ${
                  isActive
                    ? "text-atlas-text font-semibold"
                    : "text-atlas-muted hover:text-atlas-text hover:bg-atlas-elevated/60"
                }`}
              >
                <span>{link.label}</span>
                {isActive && (
                  <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-atlas-accent" />
                )}
              </Link>
            );
          })}

          {/* Tools Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setToolsDropdownOpen(!toolsDropdownOpen)}
              className={`relative px-3 py-2 text-[13px] font-medium transition-colors flex items-center space-x-1.5 ${
                isToolActive
                  ? "text-atlas-text font-semibold"
                  : "text-atlas-muted hover:text-atlas-text hover:bg-atlas-elevated/60"
              }`}
            >
              <span>Tools</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${toolsDropdownOpen ? "rotate-180" : ""}`} />
              {isToolActive && (
                <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-atlas-accent" />
              )}
            </button>

            {toolsDropdownOpen && (
              <div className="absolute left-0 top-full mt-1.5 w-64 bg-atlas-surface border border-atlas-border shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-1">
                {secondaryTools.map((tool) => {
                  const isActive = location.pathname === tool.to;
                  const Icon = tool.icon;
                  return (
                    <Link
                      key={tool.to}
                      to={tool.to}
                      onClick={() => setToolsDropdownOpen(false)}
                      className={`flex items-start space-x-3 p-2.5 transition-colors ${
                        isActive ? "bg-atlas-elevated text-atlas-accent font-semibold" : "text-atlas-text hover:bg-atlas-elevated/60"
                      }`}
                    >
                      <Icon className="w-4 h-4 text-atlas-accent shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-semibold">{tool.label}</div>
                        <div className="text-[11px] text-atlas-muted">{tool.desc}</div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </nav>
      </div>

      {/* Right Operational Status Hub */}
      <div className="flex items-center space-x-3">
        {/* Benchmark Data Badge Button */}
        <button
          onClick={() => setShowBenchmarkModal(true)}
          className="bg-atlas-elevated/80 hover:bg-atlas-elevated border border-atlas-teal/30 hover:border-atlas-teal px-3 py-1.5 text-xs font-mono text-atlas-teal flex items-center space-x-2 transition-all shadow-sm group"
          title="Inspect verified NASA datasets and active benchmark mission"
        >
          <span className="w-2 h-2 rounded-full bg-atlas-teal group-hover:animate-ping" />
          <span className="font-semibold tracking-wide">BENCHMARK DATA: MARSWALK-001</span>
        </button>

        {/* Tactical Data Mode Badge */}
        <OperationalDataModeBadge />

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden p-2 text-atlas-muted hover:text-atlas-text hover:bg-atlas-elevated transition-colors border border-atlas-border"
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-x-0 top-16 bg-atlas-surface border-b border-atlas-border shadow-2xl z-40 p-4 space-y-2 max-h-[85vh] overflow-y-auto">
          {[...primaryLinks, ...secondaryTools].map((link) => {
            const isActive = location.pathname === link.to;
            const Icon = link.icon;
            return (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center space-x-3 px-3 py-2.5 text-xs font-mono transition-colors ${
                  isActive
                    ? "bg-atlas-accent text-white font-bold"
                    : "text-atlas-text hover:bg-atlas-elevated"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </div>
      )}

      {/* Benchmark Data Inspector Modal (Portaled directly to document.body for true viewport centering) */}
      {showBenchmarkModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setShowBenchmarkModal(false)}
          >
            <div
              className="bg-atlas-surface border border-atlas-border shadow-2xl max-w-xl w-full p-6 space-y-5 font-mono text-xs text-atlas-text animate-in fade-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-atlas-border pb-3">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-5 h-5 text-atlas-teal" />
                  <h3 className="font-display font-bold text-base text-atlas-text">
                    Verified NASA Datasets & Benchmark
                  </h3>
                </div>
                <button
                  onClick={() => setShowBenchmarkModal(false)}
                  className="p-1 hover:bg-atlas-elevated text-atlas-muted hover:text-atlas-text transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 font-sans text-xs text-atlas-muted leading-relaxed">
                <p>
                  Ares Frontier synthesizes primary NASA/JPL planetary datasets for high-fidelity terrain modeling,
                  bioenergetic traversal validation, and scientific target identification in Jezero Crater.
                </p>

                <div className="space-y-2 pt-1 font-mono">
                  <div className="p-3 bg-atlas-elevated border border-atlas-border space-y-1">
                    <div className="flex items-center justify-between font-bold text-atlas-text">
                      <span className="text-atlas-teal">MGS MOLA Laser Altimeter</span>
                      <span className="text-[10px] text-atlas-muted">128 px/deg</span>
                    </div>
                    <div className="text-[11px] text-atlas-muted">
                      Topographic areoid datum elevation model covering 100% of the traverse area.
                    </div>
                  </div>

                  <div className="p-3 bg-atlas-elevated border border-atlas-border space-y-1">
                    <div className="flex items-center justify-between font-bold text-atlas-text">
                      <span className="text-atlas-accent">Mars 2020 Perseverance Traverse</span>
                      <span className="text-[10px] text-atlas-muted">NASA PDS / MMGIS</span>
                    </div>
                    <div className="text-[11px] text-atlas-muted">
                      Authentic rover traverse coordinates, science stations, and coring sample cache locations.
                    </div>
                  </div>

                  <div className="p-3 bg-atlas-elevated border border-atlas-border space-y-1">
                    <div className="flex items-center justify-between font-bold text-atlas-text">
                      <span className="text-atlas-blue">CRISM & HiRISE Imagery</span>
                      <span className="text-[10px] text-atlas-muted">MRO Instruments</span>
                    </div>
                    <div className="text-[11px] text-atlas-muted">
                      Hyperspectral mineral mapping detecting olivine, smectite, and deltaic carbonate outcrops.
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-atlas-border">
                <Link
                  to="/methodology"
                  onClick={() => setShowBenchmarkModal(false)}
                  className="text-xs text-atlas-teal hover:underline flex items-center space-x-1"
                >
                  <span>Read Full Data Provenance</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>

                <button
                  onClick={() => setShowBenchmarkModal(false)}
                  className="px-4 py-2 bg-atlas-accent hover:bg-atlas-accent-hover text-white font-bold text-xs shadow-md transition-colors"
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
