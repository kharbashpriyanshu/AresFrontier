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
          .catch(() => {});

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
    <div className="relative h-[calc(100vh-3.5rem)] w-full overflow-hidden flex bg-atlas-bg transition-colors">
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

        {/* Unified Floating Controls Bar (Top Right) */}
        <div className="absolute top-4 right-4 z-20 max-w-[calc(100%-19rem)] flex flex-wrap items-center justify-end gap-2 text-xs font-mono shadow-2xl pointer-events-auto">
          {/* Data Provenance Modal Trigger */}
          <button
            onClick={() => setShowProvenanceModal(true)}
            className="bg-atlas-surface/95 hover:bg-atlas-elevated border border-atlas-border px-3 py-1.5 text-atlas-text hidden md:flex items-center space-x-1.5 backdrop-blur-md shadow-lg transition-colors"
            title="Inspect NASA Datasets & Attribution"
          >
            <Database className="w-3.5 h-3.5 text-atlas-accent" />
            <span>Data Provenance</span>
          </button>

          {/* System Status Modal Trigger */}
          <button
            onClick={() => setShowStatusModal(true)}
            className="bg-atlas-surface/95 hover:bg-atlas-elevated border border-atlas-border px-3 py-1.5 text-atlas-text hidden md:flex items-center space-x-1.5 backdrop-blur-md shadow-lg transition-colors"
            title="Inspect Data Pipeline Status"
          >
            <Activity className="w-3.5 h-3.5 text-atlas-teal" />
            <span>Pipeline Status</span>
          </button>

          {/* Drawer Switcher */}
          <div className="flex items-center bg-atlas-surface/95 border border-atlas-border p-0.5 backdrop-blur-md">
            <button
              onClick={() => setActiveDrawer(activeDrawer === "planner" ? null : "planner")}
              className={`px-3 py-1.5 flex items-center space-x-1.5 transition-colors ${
                activeDrawer === "planner"
                  ? "bg-atlas-accent text-white font-bold"
                  : "text-atlas-muted hover:bg-atlas-elevated hover:text-atlas-text"
              }`}
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Route Planner</span>
            </button>

            <button
              onClick={() => setActiveDrawer(activeDrawer === "explorer" ? null : "explorer")}
              className={`px-3 py-1.5 flex items-center space-x-1.5 transition-colors ${
                activeDrawer === "explorer"
                  ? "bg-atlas-accent text-white font-bold"
                  : "text-atlas-muted hover:bg-atlas-elevated hover:text-atlas-text"
              }`}
            >
              <Info className="w-3.5 h-3.5" />
              <span>Location Inspector</span>
            </button>
          </div>
        </div>

        {/* Milestone 6 & 7 Tactical Operations Toolbar (Discrete Floating Pills with Zero Smudge) */}
        <div className="absolute top-14 right-4 z-20 max-w-[calc(100%-19rem)] flex flex-wrap items-center justify-end gap-1.5 text-[11px] font-mono pointer-events-auto">
          {/* Comms & Telemetry */}
          <button
            onClick={() => setShowWeatherHud(!showWeatherHud)}
            className={`px-2.5 py-1 flex items-center space-x-1.5 border backdrop-blur-md shadow-sm transition-colors ${
              showWeatherHud
                ? "bg-atlas-elevated text-atlas-amber border-atlas-amber font-bold"
                : "bg-atlas-surface/95 hover:bg-atlas-elevated text-atlas-muted hover:text-atlas-text border-atlas-border"
            }`}
            title="Toggle Martian Diurnal Weather & Radiation HUD (MEDA / RAD)"
          >
            <CloudSun className="w-3.5 h-3.5 text-atlas-amber" />
            <span>Sol Weather</span>
          </button>

          <button
            onClick={() => setShowRfOverlay(!showRfOverlay)}
            className={`px-2.5 py-1 flex items-center space-x-1.5 border backdrop-blur-md shadow-sm transition-colors ${
              showRfOverlay
                ? "bg-atlas-elevated text-atlas-teal border-atlas-teal font-bold"
                : "bg-atlas-surface/95 hover:bg-atlas-elevated text-atlas-muted hover:text-atlas-text border-atlas-border"
            }`}
            title="Toggle Orbiter Constellation Comms & Scarp Shadowing"
          >
            <Radio className="w-3.5 h-3.5 text-atlas-teal" />
            <span>RF Relay</span>
          </button>

          {/* Tactical & Surface Operations */}
          <button
            onClick={() => setShowTacticalGrid(!showTacticalGrid)}
            className={`px-2.5 py-1 flex items-center space-x-1.5 border backdrop-blur-md shadow-sm transition-colors ${
              showTacticalGrid
                ? "bg-atlas-elevated text-atlas-teal border-atlas-teal font-bold"
                : "bg-atlas-surface/95 hover:bg-atlas-elevated text-atlas-muted hover:text-atlas-text border-atlas-border"
            }`}
            title="Toggle Sub-meter Hyperlocal Tactical Grid (Astronaut + Buddy + Mule)"
          >
            <Footprints className="w-3.5 h-3.5 text-atlas-teal" />
            <span>Tactical Grid</span>
          </button>

          <button
            onClick={() => setShowEvaPlayback((v) => !v)}
            className={`px-2.5 py-1 flex items-center space-x-1.5 border backdrop-blur-md shadow-sm transition-colors ${
              showEvaPlayback
                ? "bg-atlas-elevated text-atlas-teal border-atlas-teal font-bold"
                : "bg-atlas-surface/95 hover:bg-atlas-elevated text-atlas-muted hover:text-atlas-text border-atlas-border"
            }`}
            title="Toggle Real-Time Animated EVA Traverse & Bioenergetics Playback"
          >
            <Play className="w-3.5 h-3.5 text-atlas-teal" />
            <span>EVA Playback</span>
          </button>

          <button
            onClick={() => setShowSurfacePhotos(!showSurfacePhotos)}
            className={`px-2.5 py-1 flex items-center space-x-1.5 border backdrop-blur-md shadow-sm transition-colors ${
              showSurfacePhotos
                ? "bg-atlas-elevated text-atlas-violet border-atlas-violet font-bold"
                : "bg-atlas-surface/95 hover:bg-atlas-elevated text-atlas-muted hover:text-atlas-text border-atlas-border"
            }`}
            title="Toggle Ground POV Rover Photography (Mastcam-Z / Navcam)"
          >
            <Camera className="w-3.5 h-3.5 text-atlas-violet" />
            <span>Ground POV</span>
          </button>

          <button
            onClick={() => setShowWaypointPreview(!showWaypointPreview)}
            className={`px-2.5 py-1 flex items-center space-x-1.5 border backdrop-blur-md shadow-sm transition-colors ${
              showWaypointPreview
                ? "bg-atlas-elevated text-atlas-blue border-atlas-blue font-bold"
                : "bg-atlas-surface/95 hover:bg-atlas-elevated text-atlas-muted hover:text-atlas-text border-atlas-border"
            }`}
            title="Toggle Contextual Science & Terrain Destination Preview"
          >
            <Compass className="w-3.5 h-3.5 text-atlas-blue" />
            <span>Preview HUD</span>
          </button>

          {/* Science & Planetary Overlays */}
          <button
            onClick={() => setShowMolaHeatmap((v) => !v)}
            className={`px-2.5 py-1 flex items-center space-x-1.5 border backdrop-blur-md shadow-sm transition-colors ${
              showMolaHeatmap
                ? "bg-atlas-elevated text-atlas-blue border-atlas-blue font-bold"
                : "bg-atlas-surface/95 hover:bg-atlas-elevated text-atlas-muted hover:text-atlas-text border-atlas-border"
            }`}
            title="Toggle MOLA Altimetry Elevation Contour Heatmap Overlay"
          >
            <Mountain className="w-3.5 h-3.5 text-atlas-blue" />
            <span>MOLA Heatmap</span>
          </button>

          <button
            onClick={() => setShowCrismOverlay((v) => !v)}
            className={`px-2.5 py-1 flex items-center space-x-1.5 border backdrop-blur-md shadow-sm transition-colors ${
              showCrismOverlay
                ? "bg-atlas-elevated text-atlas-violet border-atlas-violet font-bold"
                : "bg-atlas-surface/95 hover:bg-atlas-elevated text-atlas-muted hover:text-atlas-text border-atlas-border"
            }`}
            title="Toggle CRISM Hyperspectral Mineralogy & MEPAG Target Overlay"
          >
            <Database className="w-3.5 h-3.5 text-atlas-violet" />
            <span>CRISM Mineralogy</span>
          </button>

          <button
            onClick={() => setShowSamplingPanel(!showSamplingPanel)}
            className={`px-2.5 py-1 flex items-center space-x-1.5 border backdrop-blur-md shadow-sm transition-colors ${
              showSamplingPanel
                ? "bg-atlas-elevated text-atlas-accent border-atlas-accent font-bold"
                : "bg-atlas-surface/95 hover:bg-atlas-elevated text-atlas-muted hover:text-atlas-text border-atlas-border"
            }`}
            title="Toggle 8-Step Scientific Sampling Protocol Checklist"
          >
            <Sparkles className="w-3.5 h-3.5 text-atlas-accent" />
            <span>Sampling</span>
          </button>

          <button
            onClick={() => setShowNarrative((v) => !v)}
            className={`px-2.5 py-1 flex items-center space-x-1.5 border backdrop-blur-md shadow-sm transition-colors ${
              showNarrative
                ? "bg-atlas-elevated text-atlas-accent border-atlas-accent font-bold"
                : "bg-atlas-surface/95 hover:bg-atlas-elevated text-atlas-muted hover:text-atlas-text border-atlas-border"
            }`}
            title="Toggle Mission Narrative & Scientific Storytelling"
          >
            <Sparkles className="w-3.5 h-3.5 text-atlas-accent" />
            <span>Story</span>
          </button>
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
            targetId="tgt-kodiak-delta"
            targetName={hudLabel}
            targetType="LACUSTRINE_FAN"
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
          onClose={() => setActiveDrawer(null)}
        />
      )}
    </div>
  );
};
