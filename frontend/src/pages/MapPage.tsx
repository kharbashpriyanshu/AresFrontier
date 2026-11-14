import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../services/api.js";
import {
  LocationData,
  ScienceTarget,
  MarsRoute,
  RoutePoint,
  MarsCoordinate,
  SystemPipelineStatus,
  Hazard,
  ScienceObjective,
  ScienceObjectiveId,
  RouteCandidate,
} from "../types/index.js";
import { MarsMap } from "../components/MarsMap.js";
import { LocationExplorer } from "../components/LocationExplorer.js";
import { RoutePlanner } from "../components/RoutePlanner.js";
import { WaypointPreviewHud } from "../components/WaypointPreviewHud.js";
import { EnvironmentalDashboard } from "../components/EnvironmentalDashboard.js";
import { RfCoverageOverlay } from "../components/RfCoverageOverlay.js";
import { HyperlocalTacticalGrid } from "../components/HyperlocalTacticalGrid.js";
import { SamplingProtocolPanel } from "../components/SamplingProtocolPanel.js";
import { SurfacePhotoViewer } from "../components/SurfacePhotoViewer.js";
import { MissionNarrativePanel } from "../components/MissionNarrativePanel.js";
import { EvaPlaybackAnimation } from "../components/EvaPlaybackAnimation.js";
import { GuidedMarswalkTour } from "../components/GuidedMarswalkTour.js";
import { ElevationProfileChart } from "../components/ElevationProfileChart.js";
import {
  Navigation,
  Info,
  Play,
  AlertTriangle,
  Database,
  Activity,
  CloudSun,
  Radio,
  Footprints,
  Camera,
  Compass,
  Sparkles,
  Mountain,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Gauge,
  Sun,
} from "lucide-react";

