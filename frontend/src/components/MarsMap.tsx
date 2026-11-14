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
import { getMepagGoalForCategory } from "../utils/mepag.js";
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
  ChevronDown,
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
  showProvenanceModal?: boolean;
  setShowProvenanceModal?: (show: boolean) => void;
  showStatusModal?: boolean;
  setShowStatusModal?: (show: boolean) => void;
  focusCoord?: MarsCoordinate | null;
  layoutTrigger?: string | boolean;
  ingestedM20Traverse?: {
    segments: [number, number][][];
    currentPosition?: { latitude: number; longitude: number; sol: number; totalDistanceKm: number } | null;
  } | null;
  showMolaHeatmap?: boolean;
  showCrismOverlay?: boolean;
}

export type MarsLayerType = "viking" | "mola" | "shaded";

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
  showProvenanceModal: controlledProvenanceModal,
  setShowProvenanceModal: setControlledProvenanceModal,
  showStatusModal: controlledStatusModal,
  setShowStatusModal: setControlledStatusModal,
  focusCoord = null,
  layoutTrigger,
  ingestedM20Traverse = null,
  showMolaHeatmap = false,
  showCrismOverlay = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const activeTileLayerRef = useRef<L.Layer | null>(null);
  const routeLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const markersLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const highlightLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const hazardLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const coverageLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const m20LayerGroupRef = useRef<L.LayerGroup | null>(null);
  const molaLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const crismLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const failedTilesRef = useRef<Set<string>>(new Set());

  const [activeLayer, setActiveLayer] = useState<MarsLayerType>("viking");
  const [showScienceTargets, setShowScienceTargets] = useState<boolean>(true);
  const [showLandingSites, setShowLandingSites] = useState<boolean>(true);
  const [showHazards, setShowHazards] = useState<boolean>(false);
  const [showCoverage, setShowCoverage] = useState<boolean>(false);
  const [showM20Traverse, setShowM20Traverse] = useState<boolean>(true);
  const [hoverCoord, setHoverCoord] = useState<MarsCoordinate>({ latitude: 18.4447, longitude: 77.4508 });
  const [layerDropdownOpen, setLayerDropdownOpen] = useState<boolean>(false);
  const [tileErrorCount, setTileErrorCount] = useState<number>(0);
  const [currentZoom, setCurrentZoom] = useState<number>(6);
  const [centerLat, setCenterLat] = useState<number>(18.4447);

  const onMapClickCoordRef = useRef(onMapClickCoord);
  const onSelectLocationRef = useRef(onSelectLocation);
  const onSelectSegmentRef = useRef(onSelectSegment);

  useEffect(() => {
    onMapClickCoordRef.current = onMapClickCoord;
  }, [onMapClickCoord]);

  useEffect(() => {
    onSelectLocationRef.current = onSelectLocation;
  }, [onSelectLocation]);

  useEffect(() => {
    onSelectSegmentRef.current = onSelectSegment;
  }, [onSelectSegment]);

  // Panels for Data Provenance and Data Status (Controlled or Local Fallback)
  const [localShowProvenanceModal, setLocalShowProvenanceModal] = useState<boolean>(false);
  const [localShowStatusModal, setLocalShowStatusModal] = useState<boolean>(false);

  const isProvenanceOpen = controlledProvenanceModal !== undefined ? controlledProvenanceModal : localShowProvenanceModal;
  const setProvenanceOpen = setControlledProvenanceModal || setLocalShowProvenanceModal;

  const isStatusOpen = controlledStatusModal !== undefined ? controlledStatusModal : localShowStatusModal;
  const setStatusOpen = setControlledStatusModal || setLocalShowStatusModal;

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

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

    L.control.zoom({ position: "bottomright" }).addTo(map);

    routeLayerGroupRef.current = L.layerGroup().addTo(map);
    markersLayerGroupRef.current = L.layerGroup().addTo(map);
    highlightLayerGroupRef.current = L.layerGroup().addTo(map);
    hazardLayerGroupRef.current = L.layerGroup().addTo(map);
    coverageLayerGroupRef.current = L.layerGroup().addTo(map);
    m20LayerGroupRef.current = L.layerGroup().addTo(map);
    molaLayerGroupRef.current = L.layerGroup().addTo(map);
    crismLayerGroupRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;

    map.on("zoomend moveend", () => {
      setCurrentZoom(map.getZoom());
      setCenterLat(map.getCenter().lat);
    });

    map.on("mousemove", (e: L.LeafletMouseEvent) => {
      setHoverCoord({
        latitude: Number(e.latlng.lat.toFixed(4)),
        longitude: Number(e.latlng.lng.toFixed(4)),
      });
    });

    map.on("click", (e: L.LeafletMouseEvent) => {
      const coord: MarsCoordinate = {
        latitude: Number(e.latlng.lat.toFixed(5)),
        longitude: Number(e.latlng.lng.toFixed(5)),
      };

      if (onMapClickCoordRef.current) {
        onMapClickCoordRef.current(coord);
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Re-sync Leaflet dimensions when drawer/layout changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.invalidateSize({ animate: false });
    const t = setTimeout(() => {
      map.invalidateSize({ animate: false });
    }, 300);
    return () => clearTimeout(t);
  }, [layoutTrigger]);

  // Pan to external focusCoord when provided (e.g. Science -> Map link)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !focusCoord) return;
    map.setView([focusCoord.latitude, focusCoord.longitude], Math.max(map.getZoom(), 7), { animate: false });
  }, [focusCoord]);

  // Update Tile Layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (activeTileLayerRef.current) {
      map.removeLayer(activeTileLayerRef.current);
    }
    failedTilesRef.current.clear();
    setTileErrorCount(0);

    let newLayer: L.TileLayer;

    if (activeLayer === "viking") {
      newLayer = L.tileLayer(
        "https://s3-eu-west-1.amazonaws.com/whereonmars.cartodb.net/viking_mdim21_global/{z}/{x}/{y}.png",
        {
          tms: true,
          minZoom: 2,
          maxNativeZoom: 7,
          maxZoom: 12,
          keepBuffer: 6,
          updateWhenIdle: true,
          updateWhenZooming: false,
          attribution: "USGS Astrogeology / NASA Viking MDIM 2.1 Mosaic",
          noWrap: false,
        }
      );
    } else if (activeLayer === "mola") {
      newLayer = L.tileLayer(
        "https://s3-eu-west-1.amazonaws.com/whereonmars.cartodb.net/mola-color/{z}/{x}/{y}.png",
        {
          tms: true,
          minZoom: 2,
          maxNativeZoom: 6,
          maxZoom: 12,
          keepBuffer: 6,
          updateWhenIdle: true,
          updateWhenZooming: false,
          attribution: "NASA GSFC / MOLA Colorized Elevation",
          noWrap: false,
        }
      );
    } else {
      newLayer = L.tileLayer(
        "https://cartocdn-gusc.global.ssl.fastly.net/opmbuilder/api/v1/map/named/opm-mars-basemap-v0-2/all/{z}/{x}/{y}.png",
        {
          tms: false,
          minZoom: 2,
          maxNativeZoom: 8,
          maxZoom: 12,
          keepBuffer: 6,
          updateWhenIdle: true,
          updateWhenZooming: false,
          attribution: "OpenPlanetaryMap / MOLA Shaded Relief Basemap",
          noWrap: false,
        }
      );
    }

    newLayer.on("tileerror", (e: L.TileErrorEvent) => {
      if (e.tile?.src) {
        failedTilesRef.current.add(e.tile.src);
      }
      setTileErrorCount(failedTilesRef.current.size);
    });
    newLayer.on("tileload", (e: L.TileEvent) => {
      if (e.tile?.src && failedTilesRef.current.has(e.tile.src)) {
        failedTilesRef.current.delete(e.tile.src);
        setTileErrorCount(failedTilesRef.current.size);
      }
    });

    newLayer.addTo(map);
    activeTileLayerRef.current = newLayer;
  }, [activeLayer]);

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
            <div class="w-6 h-6 ${
              isSelected
                ? "bg-[var(--atlas-accent)] border-2 border-white scale-125"
                : "bg-[var(--atlas-surface)] border border-[var(--atlas-accent)]"
            } flex items-center justify-center shadow-lg transition-transform hover:scale-125">
              <div class="w-2 h-2 ${isSelected ? "bg-white" : "bg-[var(--atlas-accent)]"}"></div>
            </div>
          </div>
        `;

        const customIcon = L.divIcon({
          html: iconHtml,
          className: "mars-location-marker",
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        const marker = L.marker([loc.coordinate.latitude, loc.coordinate.longitude], {
          icon: customIcon,
        });

        marker.bindTooltip(
          `<b>${loc.name}</b><br/><span style="color:var(--atlas-muted)">${loc.elevationM}m | ${loc.suitability.evaRating.toUpperCase()}</span>`,
          { direction: "top", offset: [0, -10] }
        );

        marker.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          onSelectLocationRef.current(loc);
        });

        markersGroup.addLayer(marker);
      });
    }

    // 2. Science Targets with MEPAG Goal Badges & Color Encoding
    if (showScienceTargets) {
      scienceTargets.forEach((tgt) => {
        const mepag = getMepagGoalForCategory(tgt.category || tgt.name || tgt.description);
        const valColor = mepag.colorHex;

        const iconHtml = `
          <div class="relative flex items-center justify-center">
            <div class="w-4 h-4 rotate-45 border border-[var(--atlas-surface)] flex items-center justify-center shadow-md transition-transform hover:scale-125" style="background-color: ${valColor}">
              <div class="w-1.5 h-1.5 bg-[var(--atlas-surface)]"></div>
            </div>
          </div>
        `;

        const targetIcon = L.divIcon({
          html: iconHtml,
          className: "mars-science-marker",
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });

        const marker = L.marker([tgt.coordinate.latitude, tgt.coordinate.longitude], {
          icon: targetIcon,
        });

        marker.bindTooltip(
          `<div style="font-family:monospace;font-size:11px;padding:2px;">
            <b>${tgt.name}</b><br/>
            <span style="display:inline-block;margin-top:2px;padding:1px 4px;font-size:9px;font-weight:bold;color:${mepag.colorHex};border:1px solid ${mepag.colorHex};background:rgba(0,0,0,0.7);border-radius:2px;">
              ${mepag.shortLabel}
            </span>
            <div style="color:var(--atlas-muted);font-size:10px;margin-top:2px;">
              ${tgt.category.toUpperCase()} (${tgt.scientificValue} priority)
            </div>
          </div>`,
          { direction: "top", offset: [0, -8] }
        );

        marker.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          onSelectLocationRef.current({
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
  }, [locations, scienceTargets, selectedLocation, showScienceTargets, showLandingSites]);

  // Update Active Route & Segments
  useEffect(() => {
    const routeGroup = routeLayerGroupRef.current;
    if (!routeGroup) return;

    routeGroup.clearLayers();

    if (!activeRoute || activeRoute.points.length < 2) return;

    // Draw individual segments
    activeRoute.segments.forEach((seg, idx) => {
      const segCoords: [number, number][] = [
        [seg.start.latitude, seg.start.longitude],
        [seg.end.latitude, seg.end.longitude],
      ];

      const segLine = L.polyline(segCoords, {
        color: seg.difficulty === "high" ? "var(--atlas-red)" : seg.difficulty === "moderate" ? "var(--atlas-amber)" : "var(--atlas-blue)",
        weight: 3.5,
        opacity: 0.95,
      });

      segLine.bindTooltip(
        `<b>Leg ${idx + 1}</b><br/>${seg.distanceKm} km | Slope ${seg.averageSlopeDegrees}°<br/>${seg.difficulty.toUpperCase()} (~${seg.estimatedMinutes} min)`,
        { direction: "center" }
      );

      segLine.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        if (onSelectSegmentRef.current) onSelectSegmentRef.current(seg);
      });

      routeGroup.addLayer(segLine);
    });

    // Add waypoint markers
    activeRoute.points.forEach((pt, idx) => {
      const isStart = idx === 0;
      const isEnd = idx === activeRoute.points.length - 1;
      const isScience = pt.type === "science";

      const badgeColor = isStart
        ? "bg-[var(--atlas-teal)] text-white"
        : isEnd
        ? "bg-[var(--atlas-accent)] text-white"
        : isScience
        ? "bg-[var(--atlas-blue)] text-white"
        : "bg-[var(--atlas-amber)] text-black";

      const pinHtml = `
        <div class="flex items-center justify-center">
          <div class="px-1.5 py-0.5 text-[9px] font-mono font-bold ${badgeColor} shadow border border-[var(--atlas-border)]">
            ${isStart ? "START" : isEnd ? "END" : `WP${idx}`}
          </div>
        </div>
      `;

      const pinIcon = L.divIcon({
        html: pinHtml,
        className: "mars-wp-marker",
        iconSize: [36, 18],
        iconAnchor: [18, 9],
      });

      const wpMarker = L.marker([pt.coordinate.latitude, pt.coordinate.longitude], {
        icon: pinIcon,
      });

      wpMarker.bindTooltip(`<b>${pt.label || `Waypoint ${idx}`}</b>`, { direction: "top" });
      routeGroup.addLayer(wpMarker);
    });
  }, [activeRoute]);

  // Update Highlight Pin from Profile Hover
  useEffect(() => {
    const highlightGroup = highlightLayerGroupRef.current;
    if (!highlightGroup) return;

    highlightGroup.clearLayers();

    if (highlightCoord) {
      const circle = L.circleMarker([highlightCoord.latitude, highlightCoord.longitude], {
        radius: 7,
        color: "var(--atlas-amber)",
        fillColor: "var(--atlas-amber)",
        fillOpacity: 0.9,
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
        let color = "var(--atlas-blue)";
        if (h.severity === "CRITICAL") color = "var(--atlas-red)";
        else if (h.severity === "HIGH") color = "var(--atlas-accent)";
        else if (h.severity === "MODERATE") color = "var(--atlas-amber)";

        const circle = L.circle([h.location.latitude, h.location.longitude], {
          radius: h.radiusM || 1500,
          color,
          fillColor: color,
          fillOpacity: 0.2,
          dashArray: "4, 4",
          weight: 1.5,
        });

        circle.bindPopup(`
          <div style="font-family: Inter, sans-serif; font-size: 11px; color: var(--atlas-text); max-width: 260px; padding: 4px;">
            <div style="font-weight: bold; font-size: 12px; color: ${color}; text-transform: uppercase;">
              [${h.severity}] ${h.name || h.type}
            </div>
            <div style="margin-top: 4px; color: var(--atlas-muted);">${h.reason}</div>
            ${h.recommendation ? `<div style="margin-top: 4px; font-style: italic;"><b>Mitigation:</b> ${h.recommendation}</div>` : ""}
            <div style="margin-top: 6px; font-size: 9px; color: var(--atlas-muted); border-top: 1px solid var(--atlas-border); padding-top: 3px;">
              Source: ${h.sourceType} | Confidence: ${h.confidence !== undefined ? `${Math.round(h.confidence * 100)}%` : 'Dynamic'}
            </div>
          </div>
        `);

        circle.bindTooltip(`<b>${h.name || h.type}</b> (${h.severity})`, { direction: "top" });
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
        { name: "Jezero Crater Science Footprint (Mars 2020 / HiRISE DTM)", bounds: [[18.2, 77.1], [18.7, 77.7]], color: "var(--atlas-teal)", mode: "BENCHMARK / HIGH" },
        { name: "Gale Crater Mt. Sharp Footprint (MSL / HiRISE DTM)", bounds: [[-4.9, 137.1], [-4.3, 137.7]], color: "var(--atlas-teal)", mode: "BENCHMARK / HIGH" },
        { name: "Gusev Crater Columbia Hills (MER-A)", bounds: [[-14.8, 175.2], [-14.4, 175.7]], color: "var(--atlas-teal)", mode: "BENCHMARK / HIGH" },
        { name: "Meridiani Planum Burns Cliff (MER-B)", bounds: [[-2.2, 354.3], [-1.7, 354.8]], color: "var(--atlas-teal)", mode: "BENCHMARK / HIGH" },
        { name: "Isidis Planitia Regional Basin (MOLA + THEMIS)", bounds: [[10.0, 70.0], [25.0, 95.0]], color: "var(--atlas-amber)", mode: "REGIONAL / MEDIUM" },
      ];

      zones.forEach((zone) => {
        const rect = L.rectangle(zone.bounds as L.LatLngBoundsExpression, {
          color: zone.color,
          weight: 1.5,
          fillColor: zone.color,
          fillOpacity: 0.15,
          dashArray: zone.mode.includes("HIGH") ? undefined : "4, 4",
        });

        rect.bindTooltip(`<b>${zone.name}</b><br/>Evidence Rating: ${zone.mode}`, { direction: "center" });
        covGroup.addLayer(rect);
      });
    }
  }, [showCoverage]);

  // Update Ingested NASA M20 Perseverance Traverse Overlay
  useEffect(() => {
    const m20Group = m20LayerGroupRef.current;
    if (!m20Group) return;
    m20Group.clearLayers();

    if (showM20Traverse && ingestedM20Traverse) {
      ingestedM20Traverse.segments.forEach((seg) => {
        if (seg.length >= 2) {
          L.polyline(seg, {
            color: "#36B9AF",
            weight: 2.5,
            opacity: 0.85,
            dashArray: "5, 4",
          }).addTo(m20Group);
        }
      });

      if (ingestedM20Traverse.currentPosition) {
        const pos = ingestedM20Traverse.currentPosition;
        const m = L.circleMarker([pos.latitude, pos.longitude], {
          radius: 6,
          color: "#ffffff",
          fillColor: "#36B9AF",
          fillOpacity: 1,
          weight: 2,
        });
        m.bindTooltip(
          `<b>Perseverance Actual Position (NASA JPL)</b><br/>Sol ${pos.sol} · ${pos.totalDistanceKm.toFixed(2)} km driven`,
          { direction: "top" }
        );
        m20Group.addLayer(m);
      }
    }
  }, [showM20Traverse, ingestedM20Traverse]);

  // Update MOLA Elevation Heatmap Layer
  useEffect(() => {
    const molaGroup = molaLayerGroupRef.current;
    if (!molaGroup) return;
    molaGroup.clearLayers();

    if (showMolaHeatmap) {
      const MOLA_GRID_POINTS = [
        { lat: 18.4447, lon: 77.4508, elev: -2565, label: "Octavia E. Butler Landing" },
        { lat: 18.4200, lon: 77.4200, elev: -2580, label: "Séítah Inter-Dune Low" },
        { lat: 18.4400, lon: 77.3800, elev: -2520, label: "Western Delta Scarp" },
        { lat: 18.4600, lon: 77.4600, elev: -2545, label: "Crater Floor Smooth Unit" },
        { lat: 18.4000, lon: 77.4500, elev: -2610, label: "Southern Depression" },
        { lat: 18.4300, lon: 77.5200, elev: -2490, label: "Eastern Crater Wall Foothills" },
        { lat: 18.4700, lon: 77.4000, elev: -2515, label: "Northern Delta Remnant" },
        { lat: 18.4100, lon: 77.5000, elev: -2600, label: "Séítah Basin Low" },
        { lat: 18.4500, lon: 77.3500, elev: -2480, label: "Nerretva Vallis Inlet Apex" },
        { lat: 18.3800, lon: 77.4400, elev: -2630, label: "Deep Floor Basal Unit" },
        { lat: 18.4230, lon: 77.4110, elev: -2530, label: "Kodiak Butte Isolated Mesa" },
        { lat: 18.4380, lon: 77.4180, elev: -2540, label: "Delta Front Fan Outcrop" },
      ];

      MOLA_GRID_POINTS.forEach((pt) => {
        let color = "#06b6d4";
        if (pt.elev > -2500) color = "#ef4444";
        else if (pt.elev > -2540) color = "#f97316";
        else if (pt.elev > -2570) color = "#eab308";
        else if (pt.elev > -2600) color = "#06b6d4";
        else color = "#3b82f6";

        const circle = L.circle([pt.lat, pt.lon], {
          radius: 1200,
          color,
          fillColor: color,
          fillOpacity: 0.35,
          weight: 1.5,
          dashArray: "3 3",
        });

        circle.bindTooltip(
          `<b>MOLA Laser Elevation</b><br/>${pt.label}<br/>Elevation: <b>${pt.elev} m</b> areoid`,
          { direction: "top" }
        );
        molaGroup.addLayer(circle);
      });
    }
  }, [showMolaHeatmap]);

  // Update CRISM Hyperspectral Mineralogy Layer
  useEffect(() => {
    const crismGroup = crismLayerGroupRef.current;
    if (!crismGroup) return;
    crismGroup.clearLayers();

    if (showCrismOverlay) {
      const CRISM_MINERAL_POINTS = [
        { lat: 18.4220, lon: 77.4000, mineral: "Fe/Mg-Smectite Clay", color: "#8b5cf6", mepag: "Goal I (Biosignatures)", formula: "(Fe,Mg)3Si4O10(OH)2" },
        { lat: 18.4400, lon: 77.4180, mineral: "Mg-Carbonate", color: "#10b981", mepag: "Goal I & II (Ancient Climate)", formula: "MgCO3 (Magnesite)" },
        { lat: 18.4550, lon: 77.4320, mineral: "Hydrated Silica", color: "#06b6d4", mepag: "Goal I (Preservation)", formula: "SiO2 · nH2O (Opaline)" },
        { lat: 18.4150, lon: 77.4480, mineral: "Olivine Cumulate", color: "#f59e0b", mepag: "Goal III (Volcanic/Crustal)", formula: "(Mg,Fe)2SiO4 (Fo70)" },
        { lat: 18.4480, lon: 77.3900, mineral: "Ferric Oxide (Hematite)", color: "#ef4444", mepag: "Goal II (Aqueous Alteration)", formula: "α-Fe2O3" },
        { lat: 18.4280, lon: 77.4120, mineral: "Carbonate-Bearing Delta Clay", color: "#ec4899", mepag: "Goal I (Sample Return Cache)", formula: "Clay + Carbonate Matrix" },
      ];

      CRISM_MINERAL_POINTS.forEach((min) => {
        const marker = L.circleMarker([min.lat, min.lon], {
          radius: 12,
          color: "#ffffff",
          fillColor: min.color,
          fillOpacity: 0.8,
          weight: 2,
        });

        marker.bindPopup(`
          <div style="font-family: monospace; font-size: 11px; color: var(--atlas-text); max-width: 240px; padding: 4px;">
            <div style="font-weight: bold; color: ${min.color}; text-transform: uppercase;">
              CRISM: ${min.mineral}
            </div>
            <div style="margin-top: 3px; color: var(--atlas-muted); font-size: 10px;">
              Formula: <code>${min.formula}</code>
            </div>
            <div style="margin-top: 4px; font-weight: bold; color: var(--atlas-teal);">
              NASA MEPAG: ${min.mepag}
            </div>
            <div style="margin-top: 6px; font-size: 9px; color: var(--atlas-muted); border-top: 1px solid var(--atlas-border); padding-top: 2px;">
              Instrument: MRO CRISM Target Observation
            </div>
          </div>
        `);

        marker.bindTooltip(`<b>CRISM: ${min.mineral}</b> (${min.mepag.split(" ")[0]})`, { direction: "top" });
        crismGroup.addLayer(marker);
      });
    }
  }, [showCrismOverlay]);

  const handleTeleport = (coord: MarsCoordinate, zoom: number = 7) => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([coord.latitude, coord.longitude], zoom, { animate: false });
    }
    if (onMapClickCoordRef.current) {
      onMapClickCoordRef.current(coord);
    }
  };

  const handleResetView = () => {
    const defaultCoord = { latitude: 18.4447, longitude: 77.4508 };
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([defaultCoord.latitude, defaultCoord.longitude], 6, { animate: false });
    }
    if (onMapClickCoordRef.current) {
      onMapClickCoordRef.current(defaultCoord);
    }
  };

  return (
    <div className="relative w-full h-full bg-atlas-bg overflow-hidden select-none">
      {/* Leaflet DOM Root */}
      <div ref={mapContainerRef} className="w-full h-full z-0 bg-[#161210]" />

      {/* Crosshair Center Reticle */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10 opacity-30">
        <div className="w-12 h-12 border border-atlas-border flex items-center justify-center">
          <div className="w-2 h-2 bg-atlas-accent" />
        </div>
      </div>

      {/* Picking Waypoint Banner */}
      {isPickingRoutePoint && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-atlas-surface border border-atlas-accent text-atlas-accent font-mono text-xs font-bold px-4 py-2 shadow-2xl flex items-center space-x-2 animate-pulse">
          <MapPin className="w-4 h-4 text-atlas-accent" />
          <span>Click anywhere on Mars surface to place waypoint</span>
        </div>
      )}

      {/* Top Left Layer Switcher, Overlays & Reset View */}
      <div className="absolute top-4 left-4 z-40 flex items-center gap-2">
        <div className="relative">
          <button
            onClick={() => setLayerDropdownOpen(!layerDropdownOpen)}
            className="bg-atlas-surface/95 hover:bg-atlas-elevated border border-atlas-border px-3 py-1.5 text-xs font-mono text-atlas-text flex items-center space-x-2 backdrop-blur-md shadow-lg"
          >
            <Layers className="w-3.5 h-3.5 text-atlas-blue" />
            <span className="font-semibold">Layer: {activeLayer}</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${layerDropdownOpen ? "rotate-180" : ""}`} />
          </button>

          {layerDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setLayerDropdownOpen(false)}
              />
              <div className="absolute top-9 left-0 w-64 bg-atlas-surface border border-atlas-border shadow-2xl p-3 backdrop-blur-md font-mono text-xs z-50 space-y-2.5">
                <div className="text-[10px] text-atlas-muted font-bold uppercase tracking-wider pb-1.5 border-b border-atlas-border">
                  Planetary Tile Layers
                </div>
              <button
                onClick={() => {
                  setActiveLayer("viking");
                  setLayerDropdownOpen(false);
                }}
                className={`w-full text-left px-2.5 py-1.5 flex items-center justify-between border ${
                  activeLayer === "viking" ? "bg-atlas-elevated text-atlas-accent border-atlas-accent font-bold" : "border-transparent hover:bg-atlas-elevated text-atlas-muted"
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
                className={`w-full text-left px-2.5 py-1.5 flex items-center justify-between border ${
                  activeLayer === "mola" ? "bg-atlas-elevated text-atlas-accent border-atlas-accent font-bold" : "border-transparent hover:bg-atlas-elevated text-atlas-muted"
                }`}
              >
                <span>MOLA Elevation (Topography)</span>
                {activeLayer === "mola" && <span className="text-[10px]">●</span>}
              </button>
              <button
                onClick={() => {
                  setActiveLayer("shaded");
                  setLayerDropdownOpen(false);
                }}
                className={`w-full text-left px-2.5 py-1.5 flex items-center justify-between border ${
                  activeLayer === "shaded" ? "bg-atlas-elevated text-atlas-accent border-atlas-accent font-bold" : "border-transparent hover:bg-atlas-elevated text-atlas-muted"
                }`}
              >
                <span>OPM Shaded Relief (Basemap)</span>
                {activeLayer === "shaded" && <span className="text-[10px]">●</span>}
              </button>

              <div className="pt-2 border-t border-atlas-border space-y-2">
                <div className="text-[10px] text-atlas-muted font-bold uppercase tracking-wider">
                  Feature Overlays
                </div>
                <label className="flex items-center space-x-2 cursor-pointer text-atlas-muted hover:text-atlas-text">
                  <input
                    type="checkbox"
                    checked={showLandingSites}
                    onChange={(e) => setShowLandingSites(e.target.checked)}
                    className="bg-atlas-elevated border-atlas-border text-atlas-accent focus:ring-0"
                  />
                  <span>Landing Sites & Bases</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer text-atlas-muted hover:text-atlas-text">
                  <input
                    type="checkbox"
                    checked={showScienceTargets}
                    onChange={(e) => setShowScienceTargets(e.target.checked)}
                    className="bg-atlas-elevated border-atlas-border text-atlas-accent focus:ring-0"
                  />
                  <span>Science Targets</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer text-atlas-muted hover:text-atlas-text">
                  <input
                    type="checkbox"
                    checked={showM20Traverse}
                    onChange={(e) => setShowM20Traverse(e.target.checked)}
                    className="bg-atlas-elevated border-atlas-border text-atlas-teal focus:ring-0"
                  />
                  <span>NASA M20 Actual Traverse</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer text-atlas-muted hover:text-atlas-text">
                  <input
                    type="checkbox"
                    checked={showHazards}
                    onChange={(e) => setShowHazards(e.target.checked)}
                    className="bg-atlas-elevated border-atlas-border text-atlas-red focus:ring-0"
                  />
                  <span>Hazard Zones & Scarps</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer text-atlas-muted hover:text-atlas-text">
                  <input
                    type="checkbox"
                    checked={showCoverage}
                    onChange={(e) => setShowCoverage(e.target.checked)}
                    className="bg-atlas-elevated border-atlas-border text-atlas-teal focus:ring-0"
                  />
                  <span>Data Evidence Coverage</span>
                </label>
              </div>
            </div>
            </>
          )}
        </div>

        {/* Reset View Button */}
        <button
          onClick={handleResetView}
          aria-label="Reset View"
          title="Reset View to Jezero Reference"
          className="bg-atlas-surface/95 hover:bg-atlas-elevated border border-atlas-border p-1.5 text-atlas-text backdrop-blur-md transition-colors shadow-lg"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Sector Teleport Bar (Bottom Left above HUD) */}
      <div className="absolute bottom-16 left-4 z-20 flex flex-wrap gap-1.5 items-center">
        <div className="bg-atlas-surface/95 border border-atlas-border p-1 flex flex-wrap items-center gap-1 text-xs font-mono backdrop-blur-md shadow-lg">
          <span className="text-atlas-muted px-2 flex items-center space-x-1">
            <Navigation className="w-3.5 h-3.5 text-atlas-accent" />
            <span className="hidden sm:inline">Sector:</span>
          </span>
          <button
            onClick={() => handleTeleport({ latitude: 18.4447, longitude: 77.4508 }, 8)}
            className="px-2 py-1 bg-atlas-elevated hover:bg-atlas-surface text-atlas-text border border-atlas-border transition-colors font-sans"
          >
            Jezero Crater
          </button>
          <button
            onClick={() => handleTeleport({ latitude: -4.5895, longitude: 137.4417 }, 8)}
            className="px-2 py-1 bg-atlas-elevated hover:bg-atlas-surface text-atlas-text border border-atlas-border transition-colors font-sans"
          >
            Gale Crater
          </button>
          <button
            onClick={() => handleTeleport({ latitude: 18.65, longitude: -133.8 }, 6)}
            className="px-2 py-1 bg-atlas-elevated hover:bg-atlas-surface text-atlas-text border border-atlas-border transition-colors font-sans"
          >
            Olympus Mons
          </button>
          <button
            onClick={() => handleTeleport({ latitude: -9.8, longitude: -76.5 }, 6)}
            className="px-2 py-1 bg-atlas-elevated hover:bg-atlas-surface text-atlas-text border border-atlas-border transition-colors font-sans"
          >
            Valles Marineris
          </button>
        </div>
      </div>

      {/* Provenance Modal */}
      {isProvenanceOpen && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-atlas-surface border border-atlas-border p-6 font-mono text-xs space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-atlas-border pb-3">
              <div className="flex items-center space-x-2">
                <Database className="w-4 h-4 text-atlas-accent" />
                <span className="font-display font-bold text-atlas-text text-sm">
                  NASA Data Sources & Attribution
                </span>
              </div>
              <button onClick={() => setProvenanceOpen(false)} className="text-atlas-muted hover:text-atlas-text">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-[11px]">
              <div className="p-3 bg-atlas-elevated border border-atlas-border space-y-1">
                <div className="font-bold text-atlas-accent">MGS MOLA (Mars Orbiter Laser Altimeter)</div>
                <div className="text-atlas-text">NASA Goddard Space Flight Center / PDS Geosciences Node</div>
                <div className="text-[10px] text-atlas-muted">Elevation datum: Mars areoid R = 3396.19 km</div>
              </div>

              <div className="p-3 bg-atlas-elevated border border-atlas-border space-y-1">
                <div className="font-bold text-atlas-accent">Viking Orbiter MDIM 2.1 Mosaic</div>
                <div className="text-atlas-text">USGS Astrogeology Science Center / NASA Planetary WMS</div>
                <div className="text-[10px] text-atlas-muted">Global visual calibrated basemap (~232 m/pixel)</div>
              </div>

              <div className="p-3 bg-atlas-elevated border border-atlas-border space-y-1">
                <div className="font-bold text-atlas-accent">2001 Mars Odyssey THEMIS</div>
                <div className="text-atlas-text">Arizona State University / NASA Jet Propulsion Laboratory</div>
                <div className="text-[10px] text-atlas-muted">Daytime infrared global thermal mosaic</div>
              </div>

              <div className="p-3 bg-atlas-elevated border border-atlas-border space-y-1">
                <div className="font-bold text-atlas-accent">In-Situ Rovers: Mars 2020 & MSL Curiosity</div>
                <div className="text-atlas-text">NASA JPL-Caltech / Planetary Data System Analyst's Notebook</div>
                <div className="text-[10px] text-atlas-muted">Jezero and Gale Crater ground targets & sample cache coords</div>
              </div>
            </div>

            <div className="pt-2 text-[10px] text-atlas-muted text-right border-t border-atlas-border">
              All datasets are public domain NASA/USGS planetary science products.
            </div>
          </div>
        </div>
      )}

      {/* System Pipeline Status Modal */}
      {isStatusOpen && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-atlas-surface border border-atlas-border p-6 font-mono text-xs space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-atlas-border pb-3">
              <div className="flex items-center space-x-2">
                <Activity className="w-4 h-4 text-atlas-teal" />
                <span className="font-display font-bold text-atlas-text text-sm">
                  Data Pipeline & Architecture Status
                </span>
              </div>
              <button onClick={() => setStatusOpen(false)} className="text-atlas-muted hover:text-atlas-text">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-[11px]">
              <div className="p-2.5 bg-atlas-elevated border border-atlas-border flex items-center justify-between">
                <span className="text-atlas-muted">MOLA Elevation Service:</span>
                <span className="text-atlas-teal font-bold flex items-center space-x-1">
                  <CheckCircle className="w-3 h-3" />
                  <span>{pipelineStatus?.molaElevation || "Available"}</span>
                </span>
              </div>

              <div className="p-2.5 bg-atlas-elevated border border-atlas-border flex items-center justify-between">
                <span className="text-atlas-muted">THEMIS Thermal WMS:</span>
                <span className="text-atlas-teal font-bold flex items-center space-x-1">
                  <CheckCircle className="w-3 h-3" />
                  <span>{pipelineStatus?.themisThermal || "Available"}</span>
                </span>
              </div>

              <div className="p-2.5 bg-atlas-elevated border border-atlas-border flex items-center justify-between">
                <span className="text-atlas-muted">Viking MDIM Basemap:</span>
                <span className="text-atlas-teal font-bold flex items-center space-x-1">
                  <CheckCircle className="w-3 h-3" />
                  <span>{pipelineStatus?.vikingImagery || "Available"}</span>
                </span>
              </div>

              <div className="p-2.5 bg-atlas-elevated border border-atlas-border flex items-center justify-between">
                <span className="text-atlas-muted">Science Target Archive:</span>
                <span className="text-atlas-teal font-bold flex items-center space-x-1">
                  <CheckCircle className="w-3 h-3" />
                  <span>{pipelineStatus?.scienceTargets || "Available"}</span>
                </span>
              </div>

              <div className="p-2.5 bg-atlas-elevated border border-atlas-border flex items-center justify-between">
                <span className="text-atlas-muted">AI/ML Assessment Module:</span>
                <span className="text-atlas-blue font-bold flex items-center space-x-1">
                  <Activity className="w-3 h-3" />
                  <span>{pipelineStatus?.mlService || "Fallback Mode (Rule-based)"}</span>
                </span>
              </div>

              <div className="p-2.5 bg-atlas-elevated border border-atlas-border flex items-center justify-between">
                <span className="text-atlas-muted">Mission Storage / PostGIS:</span>
                <span className="text-atlas-text font-bold">
                  {pipelineStatus?.database || "Local In-Memory Repository"}
                </span>
              </div>
            </div>

            <div className="p-3 bg-atlas-elevated border border-atlas-border text-[10px] text-atlas-muted leading-relaxed">
              Deterministic fallback enables continuous demonstration even under external network severance.
            </div>
          </div>
        </div>
      )}

      {/* Bottom Telemetry HUD */}
      <div className="absolute bottom-4 left-4 z-20 bg-atlas-surface/95 border border-atlas-border px-3 py-2 flex items-center space-x-4 text-xs font-mono backdrop-blur-md shadow-xl">
        <div className="flex items-center space-x-2 text-atlas-text">
          <Crosshair className="w-3.5 h-3.5 text-atlas-blue" />
          <span className="text-atlas-muted">Reticle:</span>
          <span className="font-bold">{formatMarsCoordinate(hoverCoord)}</span>
        </div>
        <div className="border-l border-atlas-border pl-3 flex items-center space-x-2 text-atlas-muted">
          <Eye className="w-3.5 h-3.5 text-atlas-accent" />
          <span>Projection: Planetographic (z{currentZoom})</span>
        </div>
        {Math.abs(centerLat) > 80 && (
          <div className="border-l border-atlas-border pl-3 text-atlas-amber font-semibold">
            Polar latitude (&gt;80°): Web Mercator distortion / limited coverage
          </div>
        )}
        {currentZoom > (activeLayer === "mola" ? 6 : activeLayer === "viking" ? 7 : 8) && (
          <div className="border-l border-atlas-border pl-3 text-atlas-muted">
            Overzoomed (native z{activeLayer === "mola" ? 6 : activeLayer === "viking" ? 7 : 8})
          </div>
        )}
        {tileErrorCount > 0 && (
          <div className="border-l border-atlas-border pl-3 text-atlas-amber font-semibold">
            Incomplete coverage ({tileErrorCount} tile{tileErrorCount === 1 ? "" : "s"} failed)
          </div>
        )}
      </div>
    </div>
  );
};
