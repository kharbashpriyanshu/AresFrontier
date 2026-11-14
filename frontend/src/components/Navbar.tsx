import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Compass,
  Map as MapIcon,
  Activity,
  Database,
  BookOpen,
  Radio,
  Users,
  RotateCcw,
  BarChart3,
  Award,
  Sun,
  Moon,
  Menu,
  X,
} from "lucide-react";
import { useTheme } from "../context/ThemeContext.js";
import { OperationalDataModeBadge } from "./OperationalDataModeBadge.js";

export const Navbar: React.FC = () => {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { to: "/", label: "Overview", icon: Compass },
    { to: "/map", label: "Map", icon: MapIcon },
    { to: "/operations", label: "Field Operations", icon: Users },
    { to: "/replay", label: "Replay", icon: RotateCcw },
    { to: "/mission-analytics", label: "Analytics", icon: BarChart3 },
    { to: "/demo", label: "Judging Demo", icon: Award },
    { to: "/mission", label: "EVA Console", icon: Activity },
    { to: "/science", label: "Science", icon: Database },
    { to: "/methodology", label: "Data & Provenance", icon: BookOpen },
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
        <nav className="hidden xl:flex items-center space-x-1">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`relative px-3 py-1.5 text-xs font-medium transition-colors ${
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
      <div className="flex items-center space-x-3">
        {/* Benchmark Data Badge */}
        <div className="hidden sm:block">
          <OperationalDataModeBadge mode="BENCHMARK" compact />
        </div>

        {/* Demo Shortcut */}
        <Link
          to="/operations?demo=marswalk-001"
          className="hidden md:flex items-center space-x-1 text-[11px] font-mono bg-atlas-elevated hover:bg-atlas-surface text-atlas-accent px-2.5 py-1 border border-atlas-border transition-colors"
        >
          <span>Demo: Marswalk-001</span>
        </Link>

        {/* Benchmark Terrain Model Status */}
        <div
          className="hidden lg:flex items-center space-x-2 text-[11px] font-mono bg-atlas-elevated px-2.5 py-1 border border-atlas-border text-atlas-muted"
          title="Configured static benchmark terrain model (not a live NASA telemetry feed)"
        >
          <Radio className="w-3 h-3 text-atlas-teal" />
          <span>Terrain Model: Benchmark</span>
        </div>

        {/* Areoid Datum Indicator */}
        <div className="hidden 2xl:block text-[11px] font-mono text-atlas-muted border-l border-atlas-border pl-3">
          Datum: <span className="text-atlas-text">Areoid 3396.2 km</span>
        </div>

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
          className="xl:hidden w-8 h-8 bg-atlas-elevated border border-atlas-border flex items-center justify-center text-atlas-text"
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="xl:hidden absolute top-14 left-0 right-0 bg-atlas-surface border-b border-atlas-border p-4 shadow-2xl flex flex-col space-y-2 z-50">
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
            <OperationalDataModeBadge mode="BENCHMARK" compact />
            <span>Datum: Areoid 3396.2 km</span>
          </div>
        </div>
      )}
    </header>
  );
};