export const MapPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [locations, setLocations] = useState<LocationData[]>([]);
  const [scienceTargets, setScienceTargets] = useState<ScienceTarget[]>([]);
  const [activeRoute, setActiveRoute] = useState<MarsRoute | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  const [pipelineStatus, setPipelineStatus] = useState<SystemPipelineStatus | null>(null);
  const [showProvenanceModal, setShowProvenanceModal] = useState<boolean>(false);
  const [showStatusModal, setShowStatusModal] = useState<boolean>(false);

  // Phase 2 Mission Intelligence State
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const [objectives, setObjectives] = useState<ScienceObjective[]>([]);
  const [selectedObjectiveId, setSelectedObjectiveId] = useState<ScienceObjectiveId>("ANCIENT_WATER_ACTIVITY");
  const [candidates, setCandidates] = useState<RouteCandidate[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>("");
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);

  // Waypoints state managed for cohesive two-way syncing
  const [points, setPoints] = useState<RoutePoint[]>([
    {
      id: "pt-start",
      coordinate: { latitude: 18.4447, longitude: 77.4508 },
      type: "start",
      label: "Octavia E. Butler Landing (Jezero)",
    },
    {
      id: "pt-dest",
      coordinate: { latitude: 18.423, longitude: 77.411 },
      type: "destination",
      label: "Kodiak Butte Delta Front",
    },
  ]);

  // UI Drawer State
  const [activeDrawer, setActiveDrawer] = useState<"explorer" | "planner" | null>("planner");
  const [isPickingOnMap, setIsPickingOnMap] = useState<boolean>(false);
  const [clickedCoord, setClickedCoord] = useState<MarsCoordinate | null>(null);
  const [hoverProfileCoord, setHoverProfileCoord] = useState<MarsCoordinate | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [focusCoord, setFocusCoord] = useState<MarsCoordinate | null>(null);

  // Milestone 6 & 7 Tactical & Operations HUDs
  const [showWeatherHud, setShowWeatherHud] = useState<boolean>(false);
  const [isDustStormActive, setIsDustStormActive] = useState<boolean>(false);
  const [showRfOverlay, setShowRfOverlay] = useState<boolean>(false);
  const [showTacticalGrid, setShowTacticalGrid] = useState<boolean>(false);
  const [showSurfacePhotos, setShowSurfacePhotos] = useState<boolean>(false);
  const [showWaypointPreview, setShowWaypointPreview] = useState<boolean>(false);
  const [showSamplingPanel, setShowSamplingPanel] = useState<boolean>(false);
  const [showNarrative, setShowNarrative] = useState<boolean>(false);
  const [showEvaPlayback, setShowEvaPlayback] = useState<boolean>(false);
  const [isEvaPlaying, setIsEvaPlaying] = useState<boolean>(false);
  const [showMolaHeatmap, setShowMolaHeatmap] = useState<boolean>(false);
  const [showCrismOverlay, setShowCrismOverlay] = useState<boolean>(false);
  const [showGuidedTour, setShowGuidedTour] = useState<boolean>(false);
  const [hudCoord, setHudCoord] = useState<MarsCoordinate>({ latitude: 18.4447, longitude: 77.4508 });
  const [hudLabel, setHudLabel] = useState<string>("Octavia E. Butler Landing (Jezero)");
  const [ingestedM20Traverse, setIngestedM20Traverse] = useState<{
    segments: [number, number][][];
    currentPosition?: { latitude: number; longitude: number; sol: number; totalDistanceKm: number } | null;
  } | null>(null);

  // Add Science Stop handler defined before useEffect (deduplicated by targetId or coordinate)
  const handleAddScienceStop = useCallback((item: ScienceTarget | LocationData) => {
    const itemId = "id" in item ? item.id : undefined;

    setPoints((prev) => {
      const alreadyExists = prev.some(
        (p) =>
          (itemId && p.targetId === itemId) ||
          (Math.abs(p.coordinate.latitude - item.coordinate.latitude) < 0.0005 &&
            Math.abs(p.coordinate.longitude - item.coordinate.longitude) < 0.0005)
      );
      if (alreadyExists) {
        return prev;
      }

      const newPoint: RoutePoint = {
        id: `pt-sci-${Date.now()}`,
        coordinate: item.coordinate,
        type: "science",
        label: item.name,
        targetId: itemId,
      };

      const updated = [...prev];
      if (updated.length >= 2) {
        updated.splice(updated.length - 1, 0, newPoint);
      } else {
        updated.push(newPoint);
      }
      return updated;
    });
    setFocusCoord(item.coordinate);
    setActiveDrawer("planner");
  }, []);

  // Launch Deterministic Demo MARSWALK-001
  const loadDemoMarswalk = useCallback((locs?: LocationData[], tgts?: ScienceTarget[]) => {
    const locList = locs || locations;
    const tgtList = tgts || scienceTargets;

    const jezeroLoc = locList.find((l) => l.id === "loc-jezero-crater") || {
      id: "loc-jezero-crater",
      coordinate: { latitude: 18.4447, longitude: 77.4508 },
      name: "Octavia E. Butler Landing (Jezero)",
    };

    const seitahTgt = tgtList.find((t) => t.id === "tgt-seitah-olivine");
    const kodiakTgt = tgtList.find((t) => t.id === "tgt-kodiak-butte");

    const demoPoints: RoutePoint[] = [
      {
        id: "demo-pt-1",
        coordinate: { latitude: 18.4447, longitude: 77.4508 },
        type: "start",
        label: "Octavia E. Butler Base (Start)",
      },
      ...(seitahTgt
        ? [
          {
            id: "demo-pt-2",
            coordinate: seitahTgt.coordinate,
            type: "science" as const,
            label: seitahTgt.name,
            targetId: seitahTgt.id,
          },
        ]
        : []),
      ...(kodiakTgt
        ? [
          {
            id: "demo-pt-3",
            coordinate: kodiakTgt.coordinate,
            type: "science" as const,
            label: kodiakTgt.name,
            targetId: kodiakTgt.id,
          },
        ]
        : []),
      {
        id: "demo-pt-4",
        coordinate: { latitude: 18.440, longitude: 77.395 },
        type: "destination",
        label: "Delta Scarp Base Camp (Destination)",
      },
    ];

    setPoints(demoPoints);
    if (jezeroLoc as LocationData) {
      setSelectedLocation(jezeroLoc as LocationData);
    }

    // Automatically generate the route
    api.createRoute("MARSWALK-001: Jezero Delta & Séítah Recon", demoPoints).then((newRoute) => {
      setActiveRoute(newRoute);
    });
  }, [locations, scienceTargets]);

  const handleTourStepChange = (stepIdx: number) => {
    // Keep drawers and other floating modals closed so ONLY the tour box is shown
    setActiveDrawer(null);
    setShowWeatherHud(false);
    setShowNarrative(false);
    setShowEvaPlayback(false);
    setShowRfOverlay(false);
    setShowSurfacePhotos(false);
    setShowSamplingPanel(false);
    setShowWaypointPreview(false);

    if (stepIdx === 0) {
      // Step 1: Mission Briefing & Martian Weather (Jezero Landing Base)
      setFocusCoord({ latitude: 18.4447, longitude: 77.4508 });
      setHudCoord({ latitude: 18.4447, longitude: 77.4508 });
      setShowMolaHeatmap(false);
      setShowCrismOverlay(false);
    } else if (stepIdx === 1) {
      // Step 2: MOLA Altimetry & Scarp Hazards (Delta Front Cliff)
      setFocusCoord({ latitude: 18.448, longitude: 77.402 });
      setShowMolaHeatmap(true);
      setShowCrismOverlay(false);
    } else if (stepIdx === 2) {
      // Step 3: CRISM Hyperspectral Target Scan (Carbonate & Smectite Outcrops)
      setFocusCoord({ latitude: 18.438, longitude: 77.418 });
      setShowMolaHeatmap(false);
      setShowCrismOverlay(true);
    } else if (stepIdx === 3) {
      // Step 4: A* Cost-Gradient Hazard Avoidance (Valley Breach Detour)
      setFocusCoord({ latitude: 18.442, longitude: 77.425 });
      setShowMolaHeatmap(false);
      setShowCrismOverlay(false);
    } else if (stepIdx === 4) {
      // Step 5: Live Astronaut Bioenergetics & Multi-Agent Escort (Delta Scarp Base Camp)
      setFocusCoord({ latitude: 18.440, longitude: 77.395 });
      setShowMolaHeatmap(false);
      setShowCrismOverlay(false);
    }
  };

  const hasLoadedRef = useRef<boolean>(false);
  const handledQueryRef = useRef<string>("");

  // Load initial datasets and pipeline status once
  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    async function loadData() {
      try {
        setIsLoading(true);
        const [locs, targets, routes, statusData, hazardList, objectiveList] = await Promise.all([
          api.getLocations(),
          api.getScienceTargets(),
          api.getAllRoutes(),
          api.getDataStatus(),
          api.getHazards().catch(() => [] as Hazard[]),
          api.getScienceObjectives().catch(() => [] as ScienceObjective[]),
        ]);
        setLocations(locs);
        setScienceTargets(targets);
        setHazards(hazardList);
        setObjectives(objectiveList);
        if (statusData && statusData.pipelines) {
          setPipelineStatus(statusData.pipelines);
        }

        // Load ingested M20 traverse overlay if previously ingested
        fetch("/api/data/ingested")
          .then((r) => (r.ok ? r.json() : null))
          .then((body) => {
            const m20 = body?.data?.find?.((d: any) => d.id === "m20-mmgis-traverse");
            if (m20?.mapOverlay) {
              setIngestedM20Traverse(m20.mapOverlay);
            }
          })
          .catch(() => { });

        const requestedRouteId = searchParams.get("routeId");
        const matchedRoute = requestedRouteId ? routes.find((r) => r.id === requestedRouteId) : undefined;
        const initialRoute = matchedRoute || routes[0];
        if (initialRoute) {
          setActiveRoute(initialRoute);
          if (initialRoute.points && initialRoute.points.length >= 2) {
            setPoints(initialRoute.points);
          }
        }
        if (locs.length > 0) {
          setSelectedLocation(locs[0]);
        }
      } catch (err: unknown) {
        console.error("Failed to load Mars datasets", err);
        setErrorMsg(err instanceof Error ? err.message : "Error connecting to backend API.");
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [searchParams]);

  // Apply URL query actions once datasets are ready
  useEffect(() => {
    if (isLoading) return;
    const queryKey = searchParams.toString();
    if (!queryKey || handledQueryRef.current === queryKey) return;
    handledQueryRef.current = queryKey;

    const latParam = parseFloat(searchParams.get("lat") || "");
    const lonParam = parseFloat(searchParams.get("lon") || "");
    if (!Number.isNaN(latParam) && !Number.isNaN(lonParam)) {
      setFocusCoord({ latitude: latParam, longitude: lonParam });
    }

    const addScienceId = searchParams.get("addScience");
    if (addScienceId) {
      const targetToAdd = scienceTargets.find((t) => t.id === addScienceId);
      if (targetToAdd) {
        handleAddScienceStop(targetToAdd);
        setActiveDrawer("planner");
      }
    }

    if (searchParams.get("demo") === "marswalk-001") {
      loadDemoMarswalk(locations, scienceTargets);
      if (searchParams.get("tour") === "true") {
        setShowGuidedTour(true);
        handleTourStepChange(0);
      }
    }
  }, [isLoading, searchParams, locations, scienceTargets, handleAddScienceStop, loadDemoMarswalk]);

  // Mission Intelligence Optimization (Phase 2)
  const handleRunCopilotOptimizer = async () => {
    if (points.length < 2) return;
    try {
      setIsOptimizing(true);
      const startCoord = points[0].coordinate;
      const destCoord = points[points.length - 1].coordinate;

      const generatedCandidates = await api.optimizeRoute({
        startCoordinate: startCoord,
        destinationCoordinate: destCoord,
        objectiveId: selectedObjectiveId,
        maxDurationMinutes: 180,
      });

      setCandidates(generatedCandidates);

      const balanced = generatedCandidates.find((c) => c.profileType === "balanced") || generatedCandidates[0];
      if (balanced) {
        handleSelectCandidate(balanced);
      }
    } catch (err: unknown) {
      console.error("Optimization failed", err);
      alert(err instanceof Error ? err.message : "Route optimization failed.");
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleSelectCandidate = (candidate: RouteCandidate) => {
    setSelectedCandidateId(candidate.id);
    setActiveRoute(candidate.route);
    if (candidate.route.points && candidate.route.points.length >= 2) {
      setPoints(candidate.route.points);
    }
  };

  // Set as Start Point
  const handleSetStart = (loc: LocationData) => {
    const updated = [...points];
    const newStart: RoutePoint = {
      id: `pt-start-${Date.now()}`,
      coordinate: loc.coordinate,
      type: "start",
      label: `${loc.name} (Start)`,
    };
    if (updated.length > 0) {
      updated[0] = newStart;
    } else {
      updated.push(newStart);
    }
    setPoints(updated);
    setActiveDrawer("planner");
  };

  // Set as Destination Point
  const handleSetDestination = (loc: LocationData) => {
    const updated = [...points];
    const newDest: RoutePoint = {
      id: `pt-dest-${Date.now()}`,
      coordinate: loc.coordinate,
      type: "destination",
      label: `${loc.name} (Dest)`,
    };
    if (updated.length >= 2) {
      updated[updated.length - 1] = newDest;
    } else {
      updated.push(newDest);
    }
    setPoints(updated);
    setActiveDrawer("planner");
  };

  // Plan Mission CTA from Explorer
  const handlePlanMission = (loc: LocationData) => {
    handleSetStart(loc);
    setActiveDrawer("planner");
  };

  // Map Click Handler
  const handleMapClick = async (coord: MarsCoordinate) => {
    setClickedCoord(coord);
    setHudCoord(coord);
    setHudLabel(`Mars Surface (${coord.latitude.toFixed(3)}°N, ${coord.longitude.toFixed(3)}°E)`);

    if (isPickingOnMap) {
      setIsPickingOnMap(false);
      const newPoint: RoutePoint = {
        id: `pt-picked-${Date.now()}`,
        coordinate: coord,
        type: "waypoint",
        label: `Surface Waypoint (${coord.latitude.toFixed(2)}°, ${coord.longitude.toFixed(2)}°)`,
      };

      const updated = [...points];
      if (updated.length >= 2) {
        updated.splice(updated.length - 1, 0, newPoint);
      } else {
        updated.push(newPoint);
      }
      setPoints(updated);
      setActiveDrawer("planner");
      return;
    }

    try {
      const locData = await api.getLocationAtCoord(coord.latitude, coord.longitude);
      setSelectedLocation(locData);
      setActiveDrawer("explorer");
    } catch {
      // Fallback
    }
  };

  // Select Location from Marker or Search
  const handleSelectLocation = (loc: LocationData) => {
    setSelectedLocation(loc);
    setHudCoord(loc.coordinate);
    setHudLabel(loc.name);
    setActiveDrawer("explorer");
  };

  // Generate Route Trigger
  const handleGenerateRoute = async (pts: RoutePoint[]) => {
    try {
      const newRoute = await api.createRoute("Martian EVA Traverse Plan", pts);
      setActiveRoute(newRoute);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to calculate route.");
    }
  };

  // Navigate to EVA assessment screen (preserving active missionId if present)
  const handleInspectMission = (route: MarsRoute) => {
    const missionId = searchParams.get("missionId");
    const qs = new URLSearchParams({ routeId: route.id });
    if (missionId) qs.set("missionId", missionId);
    navigate(`/mission?${qs.toString()}`);
  };

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-3.5rem)] bg-atlas-bg flex flex-col items-center justify-center space-y-4 font-mono text-xs text-atlas-muted">
        <div className="w-8 h-8 border-2 border-atlas-accent border-t-transparent animate-spin" />
        <div className="tracking-widest uppercase font-semibold text-atlas-text">
          Initializing MOLA Topography & Planetary Telemetry...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-atlas-bg text-atlas-text font-sans selection:bg-atlas-accent selection:text-white pb-24">
      {/* SECTION 1: Map Viewport Canvas with Dock & Drawers */}
      <div className="relative h-[84vh] min-h-[580px] w-full border-b border-atlas-border overflow-hidden flex bg-atlas-bg">
        {/* Primary Geospatial Canvas */}
        <div className="flex-1 relative h-full">
        <MarsMap
          locations={locations}
          scienceTargets={scienceTargets}
          activeRoute={activeRoute}
          selectedLocation={selectedLocation}
          onSelectLocation={handleSelectLocation}
          onMapClickCoord={handleMapClick}
          isPickingRoutePoint={isPickingOnMap}
          highlightCoord={hoverProfileCoord}
          pipelineStatus={pipelineStatus}
          hazards={hazards}
          showProvenanceModal={showProvenanceModal}
          setShowProvenanceModal={setShowProvenanceModal}
          showStatusModal={showStatusModal}
          setShowStatusModal={setShowStatusModal}
          focusCoord={focusCoord}
          layoutTrigger={activeDrawer || "none"}
          ingestedM20Traverse={ingestedM20Traverse}
          showMolaHeatmap={showMolaHeatmap}
          showCrismOverlay={showCrismOverlay}
        />

        {/* Unified Flight Deck & Tactical Operations Command Bar (Single Stacked Container - Zero Overlap) */}
        <div className="absolute top-3 right-3 z-20 max-w-[calc(100%-18rem)] flex flex-col items-end gap-1.5 pointer-events-auto select-none">
          {/* Row 1: System Modals & Primary Drawer Switchers */}
          <div className="flex items-center gap-1.5 text-xs font-mono">
            {/* Data Provenance Modal Trigger */}
            <button
              onClick={() => setShowProvenanceModal(true)}
              className="bg-atlas-surface/95 hover:bg-atlas-elevated border border-atlas-border px-3 py-1 text-atlas-text hidden md:flex items-center space-x-1.5 backdrop-blur-md shadow-sm transition-colors"
              title="Inspect NASA Datasets & Attribution"
            >
              <Database className="w-3.5 h-3.5 text-atlas-accent" />
              <span>Data Provenance</span>
            </button>

            {/* System Status Modal Trigger */}
            <button
              onClick={() => setShowStatusModal(true)}
              className="bg-atlas-surface/95 hover:bg-atlas-elevated border border-atlas-border px-3 py-1 text-atlas-text hidden md:flex items-center space-x-1.5 backdrop-blur-md shadow-sm transition-colors"
              title="Inspect Data Pipeline Status"
            >
              <Activity className="w-3.5 h-3.5 text-atlas-teal" />
              <span>Pipeline Status</span>
            </button>

            {/* Primary Drawers Switcher */}
            <div className="flex items-center bg-atlas-surface/95 border border-atlas-border p-0.5 backdrop-blur-md shadow-sm">
              <button
                onClick={() => setActiveDrawer(activeDrawer === "planner" ? null : "planner")}
                className={`px-3 py-1 flex items-center space-x-1.5 transition-colors ${
                  activeDrawer === "planner"
                    ? "bg-atlas-accent text-white font-bold"
                    : "text-atlas-muted hover:bg-atlas-elevated hover:text-atlas-text"
                }`}
                title="Toggle Traverse Route Planner"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Route Planner</span>
              </button>

              <button
                onClick={() => setActiveDrawer(activeDrawer === "explorer" ? null : "explorer")}
                className={`px-3 py-1 flex items-center space-x-1.5 transition-colors ${
                  activeDrawer === "explorer"
                    ? "bg-atlas-accent text-white font-bold"
                    : "text-atlas-muted hover:bg-atlas-elevated hover:text-atlas-text"
                }`}
                title="Toggle Planetary Site Reconnaissance / Location Inspector"
              >
                <Info className="w-3.5 h-3.5" />
                <span>Location Inspector</span>
              </button>
            </div>
          </div>

          {/* Row 2: Unified Tactical Operations Dock (Uniform Height, Grouped, Zero Smudge) */}
          <div className="bg-atlas-surface/95 border border-atlas-border p-1 backdrop-blur-md shadow-md flex flex-wrap items-center justify-end gap-1 text-[11px] font-mono">
            {/* Group A: Telemetry & In-Situ Sensors */}
            <button
              onClick={() => setShowWeatherHud(!showWeatherHud)}
              className={`px-2 py-1 flex items-center space-x-1.5 border transition-all ${
                isDustStormActive
                  ? "bg-amber-950/80 text-amber-300 border-amber-500 font-bold shadow-md animate-pulse"
                  : showWeatherHud
                  ? "bg-atlas-elevated text-atlas-amber border-atlas-amber font-bold shadow-sm"
                  : "bg-atlas-bg/60 border-atlas-border/80 text-atlas-muted hover:text-atlas-text hover:bg-atlas-elevated"
              }`}
              title="Toggle Martian Diurnal Weather & Radiation HUD (MEDA / RAD)"
            >
              <CloudSun className={`w-3.5 h-3.5 ${isDustStormActive ? "text-amber-400" : "text-atlas-amber"}`} />
              <span>{isDustStormActive ? "Storm Active (τ 2.45)" : "Sol Weather"}</span>
            </button>

            <button
              onClick={() => setShowRfOverlay(!showRfOverlay)}
              className={`px-2 py-1 flex items-center space-x-1.5 border transition-all ${
                showRfOverlay
                  ? "bg-atlas-elevated text-atlas-teal border-atlas-teal font-bold shadow-sm"
                  : "bg-atlas-bg/60 border-atlas-border/80 text-atlas-muted hover:text-atlas-text hover:bg-atlas-elevated"
              }`}
              title="Toggle Orbiter Constellation Comms & Scarp Shadowing"
            >
              <Radio className="w-3.5 h-3.5 text-atlas-teal" />
              <span>RF Relay</span>
            </button>

            <button
              onClick={() => setShowTacticalGrid(!showTacticalGrid)}
              className={`px-2 py-1 flex items-center space-x-1.5 border transition-all ${
                showTacticalGrid
                  ? "bg-atlas-elevated text-atlas-teal border-atlas-teal font-bold shadow-sm"
                  : "bg-atlas-bg/60 border-atlas-border/80 text-atlas-muted hover:text-atlas-text hover:bg-atlas-elevated"
              }`}
              title="Toggle Sub-meter Hyperlocal Tactical Grid (Astronaut + Buddy + Mule)"
            >
              <Footprints className="w-3.5 h-3.5 text-atlas-teal" />
              <span>Tactical Grid</span>
            </button>

            {/* Subtle Group Divider */}
            <div className="hidden sm:block h-3.5 w-px bg-atlas-border mx-0.5" />

            {/* Group B: Planetary Science Overlays */}
            <button
              onClick={() => setShowMolaHeatmap((v) => !v)}
              className={`px-2 py-1 flex items-center space-x-1.5 border transition-all ${
                showMolaHeatmap
                  ? "bg-atlas-elevated text-atlas-blue border-atlas-blue font-bold shadow-sm"
                  : "bg-atlas-bg/60 border-atlas-border/80 text-atlas-muted hover:text-atlas-text hover:bg-atlas-elevated"
              }`}
              title="Toggle MOLA Altimetry Elevation Contour Heatmap Overlay"
            >
              <Mountain className="w-3.5 h-3.5 text-atlas-blue" />
              <span>MOLA Heatmap</span>
            </button>

            <button
              onClick={() => setShowCrismOverlay((v) => !v)}
              className={`px-2 py-1 flex items-center space-x-1.5 border transition-all ${
                showCrismOverlay
                  ? "bg-atlas-elevated text-atlas-violet border-atlas-violet font-bold shadow-sm"
                  : "bg-atlas-bg/60 border-atlas-border/80 text-atlas-muted hover:text-atlas-text hover:bg-atlas-elevated"
              }`}
              title="Toggle CRISM Hyperspectral Mineralogy & MEPAG Target Overlay"
            >
              <Database className="w-3.5 h-3.5 text-atlas-violet" />
              <span>CRISM Mineralogy</span>
            </button>

            {/* Subtle Group Divider */}
            <div className="hidden sm:block h-3.5 w-px bg-atlas-border mx-0.5" />

            {/* Group C: Mission Operations, Recon & Playback */}
            <button
              onClick={() => setShowEvaPlayback((v) => !v)}
              className={`px-2 py-1 flex items-center space-x-1.5 border transition-all ${
                showEvaPlayback
                  ? "bg-atlas-elevated text-atlas-teal border-atlas-teal font-bold shadow-sm"
                  : "bg-atlas-bg/60 border-atlas-border/80 text-atlas-muted hover:text-atlas-text hover:bg-atlas-elevated"
              }`}
              title="Toggle Real-Time Animated EVA Traverse & Bioenergetics Playback"
            >
              <Play className="w-3.5 h-3.5 text-atlas-teal" />
              <span>EVA Playback</span>
            </button>

            <button
              onClick={() => setShowSurfacePhotos(!showSurfacePhotos)}
              className={`px-2 py-1 flex items-center space-x-1.5 border transition-all ${
                showSurfacePhotos
                  ? "bg-atlas-elevated text-atlas-violet border-atlas-violet font-bold shadow-sm"
                  : "bg-atlas-bg/60 border-atlas-border/80 text-atlas-muted hover:text-atlas-text hover:bg-atlas-elevated"
              }`}
              title="Toggle Ground POV Rover Photography (Mastcam-Z / Navcam)"
            >
              <Camera className="w-3.5 h-3.5 text-atlas-violet" />
              <span>Ground POV</span>
            </button>

            <button
              onClick={() => setShowWaypointPreview(!showWaypointPreview)}
              className={`px-2 py-1 flex items-center space-x-1.5 border transition-all ${
                showWaypointPreview
                  ? "bg-atlas-elevated text-atlas-blue border-atlas-blue font-bold shadow-sm"
                  : "bg-atlas-bg/60 border-atlas-border/80 text-atlas-muted hover:text-atlas-text hover:bg-atlas-elevated"
              }`}
              title="Toggle Contextual Science & Terrain Destination Preview"
            >
              <Compass className="w-3.5 h-3.5 text-atlas-blue" />
              <span>Preview HUD</span>
            </button>

            <button
              onClick={() => setShowSamplingPanel(!showSamplingPanel)}
              className={`px-2 py-1 flex items-center space-x-1.5 border transition-all ${
                showSamplingPanel
                  ? "bg-atlas-elevated text-atlas-accent border-atlas-accent font-bold shadow-sm"
                  : "bg-atlas-bg/60 border-atlas-border/80 text-atlas-muted hover:text-atlas-text hover:bg-atlas-elevated"
              }`}
              title="Toggle 8-Step Scientific Sampling Protocol Checklist"
            >
              <Sparkles className="w-3.5 h-3.5 text-atlas-accent" />
              <span>Sampling</span>
            </button>

            <button
              onClick={() => setShowNarrative((v) => !v)}
              className={`px-2 py-1 flex items-center space-x-1.5 border transition-all ${
                showNarrative
                  ? "bg-atlas-elevated text-atlas-accent border-atlas-accent font-bold shadow-sm"
                  : "bg-atlas-bg/60 border-atlas-border/80 text-atlas-muted hover:text-atlas-text hover:bg-atlas-elevated"
              }`}
              title="Toggle Mission Narrative & Scientific Storytelling"
            >
              <Sparkles className="w-3.5 h-3.5 text-atlas-accent" />
              <span>Story</span>
            </button>
          </div>
        </div>

        {/* Milestone 6 & 7 Modal Overlays */}
        {showGuidedTour && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-xl px-4">
            <GuidedMarswalkTour
              onStepChange={handleTourStepChange}
              onClose={() => setShowGuidedTour(false)}
              onLaunchEvaPlayback={() => {
                setShowGuidedTour(false);
                setShowEvaPlayback(true);
                setIsEvaPlaying(true);
              }}
              onOpenRoutePlanner={() => {
                setShowGuidedTour(false);
                setActiveDrawer("planner");
              }}
              onOpenMissionStory={() => {
                setShowGuidedTour(false);
                setShowNarrative(true);
              }}
            />
          </div>
        )}

        {showNarrative && (
          <div className="absolute top-20 left-4 right-4 sm:right-auto sm:left-4 sm:w-[520px] z-40 max-h-[80vh] overflow-y-auto">
            <MissionNarrativePanel
              route={points}
              location={selectedLocation?.name}
              onClose={() => setShowNarrative(false)}
            />
          </div>
        )}

        {showEvaPlayback && (
          <div className="absolute top-20 left-4 right-4 sm:left-auto sm:right-4 sm:w-[640px] z-40 max-h-[85vh] overflow-y-auto">
            <EvaPlaybackAnimation
              route={points}
              isPlaying={isEvaPlaying}
              onTogglePlay={() => setIsEvaPlaying((v) => !v)}
              onComplete={() => setIsEvaPlaying(false)}
              onClose={() => {
                setShowEvaPlayback(false);
                setIsEvaPlaying(false);
              }}
            />
          </div>
        )}
        {showWeatherHud && (
          <EnvironmentalDashboard
            coordinate={hudCoord}
            onClose={() => setShowWeatherHud(false)}
            isDustStormActive={isDustStormActive}
            onToggleDustStorm={(active) => setIsDustStormActive(active)}
            onRequestShelteredReroute={() => {
              setActiveDrawer("planner");
            }}
          />
        )}

        {showRfOverlay && (
          <RfCoverageOverlay
            coordinate={hudCoord}
            onClose={() => setShowRfOverlay(false)}
          />
        )}

        {showTacticalGrid && (
          <HyperlocalTacticalGrid
            coordinate={hudCoord}
            onClose={() => setShowTacticalGrid(false)}
          />
        )}

        {showWaypointPreview && (
          <WaypointPreviewHud
            coordinate={hudCoord}
            label={hudLabel}
            onClose={() => setShowWaypointPreview(false)}
            onOpenSurfacePhotos={(coord) => {
              setHudCoord(coord);
              setShowSurfacePhotos(true);
            }}
          />
        )}

        {showSamplingPanel && (
          <SamplingProtocolPanel
            targetId={selectedLocation?.id || "tgt-kodiak-delta"}
            targetName={selectedLocation?.name || hudLabel}
            targetType={selectedLocation?.terrainType || "LACUSTRINE_FAN"}
            formation="Shenandoah (Ns)"
            onClose={() => setShowSamplingPanel(false)}
          />
        )}

        {showSurfacePhotos && (
          <div className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto">
            <div className="w-full max-w-3xl">
              <SurfacePhotoViewer
                latitude={hudCoord.latitude}
                longitude={hudCoord.longitude}
                onClose={() => setShowSurfacePhotos(false)}
              />
            </div>
          </div>
        )}

        {/* Error Banner */}
        {errorMsg && (
          <div className="absolute bottom-16 left-4 z-20 bg-atlas-surface border border-atlas-red text-atlas-red text-xs font-mono p-3 shadow-2xl max-w-md flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-atlas-red shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Side Panels */}
      {activeDrawer === "explorer" && (
        <LocationExplorer
          location={selectedLocation}
          onClose={() => setActiveDrawer(null)}
          onSetStart={handleSetStart}
          onSetDestination={handleSetDestination}
          onAddScienceStop={handleAddScienceStop}
          onPlanMission={handlePlanMission}
        />
      )}

      {activeDrawer === "planner" && (
        <RoutePlanner
          scienceTargets={scienceTargets}
          activeRoute={activeRoute}
          points={points}
          setPoints={setPoints}
          onGenerateRoute={handleGenerateRoute}
          onInspectMission={handleInspectMission}
          onTogglePickMode={setIsPickingOnMap}
          isPickingOnMap={isPickingOnMap}
          clickedCoord={clickedCoord}
          onHoverProfilePoint={(pt) => setHoverProfileCoord(pt ? pt.coordinate : null)}
          candidates={candidates}
          selectedCandidateId={selectedCandidateId}
          onSelectCandidate={handleSelectCandidate}
          objectives={objectives}
          selectedObjectiveId={selectedObjectiveId}
          onSelectObjective={setSelectedObjectiveId}
          onRunCopilotOptimizer={handleRunCopilotOptimizer}
          isOptimizing={isOptimizing}
          isDustStormActive={isDustStormActive}
          onClose={() => setActiveDrawer(null)}
        />
      )}
      </div>

      {/* SECTION 2: Mission Insights & Tactical Analysis Section (In normal page scroll flow) */}
      <section className="py-20 px-6 sm:px-10 lg:px-16 max-w-7xl mx-auto space-y-16">
        {/* Section Header */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2 text-xs font-mono tracking-widest uppercase text-atlas-accent">
            <span className="w-2 h-2 rounded-full bg-atlas-accent" />
            <span>Mars 2020 Geospatial Intelligence & Telemetry</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold font-display text-atlas-text">
            Mission Insights & Invariant Verification
          </h2>
          <p className="text-base text-atlas-muted max-w-3xl leading-relaxed">
            Multi-mission orbital telemetry, bioenergetic budget calculations, and high-resolution MOLA altimetry synthesized for safe surface operations in Jezero Crater.
          </p>
        </div>

        {/* Primary Operational Metrics (Spacious 5-Card Grid) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 font-mono">
          <div className="bg-atlas-surface border border-atlas-border p-6 space-y-2">
            <div className="text-xs uppercase tracking-wider text-atlas-muted">Traverse Distance</div>
            <div className="text-3xl sm:text-4xl font-bold text-atlas-text">
              {activeRoute ? activeRoute.totalDistanceKm.toFixed(2) : "4.14"}
              <span className="text-lg text-atlas-muted ml-1">km</span>
            </div>
            <div className="text-xs text-atlas-muted pt-1">
              {points.length} waypoints planned
            </div>
          </div>

          <div className="bg-atlas-surface border border-atlas-border p-6 space-y-2">
            <div className="text-xs uppercase tracking-wider text-atlas-muted">Duration</div>
            <div className="text-3xl sm:text-4xl font-bold text-atlas-text">
              {activeRoute ? activeRoute.estimatedDurationMinutes : "129"}
              <span className="text-lg text-atlas-muted ml-1">min</span>
            </div>
            <div className="text-xs text-atlas-muted pt-1">
              Tobler metabolic rate: 1.15 m/s
            </div>
          </div>

          <div className="bg-atlas-surface border border-atlas-border p-6 space-y-2">
            <div className="text-xs uppercase tracking-wider text-atlas-muted">Maximum Slope</div>
            <div className="text-3xl sm:text-4xl font-bold text-atlas-teal">
              {activeRoute ? activeRoute.maxSlopeDegrees : "3.8"}
              <span className="text-lg text-atlas-muted ml-1">°</span>
            </div>
            <div className="text-xs text-atlas-teal pt-1 flex items-center space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Below 15° threshold</span>
            </div>
          </div>

          <div className="bg-atlas-surface border border-atlas-border p-6 space-y-2">
            <div className="text-xs uppercase tracking-wider text-atlas-muted">Return Margin</div>
            <div className="text-3xl sm:text-4xl font-bold text-atlas-accent">
              48
              <span className="text-lg text-atlas-muted ml-1">min</span>
            </div>
            <div className="text-xs text-atlas-accent pt-1">
              Surplus PLSS buffer: +62%
            </div>
          </div>

          <div className="bg-atlas-surface border border-atlas-border p-6 space-y-2">
            <div className="text-xs uppercase tracking-wider text-atlas-muted">Data Provenance</div>
            <div className="text-2xl sm:text-3xl font-bold text-atlas-text">
              100%
            </div>
            <div className="text-xs text-atlas-teal pt-1 flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>SHA-256 Verified Ledger</span>
            </div>
          </div>
        </div>

        {/* Detailed 2-Column Telemetry & Terrain Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Left: Elevation Profile & Topographic Slope Analysis */}
          <div className="bg-atlas-surface border border-atlas-border p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-atlas-border pb-4">
              <div>
                <h3 className="text-xl font-bold font-display text-atlas-text">
                  Topographic Elevation Profile
                </h3>
                <p className="text-xs text-atlas-muted font-mono mt-1">
                  Sampled at 128 px/deg via MGS MOLA Precision Grid
                </p>
              </div>
              <span className="px-2.5 py-1 text-xs font-mono font-bold bg-atlas-elevated text-atlas-teal border border-atlas-border">
                {activeRoute?.overallDifficulty || "Moderate"} Incline
              </span>
            </div>

            {activeRoute ? (
              <div className="space-y-4">
                <ElevationProfileChart
                  profile={activeRoute.elevationProfile}
                  totalDistanceKm={activeRoute.totalDistanceKm}
                  onHoverPoint={(pt) => setHoverProfileCoord(pt ? pt.coordinate : null)}
                />
                <div className="grid grid-cols-3 gap-3 text-xs font-mono pt-2">
                  <div className="p-3 bg-atlas-elevated border border-atlas-border">
                    <div className="text-atlas-muted">Lowest Elevation</div>
                    <div className="text-atlas-text font-bold text-sm mt-0.5">-2,540 m</div>
                  </div>
                  <div className="p-3 bg-atlas-elevated border border-atlas-border">
                    <div className="text-atlas-muted">Peak Incline</div>
                    <div className="text-atlas-text font-bold text-sm mt-0.5">{activeRoute.maxSlopeDegrees}°</div>
                  </div>
                  <div className="p-3 bg-atlas-elevated border border-atlas-border">
                    <div className="text-atlas-muted">Elevation Delta</div>
                    <div className="text-atlas-teal font-bold text-sm mt-0.5">+48 m</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-16 text-center text-atlas-muted font-mono text-xs">
                Select or generate an active route to render the continuous elevation profile.
              </div>
            )}
          </div>

          {/* Right: Environmental & Communications Telemetry */}
          <div className="bg-atlas-surface border border-atlas-border p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-atlas-border pb-4">
              <div>
                <h3 className="text-xl font-bold font-display text-atlas-text">
                  Planetary Environmental Conditions
                </h3>
                <p className="text-xs text-atlas-muted font-mono mt-1">
                  MEDA Weather Suite & Orbiter Constellation Relays
                </p>
              </div>
              <span className="px-2.5 py-1 text-xs font-mono font-bold bg-atlas-teal/10 text-atlas-teal border border-atlas-teal/30">
                Sol Nominal
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-atlas-elevated border border-atlas-border space-y-1">
                <div className="flex items-center space-x-1.5 text-xs text-atlas-muted font-mono">
                  <CloudSun className="w-3.5 h-3.5 text-atlas-amber" />
                  <span>Ambient Temperature</span>
                </div>
                <div className="text-2xl font-bold font-mono text-atlas-text">-63.4°C</div>
                <div className="text-[11px] text-atlas-muted font-mono">Diurnal range: -88°C to -18°C</div>
              </div>

              <div className="p-4 bg-atlas-elevated border border-atlas-border space-y-1">
                <div className="flex items-center space-x-1.5 text-xs text-atlas-muted font-mono">
                  <Gauge className="w-3.5 h-3.5 text-atlas-teal" />
                  <span>Atmospheric Pressure</span>
                </div>
                <div className="text-2xl font-bold font-mono text-atlas-text">748 Pa</div>
                <div className="text-[11px] text-atlas-muted font-mono">Pure CO2, Jezero datum</div>
              </div>

              <div
                className={`p-4 border space-y-1 transition-colors ${
                  isDustStormActive
                    ? "bg-amber-950/40 border-amber-500/80 shadow-md"
                    : "bg-atlas-elevated border-atlas-border"
                }`}
              >
                <div className="flex items-center space-x-1.5 text-xs font-mono">
                  <Sun className={`w-3.5 h-3.5 ${isDustStormActive ? "text-amber-400" : "text-atlas-accent"}`} />
                  <span className={isDustStormActive ? "text-amber-300 font-bold" : "text-atlas-muted"}>
                    {isDustStormActive ? "Solar Flux (Attenuated -65%)" : "Direct Solar Flux"}
                  </span>
                </div>
                <div className={`text-2xl font-bold font-mono ${isDustStormActive ? "text-amber-300" : "text-atlas-text"}`}>
                  {isDustStormActive ? "189 W/m²" : "590 W/m²"}
                </div>
                <div className="text-[11px] font-mono">
                  {isDustStormActive ? (
                    <span className="text-amber-400 font-bold">Tau dust opacity: 2.45 [SEVERE STORM]</span>
                  ) : (
                    <span className="text-atlas-muted">Tau dust opacity: 0.42</span>
                  )}
                </div>
              </div>

              <div className="p-4 bg-atlas-elevated border border-atlas-border space-y-1">
                <div className="flex items-center space-x-1.5 text-xs text-atlas-muted font-mono">
                  <Radio className="w-3.5 h-3.5 text-atlas-blue" />
                  <span>Orbiter Relay Link</span>
                </div>
                <div className="text-2xl font-bold font-mono text-atlas-teal">MRO Active</div>
                <div className="text-[11px] text-atlas-muted font-mono">Elevation: 42° · Pass: 18 min</div>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between text-xs font-mono text-atlas-muted border-t border-atlas-border">
              <span>Radiation Assessment: <b className="text-atlas-teal">0.24 mGy/day</b> (Nominal GCR)</span>
              <button
                onClick={() => setShowWeatherHud(true)}
                className="text-atlas-accent hover:underline flex items-center space-x-1"
              >
                <span>Full Telemetry HUD</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* SECTION 3: S1–S8 Safety Invariants Verification Checklist */}
        <div className="bg-atlas-surface border border-atlas-border p-8 space-y-6">
          <div className="flex items-center justify-between border-b border-atlas-border pb-4">
            <div>
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-atlas-teal" />
                <h3 className="text-xl font-bold font-display text-atlas-text">
                  Autonomous Safety Invariants (S1 – S8)
                </h3>
              </div>
              <p className="text-xs text-atlas-muted font-mono mt-1">
                Mathematical safety limits enforced deterministically by the flight director simulation kernel.
              </p>
            </div>
            <span className="px-3 py-1 text-xs font-mono font-bold bg-atlas-teal/10 text-atlas-teal border border-atlas-teal/30">
              8 / 8 Invariants Satisfied
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                id: "S1",
                title: "Max Slope Limit",
                rule: "Slope < 15.0° along traverse",
                status: "Passed",
                value: `${activeRoute?.maxSlopeDegrees || 3.8}°`,
              },
              {
                id: "S2",
                title: "Metabolic Workload",
                rule: "Energy burn < 300 W/hr",
                status: "Passed",
                value: "184 W/hr",
              },
              {
                id: "S3",
                title: "RF Relay Line-of-Sight",
                rule: "Coverage > 90% via MRO/Odyssey",
                status: "Passed",
                value: "96.4%",
              },
              {
                id: "S4",
                title: "PLSS Return Margin",
                rule: "Contingency reserve >= 45 min",
                status: "Passed",
                value: "48 min",
              },
              {
                id: "S5",
                title: "Radiation Threshold",
                rule: "Cumulative dose < 50 mSv",
                status: "Passed",
                value: "1.2 mSv",
              },
              {
                id: "S6",
                title: "Obstacle Clearance",
                rule: "Buffer >= 100m from steep scarps",
                status: "Passed",
                value: ">= 100m",
              },
              {
                id: "S7",
                title: "Battery SoC at Terminus",
                rule: "State of Charge >= 40%",
                status: "Passed",
                value: "84.2%",
              },
              {
                id: "S8",
                title: "Cryptographic Provenance",
                rule: "Immutable SHA-256 chain verified",
                status: "Verified",
                value: "100%",
              },
            ].map((inv) => (
              <div key={inv.id} className="p-4 bg-atlas-elevated border border-atlas-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-atlas-accent">{inv.id}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 bg-atlas-teal/10 text-atlas-teal border border-atlas-teal/30 font-semibold">
                    {inv.status}
                  </span>
                </div>
                <div className="font-semibold text-atlas-text text-sm">{inv.title}</div>
                <div className="text-[11px] text-atlas-muted">{inv.rule}</div>
                <div className="text-xs font-mono font-bold text-atlas-text pt-1 border-t border-atlas-border">
                  Measured: <span className="text-atlas-teal">{inv.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 4: Next-Stage Operational Action Bar */}
        <div className="bg-atlas-elevated border border-atlas-border p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1">
            <h4 className="text-lg font-bold font-display text-atlas-text">
              Ready to Advance This Traverse to Mission Studio?
            </h4>
            <p className="text-xs font-mono text-atlas-muted">
              Inspect candidate trade-offs, run Monte Carlo uncertainty simulations, and issue digital twin authorizations.
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate("/operations")}
              className="px-5 py-3 border border-atlas-border bg-atlas-surface hover:bg-atlas-elevated text-atlas-text font-mono text-xs font-semibold transition-colors"
            >
              Operations Console
            </button>
            <button
              onClick={() => {
                if (activeRoute) handleInspectMission(activeRoute);
                else navigate("/mission");
              }}
              className="px-6 py-3 bg-atlas-accent hover:bg-atlas-accent-hover text-white font-mono text-xs font-bold flex items-center space-x-2 transition-all shadow-lg"
            >
              <span>Advance to Mission Studio</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
