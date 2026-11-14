import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api.js";
import { ScienceTarget } from "../types/index.js";
import { formatMarsCoordinate } from "../utils/marsCoordinates.js";
import {
  Database,
  Target,
  MapPin,
  Filter,
  Compass,
  Plus,
} from "lucide-react";

export const SciencePage: React.FC = () => {
  const [targets, setTargets] = useState<ScienceTarget[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedValue, setSelectedValue] = useState<string>("all");
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadTargets() {
      try {
        setIsLoading(true);
        const data = await api.getScienceTargets();
        setTargets(data);
      } catch (err) {
        console.error("Failed to load science targets", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadTargets();
  }, []);

  const filteredTargets = targets.filter((t) => {
    const matchCat = selectedCategory === "all" || t.category === selectedCategory;
    const matchVal = selectedValue === "all" || t.scientificValue === selectedValue;
    return matchCat && matchVal;
  });

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-space-950 text-slate-100 p-4 md:p-8 font-mono text-xs selection:bg-mars-rust selection:text-white">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-space-800 pb-5">
          <div className="space-y-1">
            <div className="text-[10px] text-slate-400 tracking-wider flex items-center space-x-1.5 uppercase">
              <Database className="w-3.5 h-3.5 text-mars-accent" />
              <span>PLANETARY SCIENCE RECONNAISSANCE</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold font-sans text-slate-100">
              Martian Science Targets & Mineralogy
            </h1>
            <p className="text-slate-400 text-[11px] max-w-2xl font-sans">
              Ground-truth targets cataloged from NASA Mars Reconnaissance Orbiter (CRISM, HiRISE), Curiosity (MSL), and
              Perseverance (Mars 2020) observations.
            </p>
          </div>

          <Link
            to="/map"
            className="px-4 py-2 bg-space-900 hover:bg-space-850 text-slate-200 rounded border border-space-700 font-semibold flex items-center space-x-2 transition-colors self-start md:self-auto"
          >
            <Compass className="w-4 h-4 text-mars-accent" />
            <span>OPEN INTERACTIVE MAP</span>
          </Link>
        </div>

        {/* Filter Controls */}
        <div className="p-4 bg-space-900 border border-space-800 rounded flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-2 text-slate-400">
            <Filter className="w-4 h-4 text-telemetry-cyan" />
            <span className="uppercase text-[11px] font-bold">FILTERS:</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-2">
              <span className="text-slate-400">Category:</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-space-850 border border-space-700 rounded px-2.5 py-1 text-slate-200 text-xs focus:outline-none focus:border-mars-accent"
              >
                <option value="all">All Categories</option>
                <option value="stratigraphy">Stratigraphy</option>
                <option value="mineralogy">Mineralogy</option>
                <option value="paleohydrology">Paleohydrology</option>
                <option value="geomorphology">Geomorphology</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-slate-400">Scientific Value:</span>
              <select
                value={selectedValue}
                onChange={(e) => setSelectedValue(e.target.value)}
                className="bg-space-850 border border-space-700 rounded px-2.5 py-1 text-slate-200 text-xs focus:outline-none focus:border-mars-accent"
              >
                <option value="all">All Priorities</option>
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </select>
            </div>
          </div>
        </div>

        {/* Targets Grid */}
        {isLoading ? (
          <div className="h-48 flex items-center justify-center space-x-2 text-slate-400">
            <div className="w-5 h-5 border-2 border-mars-accent border-t-transparent rounded-full animate-spin"></div>
            <span>Scanning planetary target database...</span>
          </div>
        ) : filteredTargets.length === 0 ? (
          <div className="p-8 text-center text-slate-500 bg-space-900 rounded border border-space-800">
            No scientific targets match the selected criteria.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredTargets.map((target) => {
              const valColor =
                target.scientificValue === "high"
                  ? "text-telemetry-emerald bg-emerald-950/50 border-emerald-500/40"
                  : target.scientificValue === "medium"
                  ? "text-telemetry-cyan bg-cyan-950/50 border-cyan-500/40"
                  : "text-telemetry-amber bg-amber-950/50 border-amber-500/40";

              return (
                <div
                  key={target.id}
                  className="p-5 bg-space-900 border border-space-800 rounded flex flex-col justify-between space-y-4 hover:border-space-700 transition-colors shadow-lg"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center space-x-1">
                        <Target className="w-3 h-3 text-mars-accent" />
                        <span>{target.category}</span>
                      </span>
                      <span className={`text-[9px] uppercase px-2 py-0.5 rounded border font-bold ${valColor}`}>
                        {target.scientificValue} VALUE
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-100 font-sans leading-snug">
                      {target.name}
                    </h3>

                    <div className="text-[11px] text-telemetry-cyan font-mono">
                      {formatMarsCoordinate(target.coordinate)}
                    </div>

                    <p className="text-slate-300 text-[11px] leading-relaxed pt-1">
                      {target.description}
                    </p>
                  </div>

                  <div className="space-y-3 pt-3 border-t border-space-800 text-[10px]">
                    {target.potentialSamples && target.potentialSamples.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-slate-400 uppercase">Candidate Sample Targets:</span>
                        <div className="flex flex-wrap gap-1">
                          {target.potentialSamples.map((sample, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 bg-space-850 rounded border border-space-700 text-slate-300"
                            >
                              {sample}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="text-slate-500 truncate" title={target.dataSource}>
                      Source: {target.dataSource}
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <Link
                        to={`/map?addScience=${target.id}`}
                        className="py-2 bg-gradient-to-r from-mars-rust to-mars-accent hover:from-mars-accent hover:to-orange-500 text-white rounded font-bold flex items-center justify-center space-x-1.5 transition-all text-[10px] shadow-sm"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>ADD TO MARSWALK</span>
                      </Link>

                      <Link
                        to={`/map`}
                        className="py-2 bg-space-850 hover:bg-space-800 text-slate-200 border border-space-700 rounded font-semibold flex items-center justify-center space-x-1.5 transition-colors text-[10px]"
                      >
                        <MapPin className="w-3.5 h-3.5 text-mars-accent" />
                        <span>LOCATE ON MAP</span>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
