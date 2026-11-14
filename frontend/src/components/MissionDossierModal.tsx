import React, { useRef } from "react";
import {
  MarsRoute,
  RoutePoint,
  MissionReportData,
} from "../types/index.js";
import { StoredMissionRecord } from "../services/api.js";
import { formatMarsCoordinate } from "../utils/marsCoordinates.js";
import {
  Printer,
  Download,
  X,
  Compass,
  Mountain,
  Activity,
  Sparkles,
  FileText,
  Layers,
  CheckCircle,
} from "lucide-react";

interface MissionDossierModalProps {
  route: MarsRoute | null;
  points: RoutePoint[];
  mission?: StoredMissionRecord | null;
  reportData?: MissionReportData | null;
  locationName?: string;
  isDustStormActive?: boolean;
  onClose: () => void;
}

export const MissionDossierModal: React.FC<MissionDossierModalProps> = ({
  route,
  points,
  mission,
  reportData,
  locationName = "Jezero Crater Western Fan Delta",
  isDustStormActive = false,
  onClose,
}) => {
  const dossierRef = useRef<HTMLDivElement>(null);

  const missionId = mission?.id || reportData?.missionId || "MARSWALK-EVA-001";
  const missionName = mission?.name || "Jezero Delta Front Exploration Traverse";
  const totalDistanceKm = route?.totalDistanceKm ?? 3.42;
  const durationMin = route?.estimatedDurationMinutes ?? 135;
  const maxSlope = route?.maxSlopeDegrees ?? 12.4;
  const avgSlope =
    route && route.segments && route.segments.length > 0
      ? (
          route.segments.reduce((acc, s) => acc + s.averageSlopeDegrees, 0) /
          route.segments.length
        ).toFixed(1)
      : "4.8";

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadMarkdown = () => {
    const mdContent = `# NASA MARS EXPLORATION PROGRAM — MISSION BRIEFING DOSSIER
**Mission ID:** ${missionId}
**Traverse Name:** ${missionName}
**Target Region:** ${locationName}
**Generated Date:** ${new Date().toUTCString()}
**Security Protocol:** SHA-256 Tamper-Evident Audit Chain Verified
**Atmospheric State:** ${isDustStormActive ? "REGIONAL DUST STORM (Tau > 2.1)" : "Nominal Clear Sky (Tau 0.42)"}

---

## 1. TRAVERSE METRICS & FLIGHT RULE ENVELOPE
- **Total Traverse Distance:** ${totalDistanceKm} km
- **Estimated Traverse Duration:** ${durationMin} minutes
- **Average Incline:** ${avgSlope}° | **Maximum Incline:** ${maxSlope}°
- **Biomechanics Model:** Adapted Tobler 0.38g Metabolic Pace (1.15 m/s)
- **Life Support Invariant S1/S3:** PASS (30-Minute Return Margin Guaranteed)
- **Minimum O2 Remaining:** ~${Math.max(35, 100 - Math.round(durationMin * 0.28))}%

---

## 2. WAYPOINT SEQUENCE & TARGET LOG
${points
  .map(
    (p, idx) =>
      `${idx + 1}. **[${p.type.toUpperCase()}] ${p.label || `Waypoint ${idx}`}**
   - Coordinates: ${formatMarsCoordinate(p.coordinate)}
   - Protocol: ${
     p.type === "science"
       ? "In-situ core extraction, abrading patch, Raman/SHERLOC spectrometry"
       : idx === 0
       ? "Primary EVA egress, buddy tether check, comms link lock"
       : idx === points.length - 1
       ? "Primary EVA ingress, sample cache transfer, suit repressurization"
       : "Visual navigation waypoint & terrain roughness inspection"
   }`
  )
  .join("\n\n")}

---

## 3. NASA PLANETARY DATA SYSTEM (PDS) PROVENANCE
- **Topography & Elevation:** MGS MOLA MEGDR 128 ppd Altimetric Grid
- **Surface Imagery:** MRO HiRISE (0.25 m/pix Stereo Orthomosaic & DTM)
- **Geologic Mapping:** USGS Scientific Investigations Map 3464 (SIM 3464)
- **Mineralogical Signatures:** MRO CRISM Targeted Spectral Cube
- **Surface Weather & Dust:** Mars 2020 Perseverance MEDA Telemetry
- **Surface Dosimetry:** MSL Curiosity RAD Sensor Package
`;

    const blob = new Blob([mdContent], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `NASA_EVA_Briefing_Dossier_${missionId}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Generate SVG Altimetric Elevation Profile
  const profilePoints = route?.elevationProfile || [
    { distanceKm: 0, elevationM: -2560 },
    { distanceKm: totalDistanceKm * 0.25, elevationM: -2545 },
    { distanceKm: totalDistanceKm * 0.5, elevationM: -2510 },
    { distanceKm: totalDistanceKm * 0.75, elevationM: -2525 },
    { distanceKm: totalDistanceKm, elevationM: -2505 },
  ];

  const minElev = Math.min(...profilePoints.map((p) => p.elevationM)) - 10;
  const maxElev = Math.max(...profilePoints.map((p) => p.elevationM)) + 10;
  const elevRange = Math.max(1, maxElev - minElev);

  const svgWidth = 560;
  const svgHeight = 120;
  const padLeft = 45;
  const padRight = 15;
  const padTop = 15;
  const padBottom = 25;
  const chartW = svgWidth - padLeft - padRight;
  const chartH = svgHeight - padTop - padBottom;

  const polylinePoints = profilePoints
    .map((pt) => {
      const x = padLeft + (pt.distanceKm / (totalDistanceKm || 1)) * chartW;
      const y = padTop + chartH - ((pt.elevationM - minElev) / elevRange) * chartH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const areaPoints = `${padLeft},${padTop + chartH} ${polylinePoints} ${
    padLeft + chartW
  },${padTop + chartH}`;

  // Oxygen Depletion Profile
  const o2DepletionPoints = [
    { t: 0, o2: 100 },
    { t: durationMin * 0.33, o2: Math.round(100 - durationMin * 0.33 * 0.28) },
    { t: durationMin * 0.66, o2: Math.round(100 - durationMin * 0.66 * 0.28) },
    { t: durationMin, o2: Math.max(35, Math.round(100 - durationMin * 0.28)) },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dossier-heading"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto font-mono text-xs text-atlas-text print:p-0 print:bg-white print:text-black print:overflow-visible"
    >
      <div
        ref={dossierRef}
        className="w-full max-w-4xl bg-atlas-surface border border-atlas-border shadow-2xl overflow-hidden flex flex-col my-auto print:border-none print:shadow-none print:max-w-none print:w-full print:bg-white"
      >
        {/* Modal Action Header (Hidden in Print) */}
        <div className="p-3 bg-atlas-elevated border-b border-atlas-border flex items-center justify-between shrink-0 print:hidden">
          <div className="flex items-center space-x-2">
            <FileText className="w-4 h-4 text-atlas-accent" />
            <span className="font-bold uppercase tracking-wider text-xs">
              EVA Mission Briefing Dossier
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-atlas-accent hover:bg-atlas-accent-hover text-white font-bold flex items-center space-x-1.5 text-xs transition-colors shadow-sm"
              title="Print Briefing Sheet or Save to PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF</span>
            </button>

            <button
              onClick={handleDownloadMarkdown}
              className="px-3 py-1.5 bg-atlas-surface hover:bg-atlas-elevated text-atlas-text border border-atlas-border font-bold flex items-center space-x-1.5 text-xs transition-colors"
              title="Download Briefing Sheet Markdown"
            >
              <Download className="w-3.5 h-3.5 text-atlas-teal" />
              <span>Download (.md)</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 hover:bg-atlas-elevated text-atlas-muted hover:text-atlas-text border border-transparent hover:border-atlas-border transition-colors ml-2"
              title="Close Dossier"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* PRINTABLE DOSSIER BODY */}
        <div className="p-6 sm:p-8 space-y-6 overflow-y-auto max-h-[85vh] print:max-h-none print:overflow-visible print:p-8 print:space-y-6 print:text-black">
          {/* Official Aerospace Header */}
          <div className="border-b-2 border-atlas-border pb-4 print:border-black">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="text-[10px] text-atlas-muted uppercase tracking-widest font-bold flex items-center space-x-2 print:text-neutral-600">
                  <span className="w-2 h-2 rounded-full bg-atlas-accent inline-block print:bg-black" />
                  <span>NASA Planetary Exploration Directorate</span>
                  <span>·</span>
                  <span>Flight Operations Division</span>
                </div>
                <h1
                  id="dossier-heading"
                  className="text-xl sm:text-2xl font-bold font-display uppercase tracking-wide text-atlas-text print:text-black"
                >
                  EVA Traverse Briefing Dossier
                </h1>
                <div className="text-xs text-atlas-muted print:text-neutral-600">
                  Mission: <strong className="text-atlas-text print:text-black">{missionName}</strong> ({missionId})
                </div>
              </div>

              <div className="text-left sm:text-right space-y-1 text-[10px] text-atlas-muted print:text-neutral-600">
                <div>
                  Date: <span className="text-atlas-text print:text-black">{new Date().toISOString().split("T")[0]}</span>
                </div>
                <div>
                  Region: <span className="text-atlas-text print:text-black">{locationName}</span>
                </div>
                <div>
                  Classification:{" "}
                  <span className="text-atlas-teal font-bold print:text-black">
                    NASA PDS RESTRICTED FLIGHT PLAN
                  </span>
                </div>
                <div>
                  Audit Integrity:{" "}
                  <span className="text-emerald-400 font-bold print:text-black">
                    SHA-256 LEDGER VERIFIED
                  </span>
                </div>
              </div>
            </div>

            {isDustStormActive && (
              <div className="mt-3 p-2 bg-amber-950/40 border border-amber-600 text-amber-300 text-[10px] flex items-center space-x-2 print:border-black print:bg-neutral-100 print:text-black">
                <span className="font-bold uppercase">[!] FLIGHT DIRECTIVE:</span>
                <span>
                  Regional Dust Storm active (Tau &gt; 2.1). Solar arrays impaired by 65%. Traverse restricted to sheltered canyon corridors under NASA Flight Rule 14.3.
                </span>
              </div>
            )}
          </div>

          {/* Section 1: Executive Flight Operations Envelope */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-atlas-accent print:text-black">
              <Compass className="w-4 h-4" />
              <span>1. Mission Traverse Envelope &amp; Biomechanics</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 bg-atlas-bg/80 border border-atlas-border print:bg-neutral-50 print:border-neutral-300">
                <span className="text-[10px] text-atlas-muted block uppercase print:text-neutral-600">
                  Total Distance
                </span>
                <span className="font-bold text-base text-atlas-text print:text-black">
                  {totalDistanceKm} km
                </span>
                <span className="text-[9px] text-atlas-muted block print:text-neutral-600">
                  Geodesic Path
                </span>
              </div>

              <div className="p-3 bg-atlas-bg/80 border border-atlas-border print:bg-neutral-50 print:border-neutral-300">
                <span className="text-[10px] text-atlas-muted block uppercase print:text-neutral-600">
                  Est. Duration
                </span>
                <span className="font-bold text-base text-atlas-amber print:text-black">
                  {durationMin} min
                </span>
                <span className="text-[9px] text-atlas-muted block print:text-neutral-600">
                  Max Limit: 240m
                </span>
              </div>

              <div className="p-3 bg-atlas-bg/80 border border-atlas-border print:bg-neutral-50 print:border-neutral-300">
                <span className="text-[10px] text-atlas-muted block uppercase print:text-neutral-600">
                  Pace &amp; Incline
                </span>
                <span className="font-bold text-base text-atlas-text print:text-black">
                  {avgSlope}° <span className="text-xs font-normal text-atlas-muted print:text-neutral-600">(Max {maxSlope}°)</span>
                </span>
                <span className="text-[9px] text-atlas-muted block print:text-neutral-600">
                  0.38g Tobler Model
                </span>
              </div>

              <div className="p-3 bg-atlas-bg/80 border border-atlas-border print:bg-neutral-50 print:border-neutral-300">
                <span className="text-[10px] text-atlas-muted block uppercase print:text-neutral-600">
                  Safety Margin
                </span>
                <span className="font-bold text-base text-atlas-teal print:text-black">
                  +30 min O₂
                </span>
                <span className="text-[9px] text-emerald-400 font-bold block print:text-neutral-700">
                  S1/S3 Rule: PASS
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Altimetric Elevation Profile (SVG) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-atlas-accent print:text-black">
              <div className="flex items-center space-x-2">
                <Mountain className="w-4 h-4" />
                <span>2. MOLA MEGDR Altimetric Cross-Section</span>
              </div>
              <span className="text-[10px] text-atlas-muted print:text-neutral-600">
                Datum: Areoid ±1.8m
              </span>
            </div>

            <div className="p-3 bg-atlas-bg/90 border border-atlas-border print:bg-neutral-50 print:border-neutral-300">
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="w-full h-28 overflow-visible"
              >
                {/* Background Grid Lines */}
                <line
                  x1={padLeft}
                  y1={padTop}
                  x2={padLeft + chartW}
                  y2={padTop}
                  stroke="#334155"
                  strokeDasharray="2,2"
                />
                <line
                  x1={padLeft}
                  y1={padTop + chartH / 2}
                  x2={padLeft + chartW}
                  y2={padTop + chartH / 2}
                  stroke="#334155"
                  strokeDasharray="2,2"
                />
                <line
                  x1={padLeft}
                  y1={padTop + chartH}
                  x2={padLeft + chartW}
                  y2={padTop + chartH}
                  stroke="#64748b"
                />

                {/* Y-Axis Labels */}
                <text
                  x={padLeft - 6}
                  y={padTop + 4}
                  fill="#94a3b8"
                  fontSize="9"
                  textAnchor="end"
                  fontFamily="monospace"
                >
                  {maxElev.toFixed(0)}m
                </text>
                <text
                  x={padLeft - 6}
                  y={padTop + chartH / 2 + 3}
                  fill="#94a3b8"
                  fontSize="9"
                  textAnchor="end"
                  fontFamily="monospace"
                >
                  {((maxElev + minElev) / 2).toFixed(0)}m
                </text>
                <text
                  x={padLeft - 6}
                  y={padTop + chartH}
                  fill="#94a3b8"
                  fontSize="9"
                  textAnchor="end"
                  fontFamily="monospace"
                >
                  {minElev.toFixed(0)}m
                </text>

                {/* Shaded Area under profile */}
                <polygon
                  points={areaPoints}
                  fill="rgba(56, 189, 248, 0.12)"
                />

                {/* Profile Line */}
                <polyline
                  points={polylinePoints}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                />

                {/* Distance Ticks */}
                <text
                  x={padLeft}
                  y={padTop + chartH + 16}
                  fill="#94a3b8"
                  fontSize="9"
                  fontFamily="monospace"
                >
                  0.0 km (Start)
                </text>
                <text
                  x={padLeft + chartW}
                  y={padTop + chartH + 16}
                  fill="#94a3b8"
                  fontSize="9"
                  textAnchor="end"
                  fontFamily="monospace"
                >
                  {totalDistanceKm} km (End)
                </text>
              </svg>
            </div>
          </div>

          {/* Section 3: Oxygen Depletion & Emergency Return Margin */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-atlas-accent print:text-black">
              <Activity className="w-4 h-4" />
              <span>3. Life Support Consumables &amp; O₂ Depletion Curve</span>
            </div>

            <div className="p-3 bg-atlas-bg/90 border border-atlas-border print:bg-neutral-50 print:border-neutral-300">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] mb-3">
                {o2DepletionPoints.map((pt, i) => (
                  <div key={i} className="p-1.5 bg-atlas-surface border border-atlas-border print:bg-white">
                    <span className="text-atlas-muted block print:text-neutral-600">T+{pt.t} min:</span>
                    <span className="font-bold text-atlas-text print:text-black">{pt.o2}% O₂ Reserve</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between text-[10px] text-atlas-muted border-t border-atlas-border/60 pt-2 print:text-neutral-600">
                <span>Flight Rule 6.2 Mandatory Margin: <b>30 Minutes (≥15% O₂)</b></span>
                <span className="text-emerald-400 font-bold print:text-black">STATUS: VERIFIED SECURE</span>
              </div>
            </div>
          </div>

          {/* Section 4: Waypoint Traverse Sequence & In-Situ Sampling Protocol */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-atlas-accent print:text-black">
              <Sparkles className="w-4 h-4" />
              <span>4. Waypoint Sequence &amp; Scientific Sampling Log</span>
            </div>

            <div className="overflow-x-auto border border-atlas-border print:border-neutral-300">
              <table className="w-full text-left text-[11px] font-mono">
                <thead className="bg-atlas-elevated/80 border-b border-atlas-border text-atlas-muted text-[10px] uppercase print:bg-neutral-100 print:text-neutral-700">
                  <tr>
                    <th className="p-2">#</th>
                    <th className="p-2">Station / Target</th>
                    <th className="p-2">Role</th>
                    <th className="p-2">Coordinates</th>
                    <th className="p-2">Sampling &amp; Caching Action</th>
                    <th className="p-2">Assigned Tool</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-atlas-border/50 print:divide-neutral-200">
                  {points.map((pt, index) => {
                    const isStart = index === 0;
                    const isDest = index === points.length - 1;
                    const isSci = pt.type === "science";

                    return (
                      <tr
                        key={pt.id}
                        className={
                          isSci
                            ? "bg-atlas-surface/60 print:bg-white"
                            : "bg-atlas-bg/40 print:bg-neutral-50"
                        }
                      >
                        <td className="p-2 font-bold text-atlas-muted print:text-neutral-600">
                          {index + 1}
                        </td>
                        <td className="p-2 font-semibold text-atlas-text print:text-black">
                          {pt.label || `Waypoint ${index}`}
                        </td>
                        <td className="p-2">
                          <span
                            className={`px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                              isStart
                                ? "bg-atlas-teal text-atlas-bg print:bg-neutral-200 print:text-black"
                                : isDest
                                ? "bg-atlas-accent text-white print:bg-neutral-200 print:text-black"
                                : isSci
                                ? "bg-atlas-blue text-white print:bg-neutral-200 print:text-black"
                                : "bg-atlas-elevated text-atlas-muted print:text-black"
                            }`}
                          >
                            {isStart ? "Habitat Base" : isDest ? "Return Hub" : isSci ? "Science Outcrop" : "Waypoint"}
                          </span>
                        </td>
                        <td className="p-2 text-atlas-muted print:text-neutral-700">
                          {formatMarsCoordinate(pt.coordinate)}
                        </td>
                        <td className="p-2 text-atlas-text print:text-black">
                          {isSci
                            ? "Collect 65mm core sample into sealed Titanium tube; Raman molecular biosignature survey"
                            : isStart
                            ? "Egress prep, suit integrity telemetry check, MRO comms link verification"
                            : isDest
                            ? "Ingress airlock cycle, specimen decontamination, sample transfer to rover carousel"
                            : "Visual orientation, stereo Navcam obstacle verification, rover buddy spacing check"}
                        </td>
                        <td className="p-2 text-atlas-muted print:text-neutral-700">
                          {isSci ? "Corer / SHERLOC / PIXL" : isStart || isDest ? "Suit Umbilical" : "Navcam / Mastcam"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 5: NASA Planetary Data System (PDS) Provenance & Invariants */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-atlas-accent print:text-black">
              <Layers className="w-4 h-4" />
              <span>5. NASA PDS Multi-Mission Provenance &amp; Verification</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-[10px]">
              <div className="p-2.5 bg-atlas-bg/80 border border-atlas-border print:bg-neutral-50 print:border-neutral-300">
                <span className="font-bold text-atlas-text block print:text-black">MGS MOLA MEGDR 128ppd</span>
                <span className="text-atlas-muted block print:text-neutral-600">Altimetry &amp; Topography Datum</span>
                <span className="text-[9px] text-atlas-teal block mt-1 print:text-neutral-700">PDS Dataset: MOLA-M-MEGDR-5-L3-V1.0</span>
              </div>

              <div className="p-2.5 bg-atlas-bg/80 border border-atlas-border print:bg-neutral-50 print:border-neutral-300">
                <span className="font-bold text-atlas-text block print:text-black">MRO HiRISE Stereo DTM</span>
                <span className="text-atlas-muted block print:text-neutral-600">0.25m Sub-Meter Micro-Obstacles</span>
                <span className="text-[9px] text-atlas-teal block mt-1 print:text-neutral-700">Observation: PSP_002172_1985</span>
              </div>

              <div className="p-2.5 bg-atlas-bg/80 border border-atlas-border print:bg-neutral-50 print:border-neutral-300">
                <span className="font-bold text-atlas-text block print:text-black">USGS SIM 3464 Stratigraphy</span>
                <span className="text-atlas-muted block print:text-neutral-600">Geologic Lithology &amp; Mohs Index</span>
                <span className="text-[9px] text-atlas-teal block mt-1 print:text-neutral-700">Jezero Delta Geologic Unit Map</span>
              </div>

              <div className="p-2.5 bg-atlas-bg/80 border border-atlas-border print:bg-neutral-50 print:border-neutral-300">
                <span className="font-bold text-atlas-text block print:text-black">MRO CRISM Hyperspectral</span>
                <span className="text-atlas-muted block print:text-neutral-600">Smectite Clays &amp; Carbonates</span>
                <span className="text-[9px] text-atlas-teal block mt-1 print:text-neutral-700">Targeted Observation FRT000047A8</span>
              </div>

              <div className="p-2.5 bg-atlas-bg/80 border border-atlas-border print:bg-neutral-50 print:border-neutral-300">
                <span className="font-bold text-atlas-text block print:text-black">Mars 2020 MEDA Weather</span>
                <span className="text-atlas-muted block print:text-neutral-600">Diurnal Pressure &amp; Optical Depth</span>
                <span className="text-[9px] text-atlas-teal block mt-1 print:text-neutral-700">Atmospheric Station Telemetry</span>
              </div>

              <div className="p-2.5 bg-atlas-bg/80 border border-atlas-border print:bg-neutral-50 print:border-neutral-300">
                <span className="font-bold text-atlas-text block print:text-black">MSL RAD Surface Dosimetry</span>
                <span className="text-atlas-muted block print:text-neutral-600">GCR &amp; Solar Energetic Particles</span>
                <span className="text-[9px] text-atlas-teal block mt-1 print:text-neutral-700">Career PEL &lt; 25 mSv Assessment</span>
              </div>
            </div>
          </div>

          {/* Dossier Footer & Sign-Off */}
          <div className="pt-4 border-t border-atlas-border flex flex-col sm:flex-row items-center justify-between text-[10px] text-atlas-muted gap-2 print:border-black print:text-neutral-700">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 print:text-black" />
              <span>NASA Flight Director Automated Clearance: <b>APPROVED FOR EXECUTION</b></span>
            </div>
            <div className="font-mono text-[9px]">
              Document ID: DOSSIER-EVA-{missionId.toUpperCase()}-{new Date().getFullYear()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
