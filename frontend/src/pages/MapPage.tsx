import React, { useEffect, useState, useCallback } from "react";
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
import { Navigation, Info, Play, CheckCircle } from "lucide-react";

export const MapPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [locations, setLocations] = useState<LocationData[]>([]);
  const [scienceTargets, setScienceTargets] = useState<ScienceTarget[]>([]);
  const [activeRoute, setActiveRoute] = useState<MarsRoute | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  const [pipelineStatus, setPipelineStatus] = useState<SystemPipelineStatus | null>(null);

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
  const [demoActive, setDemoActive] = useState<boolean>(false);

  // Load initial datasets and pipeline status
  useEffect(() => {
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

        if (routes.length > 0) {
          setActiveRoute(routes[0]);
          if (routes[0].points && routes[0].points.length >= 2) {
            setPoints(routes[0].points);
          }
        }
        if (locs.length > 0) {
          setSelectedLocation(locs[0]);
        }

        // Check if query params requested adding science stop
        const addScienceId = searchParams.get("addScience");
        if (addScienceId) {
          const targetToAdd = targets.find((t) => t.id === addScienceId);
          if (targetToAdd) {
            handleAddScienceStop(targetToAdd);
            setActiveDrawer("planner");
          }
        }

        // Check if query param requested demo mode
        if (searchParams.get("demo") === "marswalk-001") {
          loadDemoMarswalk(locs, targets);
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

      // Default select Balanced candidate if available
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

  // Launch Deterministic Demo MARSWALK-001 (Phase 16)
  const loadDemoMarswalk = useCallback((locs?: LocationData[], tgts?: ScienceTarget[]) => {
    setDemoActive(true);
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
    setActiveDrawer("planner");

    // Automatically generate the route
    api.createRoute("MARSWALK-001: Jezero Delta & Séítah Recon", demoPoints).then((newRoute) => {
      setActiveRoute(newRoute);
    });
  }, [locations, scienceTargets]);

  // Set as Start Point (Phase 4 integration)
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

  // Set as Destination Point (Phase 4 integration)
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

  // Add Science Stop (Phase 4 & 8 integration)
  const handleAddScienceStop = (item: ScienceTarget | LocationData) => {
    const newPoint: RoutePoint = {
      id: `pt-sci-${Date.now()}`,
      coordinate: item.coordinate,
      type: "science",
      label: item.name,
      targetId: "id" in item ? item.id : undefined,
    };

    const updated = [...points];
    if (updated.length >= 2) {
      updated.splice(updated.length - 1, 0, newPoint);
    } else {
      updated.push(newPoint);
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

    if (isPickingOnMap) {
      // In pick mode: route planner takes coordinate as intermediate waypoint
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

    // Otherwise inspect clicked location on Mars
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

  // Navigate to EVA assessment screen
  const handleInspectMission = (route: MarsRoute) => {
    navigate(`/mission?routeId=${route.id}`);
  };

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-3.5rem)] bg-space-950 flex flex-col items-center justify-center space-y-4 font-mono text-xs text-slate-300">
        <div className="w-10 h-10 border-2 border-mars-accent border-t-transparent rounded-full animate-spin"></div>
        <div className="tracking-widest uppercase">Initializing MOLA Topographic & Telemetry Service...</div>
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100vh-3.5rem)] w-full overflow-hidden flex bg-space-950">
      {/* Primary Map Viewport */}
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
        />

        {/* Floating Controls (Top Right) */}
        <div className="absolute top-4 right-16 z-20 flex items-center space-x-2 font-mono text-xs shadow-xl">
          {/* Demo Button (Phase 16) */}
          <button
            onClick={() => loadDemoMarswalk()}
            className={`px-3 py-1.5 rounded flex items-center space-x-1.5 border transition-all ${
              demoActive
                ? "bg-emerald-950/90 text-emerald-300 border-emerald-500/50 shadow-emerald-950/50"
                : "bg-space-900/90 hover:bg-space-800 text-slate-200 border-space-700"
            }`}
            title="Load Pre-configured Demo Mission (MARSWALK-001)"
          >
            {demoActive ? <CheckCircle className="w-3.5 h-3.5 text-telemetry-emerald" /> : <Play className="w-3.5 h-3.5 text-mars-accent" />}
            <span className="font-bold">DEMO: MARSWALK-001</span>
          </button>

          {/* Drawer Switcher */}
          <div className="flex items-center space-x-1 bg-space-900/90 border border-space-800 rounded p-1 backdrop-blur-md">
            <button
              onClick={() => setActiveDrawer(activeDrawer === "planner" ? null : "planner")}
              className={`px-2.5 py-1.5 rounded flex items-center space-x-1.5 transition-colors ${
                activeDrawer === "planner"
                  ? "bg-mars-rust text-white font-bold"
                  : "text-slate-300 hover:bg-space-800 hover:text-white"
              }`}
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>ROUTE PLANNER</span>
            </button>

            <button
              onClick={() => setActiveDrawer(activeDrawer === "explorer" ? null : "explorer")}
              className={`px-2.5 py-1.5 rounded flex items-center space-x-1.5 transition-colors ${
                activeDrawer === "explorer"
                  ? "bg-mars-rust text-white font-bold"
                  : "text-slate-300 hover:bg-space-800 hover:text-white"
              }`}
            >
              <Info className="w-3.5 h-3.5" />
              <span>LOCATION INSPECTOR</span>
            </button>
          </div>
        </div>

        {/* Error Banner if any */}
        {errorMsg && (
          <div className="absolute bottom-16 left-4 z-20 bg-rose-950/90 border border-rose-500 text-rose-200 text-xs font-mono p-2.5 rounded shadow-lg max-w-md">
            ⚠️ {errorMsg}
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
        />
      )}
    </div>
  );
};
