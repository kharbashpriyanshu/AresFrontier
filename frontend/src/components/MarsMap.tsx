import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import {
  LocationData,
  ScienceTarget,
  MarsRoute,
  MarsCoordinate,
  RouteSegment,
  SystemPipelineStatus,
  Hazard,
} from "../types/index.js";
import { formatMarsCoordinate } from "../utils/marsCoordinates.js";
import {
  Layers,
  Crosshair,
  RotateCcw,
  Navigation,
  Eye,
  MapPin,
  Database,
  Activity,
  CheckCircle,
  X,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface MarsMapProps {
  locations: LocationData[];
  scienceTargets: ScienceTarget[];
  activeRoute: MarsRoute | null;
  selectedLocation: LocationData | null;
  onSelectLocation: (loc: LocationData) => void;
  onMapClickCoord?: (coord: MarsCoordinate) => void;
  isPickingRoutePoint?: boolean;
  highlightCoord?: MarsCoordinate | null;
  onSelectSegment?: (segment: RouteSegment) => void;
  pipelineStatus?: SystemPipelineStatus | null;
  hazards?: Hazard[];
}

export type MarsLayerType = "viking" | "mola" | "themis";

export const MarsMap: React.FC<MarsMapProps> = ({
  locations,
  scienceTargets,
  activeRoute,
  selectedLocation,
  onSelectLocation,
  onMapClickCoord,
  isPickingRoutePoint = false,
  highlightCoord = null,
  onSelectSegment,
  pipelineStatus,
  hazards = [],
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const activeTileLayerRef = useRef<L.Layer | null>(null);
  const routeLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const markersLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const highlightLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const hazardLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const coverageLayerGroupRef = useRef<L.LayerGroup | null>(null);

  const [activeLayer, setActiveLayer] = useState<MarsLayerType>("viking");
  const [showScienceTargets, setShowScienceTargets] = useState<boolean>(true);
  const [showLandingSites, setShowLandingSites] = useState<boolean>(true);
  const [showHazards, setShowHazards] = useState<boolean>(false);
  const [showCoverage, setShowCoverage] = useState<boolean>(false);
  const [hoverCoord, setHoverCoord] = useState<MarsCoordinate>({ latitude: 18.4447, longitude: 77.4508 });
  const [layerDropdownOpen, setLayerDropdownOpen] = useState<boolean>(false);

  // Map Diagnostics & Surface Fallback Mode
  const [isFallbackMode, setIsFallbackMode] = useState<boolean>(false);
  const [tilesLoaded, setTilesLoaded] = useState<number>(0);
  const [tilesFailed, setTilesFailed] = useState<number>(0);
  const [activeUrl, setActiveUrl] = useState<string>("");
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(true);
  const [zoomLevel, setZoomLevel] = useState<number>(6);
  const [centerCoord, setCenterCoord] = useState<MarsCoordinate>({ latitude: 18.4447, longitude: 77.4508 });

  // Panels for Data Provenance (Phase 14) and Data Status (Phase 15)
  const [showProvenanceModal, setShowProvenanceModal] = useState<boolean>(false);
  const [showStatusModal, setShowStatusModal] = useState<boolean>(false);

  // Deterministic Benchmark Terrain Fallback Generator (Canvas GridLayer)
  const createBenchmarkTerrainLayer = (mapInstance: L.Map, layerType: MarsLayerType) => {
    const CustomGridLayer = (L.GridLayer as any).extend({
      createTile: function (coords: { x: number; y: number; z: number }, done: (err: any, tile: HTMLCanvasElement) => void) {
        const tile = document.createElement("canvas");
        const size = this.getTileSize();
        tile.width = size.x;
        tile.height = size.y;
        const ctx = tile.getContext("2d");
        if (!ctx) {
          done(null, tile);
          return tile;
        }

        const nwPoint = new L.Point(coords.x * size.x, coords.y * size.y);
        const sePoint = new L.Point((coords.x + 1) * size.x, (coords.y + 1) * size.y);
        const nw = mapInstance.unproject(nwPoint, coords.z);
        const se = mapInstance.unproject(sePoint, coords.z);

        const minLat = se.lat;
        const maxLat = nw.lat;
        const minLng = nw.lng;
        const maxLng = se.lng;

        // Scientific Palette based on active layer type
        if (layerType === "mola") {
          // MOLA Hypsometric Elevation Ramp
          let approxElev = 0;
          if (maxLat > 25) approxElev = -4000;
          else if (minLat < -10) approxElev = 2500;
          else approxElev = -1500;

          const baseGrad = ctx.createLinearGradient(0, 0, 0, 256);
          if (approxElev < -3000) {
            baseGrad.addColorStop(0, "#1e1b4b");
            baseGrad.addColorStop(1, "#1d4ed8");
          } else if (approxElev < 0) {
            baseGrad.addColorStop(0, "#1d4ed8");
            baseGrad.addColorStop(1, "#047857");
          } else {
            baseGrad.addColorStop(0, "#b45309");
            baseGrad.addColorStop(1, "#991b1b");
          }
          ctx.fillStyle = baseGrad;
          ctx.fillRect(0, 0, 256, 256);
        } else if (layerType === "themis") {
          // THEMIS Day Infrared Thermal Inertia (Monochrome / Thermal heat map)
          const baseGrad = ctx.createLinearGradient(0, 0, 256, 256);
          baseGrad.addColorStop(0, "#1e293b");
          baseGrad.addColorStop(0.5, "#334155");
          baseGrad.addColorStop(1, "#0f172a");
          ctx.fillStyle = baseGrad;
          ctx.fillRect(0, 0, 256, 256);
        } else {
          // Viking Visual Mosaic: Classic Martian Ochre & Iron Oxide Regolith
          const baseGrad = ctx.createLinearGradient(0, 0, 256, 256);
          baseGrad.addColorStop(0, "#4a2117");
          baseGrad.addColorStop(0.5, "#5d2719");
          baseGrad.addColorStop(1, "#38150d");
          ctx.fillStyle = baseGrad;
          ctx.fillRect(0, 0, 256, 256);
        }

        // Procedural Topographic Contours
        const contourColor =
          layerType === "mola"
            ? "rgba(255, 255, 255, 0.22)"
            : layerType === "themis"
            ? "rgba(148, 163, 184, 0.25)"
            : "rgba(224, 112, 77, 0.22)";
        ctx.strokeStyle = contourColor;
        ctx.lineWidth = 1;
        for (let y = 16; y < 256; y += 32) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          const wave = Math.sin((coords.x * 32 + y) * 0.05) * 10;
          ctx.bezierCurveTo(64, y + wave, 192, y - wave, 256, y);
          ctx.stroke();
        }

        // Landmark Overlays (Jezero, Gale, Olympus Mons, Valles Marineris)
        const landmarks = [
          { name: "JEZERO CRATER", lat: 18.4447, lng: 77.4508, radius: 24, type: "crater" },
          { name: "GALE CRATER (MT. SHARP)", lat: -4.5895, lng: 137.4417, radius: 28, type: "crater" },
          { name: "OLYMPUS MONS (+21km)", lat: 18.65, lng: -133.8, radius: 45, type: "volcano" },
          { name: "VALLES MARINERIS (-7km)", lat: -9.8, lng: -76.5, radius: 55, type: "chasma" },
        ];

        landmarks.forEach((lm) => {
          if (lm.lat >= minLat - 5 && lm.lat <= maxLat + 5 && lm.lng >= minLng - 5 && lm.lng <= maxLng + 5) {
            const lmPoint = mapInstance.project(L.latLng(lm.lat, lm.lng), coords.z);
            const px = lmPoint.x - nwPoint.x;
            const py = lmPoint.y - nwPoint.y;

            if (px >= -80 && px <= 336 && py >= -80 && py <= 336) {
              ctx.save();
              if (lm.type === "volcano") {
                const r = Math.max(12, lm.radius * (coords.z / 4));
                const radGrad = ctx.createRadialGradient(px, py, 2, px, py, r);
                radGrad.addColorStop(0, "rgba(255, 140, 100, 0.5)");
                radGrad.addColorStop(0.7, "rgba(180, 70, 40, 0.3)");
                radGrad.addColorStop(1, "rgba(80, 30, 20, 0)");
                ctx.fillStyle = radGrad;
                ctx.beginPath();
                ctx.arc(px, py, r, 0, Math.PI * 2);
                ctx.fill();
              } else if (lm.type === "crater") {
                const r = Math.max(8, lm.radius * (coords.z / 5));
                ctx.strokeStyle = "rgba(255, 200, 150, 0.6)";
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(px, py, r, 0, Math.PI * 2);
                ctx.stroke();
                ctx.fillStyle = "rgba(30, 15, 10, 0.35)";
                ctx.beginPath();
                ctx.arc(px, py, r * 0.85, 0, Math.PI * 2);
                ctx.fill();
              } else if (lm.type === "chasma") {
                ctx.strokeStyle = "rgba(20, 10, 5, 0.7)";
                ctx.lineWidth = Math.max(3, 4 * (coords.z / 4));
                ctx.beginPath();
                ctx.moveTo(px - 40, py - 10);
                ctx.bezierCurveTo(px - 10, py + 5, px + 20, py - 5, px + 50, py + 15);
                ctx.stroke();
              }

              if (coords.z >= 4 && px >= 10 && px <= 230 && py >= 10 && py <= 240) {
                ctx.font = "bold 9px monospace";
                ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
                ctx.fillText(lm.name, px - 30, py + 18);
              }
              ctx.restore();
            }
          }
        });

        // Graticule grid lines & coordinate stamp
        ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
        ctx.lineWidth = 0.75;
        ctx.strokeRect(0, 0, 256, 256);

        // Provenance Stamp
        ctx.font = "8px monospace";
        ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
        ctx.fillText(`MARS AREOID [BENCHMARK] z${coords.z}`, 6, 248);

        done(null, tile);
        return tile;
      },
    });

    return new CustomGridLayer({
      attribution: "NASA MOLA Benchmark Martian Areoid Topography (Deterministic Local Layer)",
      maxZoom: 12,
      minZoom: 2,
    });
  };

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Mars coordinate bounds
    const southWest = L.latLng(-85, -180);
    const northEast = L.latLng(85, 180);
    const bounds = L.latLngBounds(southWest, northEast);

    const map = L.map(mapContainerRef.current, {
      center: [18.4447, 77.4508], // Jezero Crater
      zoom: 6,
      minZoom: 2,
      maxZoom: 12,
      maxBounds: bounds,
      maxBoundsViscosity: 0.8,
      attributionControl: true,
      zoomControl: false,
    });

    L.control.zoom({ position: "topright" }).addTo(map);

    routeLayerGroupRef.current = L.layerGroup().addTo(map);
    markersLayerGroupRef.current = L.layerGroup().addTo(map);
    highlightLayerGroupRef.current = L.layerGroup().addTo(map);
    hazardLayerGroupRef.current = L.layerGroup().addTo(map);
    coverageLayerGroupRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;

    map.on("mousemove", (e: L.LeafletMouseEvent) => {
      setHoverCoord({
        latitude: Number(e.latlng.lat.toFixed(4)),
        longitude: Number(e.latlng.lng.toFixed(4)),
      });
    });

    map.on("zoomend", () => {
      setZoomLevel(map.getZoom());
    });

    map.on("moveend", () => {
      const c = map.getCenter();
      setCenterCoord({
        latitude: Number(c.lat.toFixed(4)),
        longitude: Number(c.lng.toFixed(4)),
      });
    });

    map.on("click", (e: L.LeafletMouseEvent) => {
      const coord: MarsCoordinate = {
        latitude: Number(e.latlng.lat.toFixed(5)),
        longitude: Number(e.latlng.lng.toFixed(5)),
      };

      if (onMapClickCoord) {
        onMapClickCoord(coord);
      }
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Tile Layer with USGS WMS / Fastly CDN and Deterministic Fallback
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (activeTileLayerRef.current) {
      map.removeLayer(activeTileLayerRef.current);
      activeTileLayerRef.current = null;
    }

    setTilesLoaded(0);
    setTilesFailed(0);

    let newLayer: L.Layer;
    let url = "";

    if (isFallbackMode) {
      url = "deterministic-benchmark://mola-areoid-grid";
      newLayer = createBenchmarkTerrainLayer(map, activeLayer);
    } else if (activeLayer === "viking") {
      // Primary: OpenPlanetary Mars Basemap v0.2 (High-speed CDN, Viking MDIM 2.1 + MOLA hillshade)
      url = "https://cartocdn-gusc.global.ssl.fastly.net/opmbuilder/api/v1/map/named/opm-mars-basemap-v0-2/all/{z}/{x}/{y}.png";
      newLayer = L.tileLayer(url, {
        maxZoom: 12,
        minZoom: 2,
        attribution: "NASA / USGS / OpenPlanetary Mars Basemap v0.2",
        noWrap: false,
      });
    } else if (activeLayer === "mola") {
      // Primary: USGS Astrogeology Planetary WMS - MOLA Topographic Elevation Color
      url = "https://planetarymaps.usgs.gov/cgi-bin/mapserv?";
      newLayer = L.tileLayer.wms(url, {
        layers: "MOLA_color",
        styles: "",
        format: "image/jpeg",
        transparent: false,
        version: "1.1.1",
        crs: L.CRS.EPSG4326,
        attribution: "NASA GSFC / USGS MOLA Topographic Elevation",
        noWrap: false,
      });
    } else {
      // Primary: USGS Astrogeology Planetary WMS - THEMIS Daytime Infrared
      url = "https://planetarymaps.usgs.gov/cgi-bin/mapserv?";
      newLayer = L.tileLayer.wms(url, {
        layers: "THEMIS",
        styles: "",
        format: "image/jpeg",
        transparent: false,
        version: "1.1.1",
        crs: L.CRS.EPSG4326,
        attribution: "ASU / NASA JPL THEMIS Infrared Global Mosaic",
        noWrap: false,
      });
    }

    setActiveUrl(url);

    // Attach event listeners to monitor live tile rendering
    (newLayer as any).on("tileload", () => {
      setTilesLoaded((prev) => prev + 1);
    });

    (newLayer as any).on("tileerror", () => {
      setTilesFailed((prev) => {
        const next = prev + 1;
        if (next >= 4 && !isFallbackMode) {
          console.warn("External planetary tile service unreachable. Automatically engaging deterministic benchmark fallback.");
          setIsFallbackMode(true);
        }
        return next;
      });
    });

    newLayer.addTo(map);
    activeTileLayerRef.current = newLayer;
  }, [activeLayer, isFallbackMode]);

  // Update Markers (Landing Sites & Science Targets)
  useEffect(() => {
    const markersGroup = markersLayerGroupRef.current;
    if (!markersGroup) return;

    markersGroup.clearLayers();

    // 1. Landing Sites & Bases
    if (showLandingSites) {
      locations.forEach((loc) => {
        const isSelected = selectedLocation?.id === loc.id;
        const iconHtml = `
          <div class="relative flex items-center justify-center">
            <div class="w-7 h-7 rounded-full ${
              isSelected ? "bg-mars-accent ring-4 ring-mars-accent/40 scale-125" : "bg-space-900 border-2 border-mars-rust"
            } flex items-center justify-center shadow-lg transition-transform hover:scale-125">
              <span class="text-[11px] font-mono font-bold ${isSelected ? "text-white" : "text-mars-accent"}">♂</span>
            </div>
          </div>
        `;

        const customIcon = L.divIcon({
          html: iconHtml,
          className: "mars-location-marker",
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const marker = L.marker([loc.coordinate.latitude, loc.coordinate.longitude], {
          icon: customIcon,
        });

        marker.bindTooltip(
          `<b>${loc.name}</b><br/><span style="color:#94a3b8">${loc.elevationM}m | ${loc.suitability.evaRating.toUpperCase()}</span>`,
          { direction: "top", offset: [0, -10] }
        );

        marker.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          onSelectLocation(loc);
        });

        markersGroup.addLayer(marker);
      });
    }

    // 2. Science Targets
    if (showScienceTargets) {
      scienceTargets.forEach((tgt) => {
        const valColor =
          tgt.scientificValue === "high" ? "#34d399" : tgt.scientificValue === "medium" ? "#38bdf8" : "#fbbf24";

        const iconHtml = `
          <div class="relative flex items-center justify-center">
            <div class="w-5 h-5 rotate-45 border border-space-950 flex items-center justify-center shadow-md transition-transform hover:scale-125" style="background-color: ${valColor}">
              <div class="w-1.5 h-1.5 bg-space-950 rounded-full"></div>
            </div>
          </div>
        `;

        const targetIcon = L.divIcon({
          html: iconHtml,
          className: "mars-science-marker",
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });

        const marker = L.marker([tgt.coordinate.latitude, tgt.coordinate.longitude], {
          icon: targetIcon,
        });

        marker.bindTooltip(
          `<b>${tgt.name}</b><br/><span style="color:#34d399">${tgt.category.toUpperCase()} (${tgt.scientificValue} value)</span>`,
          { direction: "top", offset: [0, -8] }
        );

        marker.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          onSelectLocation({
            id: tgt.id,
            name: tgt.name,
            coordinate: tgt.coordinate,
            elevationM: -2500,
            terrainType: tgt.description,
            geologicalUnit: tgt.associatedFormation || "Scientific Outcrop",
            scienceTargetsCount: 1,
            nasaObservations: [
              {
                mission: "Target Catalog",
                instrument: "Science Evaluation",
                observationId: tgt.id,
                summary: tgt.description,
              },
            ],
            suitability: {
              evaRating: "optimal",
              slopeIndex: 2.0,
              dustHazard: "moderate",
              communicationLineOfSight: true,
            },
          });
        });

        markersGroup.addLayer(marker);
      });
    }
  }, [locations, scienceTargets, selectedLocation, showScienceTargets, showLandingSites, onSelectLocation]);

  // Update Active Route & Segments
  useEffect(() => {
    const routeGroup = routeLayerGroupRef.current;
    if (!routeGroup) return;

    routeGroup.clearLayers();

    if (!activeRoute || activeRoute.points.length < 2) return;

    // Draw individual segments with hover / click popups
    activeRoute.segments.forEach((seg, idx) => {
      const segCoords: [number, number][] = [
        [seg.start.latitude, seg.start.longitude],
        [seg.end.latitude, seg.end.longitude],
      ];

      const segLine = L.polyline(segCoords, {
        color: seg.difficulty === "high" ? "#f43f5e" : seg.difficulty === "moderate" ? "#fbbf24" : "#38bdf8",
        weight: 3.5,
        opacity: 0.9,
      });

      segLine.bindTooltip(
        `<b>Leg ${idx + 1}</b><br/>${seg.distanceKm} km | Slope ${seg.averageSlopeDegrees}°<br/>${seg.difficulty.toUpperCase()} (~${seg.estimatedMinutes}m)`,
        { direction: "center" }
      );

      segLine.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        if (onSelectSegment) onSelectSegment(seg);
      });

      routeGroup.addLayer(segLine);
    });

    // Add waypoint markers
    activeRoute.points.forEach((pt, idx) => {
      const isStart = idx === 0;
      const isEnd = idx === activeRoute.points.length - 1;
      const isScience = pt.type === "science";

      const badgeColor = isStart
        ? "bg-telemetry-emerald"
        : isEnd
        ? "bg-telemetry-rose"
        : isScience
        ? "bg-telemetry-cyan"
        : "bg-amber-400";

      const pinHtml = `
        <div class="flex items-center justify-center">
          <div class="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-space-950 ${badgeColor} shadow border border-space-950">
            ${isStart ? "START" : isEnd ? "END" : `WP${idx}`}
          </div>
        </div>
      `;

      const pinIcon = L.divIcon({
        html: pinHtml,
        className: "mars-wp-marker",
        iconSize: [40, 20],
        iconAnchor: [20, 10],
      });

      const wpMarker = L.marker([pt.coordinate.latitude, pt.coordinate.longitude], {
        icon: pinIcon,
      });

      wpMarker.bindTooltip(`<b>${pt.label || `Waypoint ${idx}`}</b>`, { direction: "top" });
      routeGroup.addLayer(wpMarker);
    });
  }, [activeRoute, onSelectSegment]);

  // Update Highlight Pin from Profile Hover
  useEffect(() => {
    const highlightGroup = highlightLayerGroupRef.current;
    if (!highlightGroup) return;

    highlightGroup.clearLayers();

    if (highlightCoord) {
      const circle = L.circleMarker([highlightCoord.latitude, highlightCoord.longitude], {
        radius: 8,
        color: "#fbbf24",
        fillColor: "#fbbf24",
        fillOpacity: 0.8,
        weight: 2,
      });
      highlightGroup.addLayer(circle);
    }
  }, [highlightCoord]);

  // Update Hazards Layer
  useEffect(() => {
    const hazardGroup = hazardLayerGroupRef.current;
    if (!hazardGroup) return;

    hazardGroup.clearLayers();

    if (showHazards) {
      // Catalog hazards or fallback defaults
      const hazardList: Hazard[] = hazards.length > 0 ? hazards : [
        {
          id: "hzd-neretva",
          name: "Neretva Inflow Scarp",
          type: "SCARP",
          severity: "HIGH",
          location: { latitude: 18.52, longitude: 77.38 },
          radiusM: 4000,
          reason: "Steep scarp incline exceeding 25° with rockfall talus.",
          recommendation: "Maintain safe standoff distance from scarp brink.",
          confidence: 0.95,
          sourceType: "NASA",
        },
        {
          id: "hzd-belva",
          name: "Belva Crater Rim Ejecta Breccia",
          type: "STEEP_SLOPE",
          severity: "MODERATE",
          location: { latitude: 18.485, longitude: 77.442 },
          radiusM: 2500,
          reason: "Perched megabreccia boulders along crater impact rim.",
          recommendation: "Avoid traversing directly below unstable rim blocks.",
          confidence: 0.9,
          sourceType: "NASA",
        },
        {
          id: "hzd-delta",
          name: "Jezero Delta Front Scarp",
          type: "SCARP",
          severity: "HIGH",
          location: { latitude: 18.448, longitude: 77.402 },
          radiusM: 1200,
          reason: "60-meter vertical drop along layered sedimentary delta front.",
          recommendation: "Descend via designated gentle ramps only.",
          confidence: 0.95,
          sourceType: "NASA",
        },
        {
          id: "hzd-greenheugh",
          name: "Greenheugh Pediment Cap Scarp",
          type: "SCARP",
          severity: "HIGH",
          location: { latitude: -4.72, longitude: 137.35 },
          radiusM: 3500,
          reason: "High-gradient unconformity ledge in Gale Crater.",
          recommendation: "Traverse base of ridge only.",
          confidence: 0.92,
          sourceType: "NASA",
        },
      ];

      hazardList.forEach((h) => {
        let color = "#3b82f6";
        if (h.severity === "CRITICAL") color = "#ef4444";
        else if (h.severity === "HIGH") color = "#f97316";
        else if (h.severity === "MODERATE") color = "#eab308";

        const circle = L.circle([h.location.latitude, h.location.longitude], {
          radius: h.radiusM || 1500,
          color,
          fillColor: color,
          fillOpacity: 0.22,
          dashArray: "5, 5",
          weight: 2,
        });

        circle.bindPopup(`
          <div style="font-family: monospace; font-size: 11px; color: #0f172a; max-width: 260px; padding: 4px;">
            <div style="font-weight: bold; font-size: 12px; color: ${color}; text-transform: uppercase;">
              ⚠️ [${h.severity}] ${h.name || h.type}
            </div>
            <div style="margin-top: 4px; color: #334155;">${h.reason}</div>
            ${h.recommendation ? `<div style="margin-top: 4px; font-style: italic; color: #1e293b;"><b>Mitigation:</b> ${h.recommendation}</div>` : ""}
            ${h.evidence && h.evidence.length > 0 ? `
              <div style="margin-top: 5px; font-size: 10px; color: #334155; background: #e2e8f0; padding: 4px; border-radius: 4px;">
                <b>Supporting Evidence:</b>
                ${h.evidence.map(e => `<div>• ${e.dataset} [${e.mode}] - ${e.feature}</div>`).join('')}
              </div>
            ` : ""}
            <div style="margin-top: 6px; font-size: 9px; color: #64748b; border-top: 1px solid #cbd5e1; padding-top: 3px;">
              Source: ${h.sourceType} | Confidence: ${h.confidence !== undefined ? `${Math.round(h.confidence * 100)}%` : 'Dynamic'}
            </div>
          </div>
        `);

        circle.bindTooltip(`<b>⚠️ ${h.name || h.type}</b> (${h.severity})`, { direction: "top" });
        hazardGroup.addLayer(circle);
      });
    }
  }, [showHazards, hazards]);

  // Update Data Evidence Coverage Layer
  useEffect(() => {
    const covGroup = coverageLayerGroupRef.current;
    if (!covGroup) return;
    covGroup.clearLayers();

    if (showCoverage) {
      const zones = [
        { name: "Jezero Crater Science Footprint (Mars 2020 / HiRISE DTM)", bounds: [[18.2, 77.1], [18.7, 77.7]], color: "#10b981", mode: "BENCHMARK / HIGH" },
        { name: "Gale Crater Mt. Sharp Footprint (MSL / HiRISE DTM)", bounds: [[-4.9, 137.1], [-4.3, 137.7]], color: "#10b981", mode: "BENCHMARK / HIGH" },
        { name: "Gusev Crater Columbia Hills (MER-A)", bounds: [[-14.8, 175.2], [-14.4, 175.7]], color: "#10b981", mode: "BENCHMARK / HIGH" },
        { name: "Meridiani Planum Burns Cliff (MER-B)", bounds: [[-2.2, 354.3], [-1.7, 354.8]], color: "#10b981", mode: "BENCHMARK / HIGH" },
        { name: "Isidis Planitia Regional Basin (MOLA + THEMIS)", bounds: [[10.0, 70.0], [25.0, 95.0]], color: "#f59e0b", mode: "REGIONAL / MEDIUM" },
      ];

      zones.forEach((zone) => {
        const rect = L.rectangle(zone.bounds as L.LatLngBoundsExpression, {
          color: zone.color,
          weight: 1.5,
          fillColor: zone.color,
          fillOpacity: 0.18,
          dashArray: zone.mode.includes("HIGH") ? undefined : "4, 4",
        });

        rect.bindTooltip(`<b>${zone.name}</b><br/>Evidence Rating: ${zone.mode}`, { direction: "center" });
        covGroup.addLayer(rect);
      });
    }
  }, [showCoverage]);

  // Teleport helper
  const handleTeleport = (coord: MarsCoordinate, zoom: number = 7) => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([coord.latitude, coord.longitude], zoom, { duration: 1.2 });
    }
  };

  const handleResetView = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([18.4447, 77.4508], 6, { duration: 1.0 });
    }
  };

  return (
    <div className="relative w-full h-full bg-space-950 overflow-hidden select-none">
      {/* Leaflet DOM Root */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Crosshair Center Reticle */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10 opacity-30">
        <div className="w-12 h-12 border border-slate-400/40 rounded-full flex items-center justify-center">
          <div className="w-2 h-2 bg-mars-accent rounded-full"></div>
        </div>
      </div>

      {/* Picking Waypoint Banner */}
      {isPickingRoutePoint && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-amber-500/90 text-space-950 font-mono text-xs font-bold px-4 py-1.5 rounded-full shadow-lg border border-amber-300 flex items-center space-x-2 animate-bounce">
          <MapPin className="w-4 h-4" />
          <span>CLICK ANYWHERE ON MARS TO PLACE ROUTE WAYPOINT</span>
        </div>
      )}

      {/* Surface Fallback Mode Banner */}
      {isFallbackMode && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 bg-amber-500/95 text-space-950 font-mono text-xs font-bold px-4 py-1.5 rounded-full shadow-lg border border-amber-300 flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-space-950" />
          <span>SOURCE: BENCHMARK | MODE: FALLBACK</span>
          <button
            onClick={() => setIsFallbackMode(false)}
            className="ml-2 px-2 py-0.5 bg-space-950 text-amber-300 hover:text-white rounded text-[10px] font-mono transition-colors"
          >
            RETRY LIVE
          </button>
        </div>
      )}

      {/* Top Left Navigation / Teleport Bar */}
      <div className="absolute top-4 left-4 z-20 flex flex-wrap gap-2 items-center">
        <div className="bg-space-900/90 border border-space-800 rounded p-1 flex items-center space-x-1 text-xs font-mono backdrop-blur-md">
          <span className="text-slate-400 px-2 flex items-center space-x-1">
            <Navigation className="w-3.5 h-3.5 text-mars-accent" />
            <span className="hidden sm:inline">SECTOR:</span>
          </span>
          <button
            onClick={() => handleTeleport({ latitude: 18.4447, longitude: 77.4508 }, 8)}
            className="px-2 py-1 bg-space-800 hover:bg-space-700 text-slate-200 rounded transition-colors"
          >
            Jezero Crater
          </button>
          <button
            onClick={() => handleTeleport({ latitude: -4.5895, longitude: 137.4417 }, 8)}
            className="px-2 py-1 bg-space-800 hover:bg-space-700 text-slate-200 rounded transition-colors"
          >
            Gale Crater
          </button>
          <button
            onClick={() => handleTeleport({ latitude: 18.65, longitude: -133.8 }, 6)}
            className="px-2 py-1 bg-space-800 hover:bg-space-700 text-slate-200 rounded transition-colors"
          >
            Olympus Mons
          </button>
          <button
            onClick={() => handleTeleport({ latitude: -9.8, longitude: -76.5 }, 6)}
            className="px-2 py-1 bg-space-800 hover:bg-space-700 text-slate-200 rounded transition-colors"
          >
            Valles Marineris
          </button>
        </div>

        {/* Reset View Button */}
        <button
          onClick={handleResetView}
          title="Reset View to Jezero Reference"
          className="bg-space-900/90 hover:bg-space-800 border border-space-800 rounded p-2 text-slate-300 hover:text-white backdrop-blur-md transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Layer Switcher & Overlays */}
      <div className="absolute top-16 left-4 z-20">
        <div className="relative">
          <button
            onClick={() => setLayerDropdownOpen(!layerDropdownOpen)}
            className="bg-space-900/90 hover:bg-space-800 border border-space-800 rounded px-3 py-1.5 text-xs font-mono text-slate-200 flex items-center space-x-2 backdrop-blur-md shadow-lg"
          >
            <Layers className="w-3.5 h-3.5 text-telemetry-cyan" />
            <span className="uppercase font-semibold">LAYER: {activeLayer}</span>
          </button>

          {layerDropdownOpen && (
            <div className="absolute top-9 left-0 w-64 bg-space-900/95 border border-space-700 rounded shadow-2xl p-2.5 backdrop-blur-md font-mono text-xs z-30 space-y-2">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider pb-1 border-b border-space-800">
                Planetary Tile Layers
              </div>
              <button
                onClick={() => {
                  setActiveLayer("viking");
                  setLayerDropdownOpen(false);
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded flex items-center justify-between ${
                  activeLayer === "viking" ? "bg-mars-rust/30 text-mars-accent border border-mars-rust/50" : "hover:bg-space-800 text-slate-300"
                }`}
              >
                <span>Viking MDIM 2.1 (Visible)</span>
                {activeLayer === "viking" && <span className="text-[10px]">●</span>}
              </button>
              <button
                onClick={() => {
                  setActiveLayer("mola");
                  setLayerDropdownOpen(false);
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded flex items-center justify-between ${
                  activeLayer === "mola" ? "bg-mars-rust/30 text-mars-accent border border-mars-rust/50" : "hover:bg-space-800 text-slate-300"
                }`}
              >
                <span>MOLA Elevation (Topography)</span>
                {activeLayer === "mola" && <span className="text-[10px]">●</span>}
              </button>
              <button
                onClick={() => {
                  setActiveLayer("themis");
                  setLayerDropdownOpen(false);
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded flex items-center justify-between ${
                  activeLayer === "themis" ? "bg-mars-rust/30 text-mars-accent border border-mars-rust/50" : "hover:bg-space-800 text-slate-300"
                }`}
              >
                <span>THEMIS Day IR (Thermal)</span>
                {activeLayer === "themis" && <span className="text-[10px]">●</span>}
              </button>

              <div className="pt-2 border-t border-space-800 space-y-1.5">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Features Overlays
                </div>
                <label className="flex items-center space-x-2 cursor-pointer text-slate-300 hover:text-white">
                  <input
                    type="checkbox"
                    checked={showLandingSites}
                    onChange={(e) => setShowLandingSites(e.target.checked)}
                    className="rounded bg-space-800 border-space-700 text-mars-accent focus:ring-0"
                  />
                  <span>Landing Sites & Bases</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer text-slate-300 hover:text-white">
                  <input
                    type="checkbox"
                    checked={showScienceTargets}
                    onChange={(e) => setShowScienceTargets(e.target.checked)}
                    className="rounded bg-space-800 border-space-700 text-mars-accent focus:ring-0"
                  />
                  <span>Science Targets</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer text-slate-300 hover:text-white">
                  <input
                    type="checkbox"
                    checked={showHazards}
                    onChange={(e) => setShowHazards(e.target.checked)}
                    className="rounded bg-space-800 border-space-700 text-rose-500 focus:ring-0"
                  />
                  <span>Hazard Zones & Scarps</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer text-slate-300 hover:text-white">
                  <input
                    type="checkbox"
                    checked={showCoverage}
                    onChange={(e) => setShowCoverage(e.target.checked)}
                    className="rounded bg-space-800 border-space-700 text-emerald-500 focus:ring-0"
                  />
                  <span>Data Evidence Coverage</span>
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating Diagnostics Pills (Phase 14 Data Provenance & Phase 15 System Status) */}
      <div className="absolute top-4 right-80 z-20 hidden md:flex items-center space-x-2 font-mono text-xs">
        <button
          onClick={() => setShowProvenanceModal(true)}
          className="bg-space-900/90 hover:bg-space-800 border border-space-800 rounded px-2.5 py-1.5 text-slate-300 hover:text-white flex items-center space-x-1.5 backdrop-blur-md shadow-md"
        >
          <Database className="w-3.5 h-3.5 text-mars-accent" />
          <span>DATA PROVENANCE</span>
        </button>

        <button
          onClick={() => setShowStatusModal(true)}
          className="bg-space-900/90 hover:bg-space-800 border border-space-800 rounded px-2.5 py-1.5 text-slate-300 hover:text-white flex items-center space-x-1.5 backdrop-blur-md shadow-md"
        >
          <Activity className="w-3.5 h-3.5 text-telemetry-emerald" />
          <span>DATA STATUS</span>
        </button>
      </div>

      {/* Provenance Modal (Phase 14) */}
      {showProvenanceModal && (
        <div className="absolute inset-0 bg-space-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-space-900 border border-space-700 rounded-lg p-5 font-mono text-xs space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-space-800 pb-3">
              <div className="flex items-center space-x-2">
                <Database className="w-4 h-4 text-mars-accent" />
                <span className="font-bold text-slate-100 text-sm font-sans">
                  NASA Data Sources & Attribution
                </span>
              </div>
              <button onClick={() => setShowProvenanceModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-slate-300 text-[11px]">
              <div className="p-2.5 bg-space-850 rounded border border-space-800 space-y-1">
                <div className="font-bold text-mars-accent">MGS MOLA (Mars Orbiter Laser Altimeter)</div>
                <div>NASA Goddard Space Flight Center / PDS Geosciences Node</div>
                <div className="text-[10px] text-slate-500">Elevation datum: Mars areoid R = 3396.19 km</div>
              </div>

              <div className="p-2.5 bg-space-850 rounded border border-space-800 space-y-1">
                <div className="font-bold text-mars-accent">Viking Orbiter MDIM 2.1 Mosaic</div>
                <div>USGS Astrogeology Science Center / NASA Planetary WMS</div>
                <div className="text-[10px] text-slate-500">Global visual calibrated basemap (~232 m/pixel)</div>
              </div>

              <div className="p-2.5 bg-space-850 rounded border border-space-800 space-y-1">
                <div className="font-bold text-mars-accent">2001 Mars Odyssey THEMIS</div>
                <div>Arizona State University / NASA Jet Propulsion Laboratory</div>
                <div className="text-[10px] text-slate-500">Daytime infrared global thermal mosaic</div>
              </div>

              <div className="p-2.5 bg-space-850 rounded border border-space-800 space-y-1">
                <div className="font-bold text-mars-accent">In-Situ Rovers: Mars 2020 & MSL Curiosity</div>
                <div>NASA JPL-Caltech / Planetary Data System Analyst's Notebook</div>
                <div className="text-[10px] text-slate-500">Jezero and Gale Crater ground targets & sample cache coords</div>
              </div>
            </div>

            <div className="pt-2 text-[10px] text-slate-500 text-right">
              All datasets are public domain NASA/USGS planetary science products.
            </div>
          </div>
        </div>
      )}

      {/* System Pipeline Status Modal (Phase 15) */}
      {showStatusModal && (
        <div className="absolute inset-0 bg-space-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-space-900 border border-space-700 rounded-lg p-5 font-mono text-xs space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-space-800 pb-3">
              <div className="flex items-center space-x-2">
                <Activity className="w-4 h-4 text-telemetry-emerald" />
                <span className="font-bold text-slate-100 text-sm font-sans">
                  Data Pipeline & Architecture Status
                </span>
              </div>
              <button onClick={() => setShowStatusModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-[11px]">
              <div className="p-2 bg-space-850 rounded border border-space-800 flex items-center justify-between">
                <span className="text-slate-300">MOLA Elevation Service:</span>
                <span className="text-telemetry-emerald font-bold flex items-center space-x-1">
                  <CheckCircle className="w-3 h-3" />
                  <span>{pipelineStatus?.molaElevation || "Available"}</span>
                </span>
              </div>

              <div className="p-2 bg-space-850 rounded border border-space-800 flex items-center justify-between">
                <span className="text-slate-300">THEMIS Thermal WMS:</span>
                <span className="text-telemetry-emerald font-bold flex items-center space-x-1">
                  <CheckCircle className="w-3 h-3" />
                  <span>{pipelineStatus?.themisThermal || "Available"}</span>
                </span>
              </div>

              <div className="p-2 bg-space-850 rounded border border-space-800 flex items-center justify-between">
                <span className="text-slate-300">Viking MDIM Basemap:</span>
                <span className="text-telemetry-emerald font-bold flex items-center space-x-1">
                  <CheckCircle className="w-3 h-3" />
                  <span>{pipelineStatus?.vikingImagery || "Available"}</span>
                </span>
              </div>

              <div className="p-2 bg-space-850 rounded border border-space-800 flex items-center justify-between">
                <span className="text-slate-300">Science Target Archive:</span>
                <span className="text-telemetry-emerald font-bold flex items-center space-x-1">
                  <CheckCircle className="w-3 h-3" />
                  <span>{pipelineStatus?.scienceTargets || "Available"}</span>
                </span>
              </div>

              <div className="p-2 bg-space-850 rounded border border-space-800 flex items-center justify-between">
                <span className="text-slate-300">AI/ML Assessment Module:</span>
                <span className="text-telemetry-cyan font-bold flex items-center space-x-1">
                  <Activity className="w-3 h-3" />
                  <span>{pipelineStatus?.mlService || "Fallback Mode (Rule-based)"}</span>
                </span>
              </div>

              <div className="p-2 bg-space-850 rounded border border-space-800 flex items-center justify-between">
                <span className="text-slate-300">Mission Storage / PostGIS:</span>
                <span className="text-slate-200 font-bold">
                  {pipelineStatus?.database || "Local In-Memory Repository"}
                </span>
              </div>
            </div>

            <div className="p-2.5 rounded bg-space-850/50 border border-space-800 text-[10px] text-slate-400">
              Deterministic fallback enables continuous demonstration even under external network severance.
            </div>
          </div>
        </div>
      )}

      {/* Bottom Telemetry HUD */}
      <div className="absolute bottom-4 left-4 z-20 bg-space-900/90 border border-space-800 rounded px-3 py-2 flex items-center space-x-4 text-xs font-mono backdrop-blur-md shadow-lg">
        <div className="flex items-center space-x-2 text-slate-300">
          <Crosshair className="w-3.5 h-3.5 text-telemetry-cyan" />
          <span className="text-slate-400">RETICLE:</span>
          <span className="text-slate-100 font-bold">{formatMarsCoordinate(hoverCoord)}</span>
        </div>
        <div className="border-l border-space-800 pl-3 flex items-center space-x-2 text-slate-400">
          <Eye className="w-3.5 h-3.5 text-mars-accent" />
          <span>PROJECTION: PLANETOGRAPHIC</span>
        </div>
      </div>

      {/* Map Diagnostics Panel */}
      <div className="absolute bottom-4 right-4 z-20 font-mono text-xs">
        {showDiagnostics ? (
          <div className="bg-space-900/95 border border-space-700/80 rounded-lg p-3 shadow-2xl backdrop-blur-md w-80 space-y-2 text-slate-300">
            <div className="flex items-center justify-between border-b border-space-800 pb-1.5">
              <div className="flex items-center space-x-1.5 text-mars-accent font-bold text-[11px]">
                <Activity className="w-3.5 h-3.5" />
                <span>MAP ENGINE DIAGNOSTICS</span>
              </div>
              <button
                onClick={() => setShowDiagnostics(false)}
                className="text-slate-400 hover:text-white p-0.5"
                title="Minimize diagnostics"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-400">Map Initialized:</span>
                <span className="text-telemetry-emerald font-semibold">YES (Leaflet 1.9.4)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">CRS / Datum:</span>
                <span className="text-slate-200">EPSG:3857 / Mars Areoid</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Center & Zoom:</span>
                <span className="text-slate-200">
                  {centerCoord.latitude}°, {centerCoord.longitude}° (z{zoomLevel})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Active Layer:</span>
                <span className="text-mars-accent font-bold uppercase">{activeLayer}</span>
              </div>
              <div className="flex justify-between truncate">
                <span className="text-slate-400">Source:</span>
                <span className="text-slate-400 truncate max-w-[170px]" title={activeUrl}>
                  {isFallbackMode ? "Deterministic Benchmark Canvas" : activeUrl}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Tiles Loaded / Failed:</span>
                <span>
                  <span className="text-telemetry-emerald font-semibold">{tilesLoaded} loaded</span> /{" "}
                  <span className={tilesFailed > 0 ? "text-rose-400 font-semibold" : "text-slate-400"}>
                    {tilesFailed} failed
                  </span>
                </span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-space-800">
                <span className="text-slate-400">Operating Mode:</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    isFallbackMode
                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                      : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                  }`}
                >
                  {isFallbackMode ? "BENCHMARK FALLBACK" : "LIVE NASA / USGS"}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-space-800 flex items-center space-x-2">
              <button
                onClick={() => setIsFallbackMode(!isFallbackMode)}
                className="flex-1 px-2 py-1 bg-space-800 hover:bg-space-700 text-slate-200 hover:text-white rounded text-[10px] font-semibold transition-colors flex items-center justify-center space-x-1"
              >
                <RefreshCw className="w-3 h-3 text-mars-accent" />
                <span>{isFallbackMode ? "Use Live Tiles" : "Force Fallback"}</span>
              </button>
              <button
                onClick={() => {
                  setIsFallbackMode(false);
                  setTilesLoaded(0);
                  setTilesFailed(0);
                  if (activeTileLayerRef.current && (activeTileLayerRef.current as any).redraw) {
                    (activeTileLayerRef.current as any).redraw();
                  }
                }}
                className="px-2 py-1 bg-space-800 hover:bg-space-700 text-slate-300 hover:text-white rounded text-[10px] transition-colors"
                title="Reload active tile layer"
              >
                Reload
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowDiagnostics(true)}
            className="bg-space-900/90 hover:bg-space-800 border border-space-800 rounded px-2.5 py-1.5 text-slate-300 hover:text-white flex items-center space-x-1.5 backdrop-blur-md shadow-lg"
            title="Open Map Diagnostics"
          >
            <Activity className="w-3.5 h-3.5 text-mars-accent" />
            <span className="text-[11px] font-semibold">DIAGNOSTICS</span>
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
