import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Compass,
  Map,
  Activity,
  Database,
  BookOpen,
  Radio,
  Users,
  RotateCcw,
  BarChart3,
  Award,
} from "lucide-react";
import { OperationalDataModeBadge } from "./OperationalDataModeBadge.js";

export const Navbar: React.FC = () => {
  const location = useLocation();

  const navLinks = [
    { to: "/", label: "Overview", icon: Compass },
    { to: "/map", label: "Map", icon: Map },
    { to: "/operations", label: "Field Operations", icon: Users },
    { to: "/replay", label: "Replay", icon: RotateCcw },
    { to: "/mission-analytics", label: "Analytics", icon: BarChart3 },
    { to: "/demo", label: "Judging Demo", icon: Award },
    { to: "/mission", label: "EVA Console", icon: Activity },
    { to: "/science", label: "Science", icon: Database },
    { to: "/methodology", label: "Data & Provenance", icon: BookOpen },
  ];

  return (
    <header className="h-14 border-b border-space-800 bg-space-900/90 backdrop-blur-md px-4 flex items-center justify-between sticky top-0 z-50 select-none">
      <div className="flex items-center space-x-6">
        <Link to="/" className="flex items-center space-x-2 group">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-mars-rust to-mars-accent flex items-center justify-center shadow-lg shadow-mars-rust/20 group-hover:ring-1 group-hover:ring-mars-accent transition-all">
            <span className="font-mono font-bold text-white text-xs tracking-wider">♂</span>
          </div>
          <div>
            <div className="font-mono text-xs font-bold text-slate-100 tracking-wider flex items-center space-x-1.5">
              <span>MARTIAN MAP</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-mars-rust/30 text-mars-accent border border-mars-rust/50 rounded uppercase">
                OPS
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono tracking-tight">
              INTERPLANETARY SURVIVAL GUIDE
            </div>
          </div>
        </Link>

        <nav className="hidden md:flex items-center space-x-1">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`px-3 py-1.5 rounded text-xs font-mono flex items-center space-x-2 transition-colors ${
                  isActive
                    ? "bg-space-800 text-mars-accent border border-space-700 font-semibold"
                    : "text-slate-300 hover:text-slate-100 hover:bg-space-850"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center space-x-3">
        <OperationalDataModeBadge mode="BENCHMARK" compact />
        <Link
          to="/operations?demo=marswalk-001"
          className="hidden lg:flex items-center space-x-1.5 text-[11px] font-mono bg-mars-rust/20 hover:bg-mars-rust/30 text-mars-accent px-2.5 py-1 rounded border border-mars-rust/40 transition-colors"
        >
          <span>DEMO: MARSWALK-001</span>
        </Link>
        <div className="hidden sm:flex items-center space-x-2 text-[11px] font-mono bg-space-850 px-2.5 py-1 rounded border border-space-800 text-slate-300">
          <Radio className="w-3.5 h-3.5 text-telemetry-emerald animate-pulse" />
          <span>MGS/MOLA GRID: ONLINE</span>
        </div>
        <div className="text-[11px] font-mono text-slate-400 border-l border-space-800 pl-3">
          DATUM: <span className="text-slate-200">AREOID 3396.2 KM</span>
        </div>
      </div>
    </header>
  );
};
