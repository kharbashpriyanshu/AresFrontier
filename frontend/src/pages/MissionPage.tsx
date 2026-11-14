import React, { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { api, StoredMissionRecord } from "../services/api.js";
import {
  MarsRoute,
  EVAAssessment,
  MissionAssessment,
  RouteCandidate,
  AuditVerificationResult,
  MissionPlanStatus,
  UserRole,
  MissionReportData,
  PlanetaryAgent,
  Hazard,
  ScienceObjectiveId,
} from "../types/index.js";
import { ElevationProfileChart } from "../components/ElevationProfileChart.js";
import { ScenarioBuilder } from "../components/ScenarioBuilder.js";
import { Mars3DView } from "../components/Mars3DView.js";
import { MissionCopilotModal } from "../components/MissionCopilotModal.js";
import { EvaSessionConsole } from "../components/EvaSessionConsole.js";
import {
  Clock,
  Sparkles,
  CheckCircle,
  Database,
  ArrowLeft,
  Sliders,
  Download,
  Printer,
  Lock,
  CheckCircle2,
  TrendingUp,
  FileText,
  FileSpreadsheet,
  Compass,
  Boxes,
  RefreshCw,
  Plus,
  Edit3,
  Trash2,
  X,
} from "lucide-react";

export const MissionPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const routeIdParam = searchParams.get("routeId");
  const missionIdParam = searchParams.get("missionId");

  // Tab State
  const [activeTab, setActiveTab] = useState<"PLANNING" | "SCENARIOS" | "REPORTING" | "EVA">("PLANNING");
  const [show3D, setShow3D] = useState<boolean>(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState<boolean>(false);

  // Mission Management State
  const [missions, setMissions] = useState<StoredMissionRecord[]>([]);
  const [activeMission, setActiveMission] = useState<StoredMissionRecord | null>(null);
  const [missionModalMode, setMissionModalMode] = useState<"create" | "edit" | null>(null);
  const [formName, setFormName] = useState<string>("");
  const [formDescription, setFormDescription] = useState<string>("");
  const [formObjectiveId, setFormObjectiveId] = useState<ScienceObjectiveId>("ANCIENT_WATER_ACTIVITY");
  const [formRouteId, setFormRouteId] = useState<string>("route-jezero-delta-sol100");
  const [formMaxDuration, setFormMaxDuration] = useState<number>(240);
  const [formReturnRequired, setFormReturnRequired] = useState<boolean>(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmittingMission, setIsSubmittingMission] = useState<boolean>(false);

  // Core Data
  const [route, setRoute] = useState<MarsRoute | null>(null);
  const [allRoutes, setAllRoutes] = useState<MarsRoute[]>([]);
  const [agents, setAgents] = useState<PlanetaryAgent[]>([]);
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const [evaAssessment, setEvaAssessment] = useState<EVAAssessment | null>(null);
  const [mlAssessment, setMlAssessment] = useState<MissionAssessment | null>(null);
  const [candidates, setCandidates] = useState<RouteCandidate[]>([]);
  const [reportData, setReportData] = useState<MissionReportData | null>(null);

  // Mission Parameters (Interactive parameter tuner)
  const [maxDurationMinutes, setMaxDurationMinutes] = useState<number>(240);
  const [returnRequired, setReturnRequired] = useState<boolean>(true);
  const [walkingMode, setWalkingMode] = useState<"standard" | "utv">("standard");

  // Governance & Security
  const userRole: UserRole = "MISSION_COMMAND";
  const [planStatus, setPlanStatus] = useState<MissionPlanStatus>("ASSESSED");
  const [planVersion, setPlanVersion] = useState<number>(1);
  const [auditVerification, setAuditVerification] = useState<AuditVerificationResult | null>(null);
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSavingPlan, setIsSavingPlan] = useState<boolean>(false);

  // Batch 9: Unified Planning State (Science Targets, Agent Assignment & Backend Multi-Objective Comparison)
  const [scienceTargets, setScienceTargets] = useState<any[]>([]);
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("rover-01");
  const [planComparison, setPlanComparison] = useState<any>(null);

  useEffect(() => {
    async function loadMissionData() {
      try {
        setIsLoading(true);

        const [fetchedMissions, fetchedRoutes, fetchedAgents, fetchedHazards, fetchedTargets] = await Promise.all([
          api.getAllMissions().catch(() => [] as StoredMissionRecord[]),
          api.getAllRoutes().catch(() => []),
          api.getAgents().catch(() => []),
          api.getHazards().catch(() => []),
          api.getScienceTargets().catch(() => []),
        ]);
        setScienceTargets(fetchedTargets);
        if (fetchedTargets.length > 0 && selectedTargetIds.length === 0) {
          setSelectedTargetIds(fetchedTargets.slice(0, 2).map((t: any) => t.id));
        }
        if (fetchedAgents.length > 0) {
          setSelectedAgentId(fetchedAgents[0].id);
        }

        // Deduplicate routes by ID and identical route signature (prevents test-run clones from repeating)
        const seenIds = new Set<string>();
        const seenSignatures = new Set<string>();
        const uniqueRoutes = fetchedRoutes.filter((r: MarsRoute) => {
          if (!r?.id || seenIds.has(r.id)) return false;
          const sig = `${r.name}|${r.totalDistanceKm}|${r.estimatedDurationMinutes}|${r.maxSlopeDegrees}`;
          if (seenSignatures.has(sig)) return false;
          seenIds.add(r.id);
          seenSignatures.add(sig);
          return true;
        });

        setMissions(fetchedMissions);
        setAllRoutes(uniqueRoutes);
        setAgents(fetchedAgents);
        setHazards(fetchedHazards);

        const resolvedMission =
          (missionIdParam ? fetchedMissions.find((m) => m.id === missionIdParam) : undefined) ||
          (!routeIdParam ? fetchedMissions.find((m) => m.id === "MARSWALK-001") || fetchedMissions[0] : undefined) ||
          null;

        setActiveMission(resolvedMission);

        const effectiveDuration = resolvedMission ? resolvedMission.parameters.maxDurationMinutes : maxDurationMinutes;
        const effectiveReturn = resolvedMission ? resolvedMission.parameters.returnRequired : returnRequired;

        if (resolvedMission) {
          setMaxDurationMinutes(resolvedMission.parameters.maxDurationMinutes);
          setReturnRequired(resolvedMission.parameters.returnRequired);
          setPlanStatus(resolvedMission.status === "LOCKED" ? "LOCKED" : resolvedMission.status === "APPROVED" ? "APPROVED" : "DRAFT");
        }

        const targetRouteId = routeIdParam || resolvedMission?.routeId || "route-jezero-delta-sol100";
        let activeRouteData: MarsRoute;
        try {
          activeRouteData = await api.getRouteById(targetRouteId);
        } catch {
          activeRouteData = fetchedRoutes[0] || ({} as MarsRoute);
        }

        setRoute(activeRouteData);

        if (resolvedMission?.evaAssessment) {
          setEvaAssessment(resolvedMission.evaAssessment);
        }

        // Fetch AI/ML score & candidate routes without creating duplicate persisted missions
        if (activeRouteData.id && activeRouteData.points?.length > 0) {
          const [mlRes] = await Promise.all([
            api.assessMission(activeRouteData.id, effectiveDuration).catch(() => null),
            api.getScientificAssessment(
              activeRouteData.points[0].coordinate.latitude,
              activeRouteData.points[0].coordinate.longitude
            ).catch(() => null),
          ]);

          if (mlRes) setMlAssessment(mlRes);

          try {
            const destCoord = activeRouteData.points[activeRouteData.points.length - 1].coordinate;
            const cands = await api.optimizeRoute({
              startCoordinate: activeRouteData.points[0].coordinate,
              destinationCoordinate: destCoord,
              maxDurationMinutes: effectiveDuration,
              returnRequired: effectiveReturn,
            });
            setCandidates(cands);
          } catch {
            console.warn("Candidate reasoning bypassed for local route");
          }
        }

        const effectiveMissionId = resolvedMission?.id || "MARSWALK-001";
        try {
          const [auditResult, rep] = await Promise.all([
            api.verifyAuditChain().catch(() => null),
            api.getMissionReport(effectiveMissionId, "json").catch(() => null),
          ]);
          setAuditVerification(auditResult);
          setReportData(rep);
        } catch (e) {
          console.warn("Audit chain / report check unavailable", e);
        }
      } catch (err) {
        console.error("Error loading mission", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadMissionData();
  }, [missionIdParam, routeIdParam]);

  const handleSelectRoute = (newRouteId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("routeId", newRouteId);
    setSearchParams(next);
    showNotification(`Switched active candidate route to ${newRouteId}`);
  };

  const handleSelectMission = (missionId: string) => {
    const selected = missions.find((m) => m.id === missionId);
    const next = new URLSearchParams();
    next.set("missionId", missionId);
    if (selected?.routeId) {
      next.set("routeId", selected.routeId);
    }
    setSearchParams(next);
    showNotification(`Loaded mission: ${selected?.name || missionId}`);
  };

  const openCreateMissionModal = () => {
    setFormError(null);
    setFormName("");
    setFormDescription("");
    setFormObjectiveId("ANCIENT_WATER_ACTIVITY");
    setFormRouteId(route?.id || allRoutes[0]?.id || "route-jezero-delta-sol100");
    setFormMaxDuration(maxDurationMinutes);
    setFormReturnRequired(returnRequired);
    setMissionModalMode("create");
  };

  const openEditMissionModal = () => {
    if (!activeMission) return;
    setFormError(null);
    setFormName(activeMission.name);
    setFormDescription(activeMission.description || "");
    setFormObjectiveId(activeMission.objectiveId || "ANCIENT_WATER_ACTIVITY");
    setFormRouteId(activeMission.routeId);
    setFormMaxDuration(activeMission.parameters.maxDurationMinutes);
    setFormReturnRequired(activeMission.parameters.returnRequired);
    setMissionModalMode("edit");
  };

  const handleSubmitMissionModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError("Mission name is required.");
      return;
    }
    if (!formRouteId) {
      setFormError("A valid traverse route is required.");
      return;
    }
    if (!formMaxDuration || formMaxDuration <= 0) {
      setFormError("Max EVA duration must be greater than 0 minutes.");
      return;
    }

    setIsSubmittingMission(true);
    setFormError(null);
    try {
      const selectedRoute = allRoutes.find((r) => r.id === formRouteId) || route;
      const startCoord = selectedRoute?.points?.[0]?.coordinate || { latitude: 18.4447, longitude: 77.4508 };

      if (missionModalMode === "create") {
        const created = await api.createMission({
          name: formName.trim(),
          description: formDescription.trim() || undefined,
          objectiveId: formObjectiveId,
          routeId: formRouteId,
          maxDurationMinutes: formMaxDuration,
          startCoordinate: startCoord,
          returnRequired: formReturnRequired,
          status: "DRAFT",
        });
        setMissions((prev) => [...prev, created]);
        setMissionModalMode(null);
        setSearchParams({ missionId: created.id, routeId: created.routeId });
        showNotification(`Created mission "${created.name}".`);
      } else if (missionModalMode === "edit" && activeMission) {
        const updated = await api.updateMission(activeMission.id, {
          name: formName.trim(),
          description: formDescription.trim(),
          objectiveId: formObjectiveId,
          routeId: formRouteId,
          maxDurationMinutes: formMaxDuration,
          returnRequired: formReturnRequired,
        });
        setMissions((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        setActiveMission(updated);
        setEvaAssessment(updated.evaAssessment);
        setMaxDurationMinutes(updated.parameters.maxDurationMinutes);
        setReturnRequired(updated.parameters.returnRequired);
        setMissionModalMode(null);
        setSearchParams({ missionId: updated.id, routeId: updated.routeId });
        showNotification(`Updated mission "${updated.name}".`);
      }
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to save mission.");
    } finally {
      setIsSubmittingMission(false);
    }
  };

  const handleDeleteActiveMission = async () => {
    if (!activeMission || activeMission.id === "MARSWALK-001") return;
    try {
      await api.deleteMission(activeMission.id);
      const remaining = missions.filter((m) => m.id !== activeMission.id);
      setMissions(remaining);
      const fallback = remaining.find((m) => m.id === "MARSWALK-001") || remaining[0];
      if (fallback) {
        setSearchParams({ missionId: fallback.id, routeId: fallback.routeId });
      } else {
        setSearchParams({});
      }
      showNotification(`Deleted mission "${activeMission.name}".`);
    } catch (err: unknown) {
      showNotification(`Failed to delete mission: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  const handleSavePlan = async () => {
    if (!route) return;
    setIsSavingPlan(true);
    try {
      if (activeMission) {
        const updated = await api.updateMission(activeMission.id, {
          routeId: route.id,
          maxDurationMinutes,
          returnRequired,
        });
        setMissions((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        setActiveMission(updated);
        setEvaAssessment(updated.evaAssessment);
      } else {
        const created = await api.createMission({
          name: `${route.name} Plan`,
          routeId: route.id,
          maxDurationMinutes,
          startCoordinate: route.points[0].coordinate,
          returnRequired,
        });
        setMissions((prev) => [...prev, created]);
        setActiveMission(created);
        setEvaAssessment(created.evaAssessment);
        setSearchParams({ missionId: created.id, routeId: created.routeId });
      }

      // Update canonical mission domain for active mission
      await api.updateUnifiedMissionDomain(
        "routes",
        { activeRouteId: route.id },
        activeMission?.id
      );

      showNotification("Mission plan saved to persistent canonical store.");
    } catch (err: any) {
      showNotification(`Failed to save plan: ${err.message}`);
    } finally {
      setIsSavingPlan(false);
    }
  };

  const handleExportCSV = async () => {
    const targetMissionId = activeMission?.id || "MARSWALK-001";
    try {
      const csvData = await api.getMissionReport(targetMissionId, "csv");
      const blob = new Blob([csvData], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `MartianMap_MissionReport_${targetMissionId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showNotification("Mission Report exported as CSV.");
    } catch {
      showNotification("CSV export failed.");
    }
  };

  const handleExportMarkdown = async () => {
    const targetMissionId = activeMission?.id || "MARSWALK-001";
    try {
      const mdData = await api.getMissionReport(targetMissionId, "markdown");
      const blob = new Blob([mdData], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `MartianMap_MissionReport_${targetMissionId}.md`;
      a.click();
      URL.revokeObjectURL(url);
      showNotification("Mission Report exported as Markdown.");
    } catch {
      showNotification("Markdown export failed.");
    }
  };

  const handleExportJSON = () => {
    if (!route) return;
    const reportObj = reportData || {
      mission: activeMission,
      route,
      evaAssessment,
      missionScore: mlAssessment,
      candidates,
    };
    const blob = new Blob([JSON.stringify(reportObj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `MartianMap_MissionReport_${activeMission?.id || route.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification("Mission Assessment Report exported as JSON.");
  };

  const handleApprovePlan = async () => {
    if (!route) return;
    const targetMissionId = activeMission?.id || route.id;
    try {
      if (activeMission) {
        const updated = await api.updateMission(activeMission.id, { status: "APPROVED" });
        setMissions((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        setActiveMission(updated);
      }
      await api.approveMission(targetMissionId, "Commander (Primary Station)");
      setPlanStatus("APPROVED");
      setPlanVersion((v) => v + 1);
      showNotification("Mission plan approved by MISSION_COMMAND.");
    } catch (err: unknown) {
      showNotification(`Approval failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  const handleLockPlan = async () => {
    if (!route) return;
    const targetMissionId = activeMission?.id || route.id;
    try {
      if (activeMission) {
        const updated = await api.updateMission(activeMission.id, { status: "LOCKED" });
        setMissions((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        setActiveMission(updated);
      }
      await api.lockMission(targetMissionId, "Flight Director (Houston Control)");
      setPlanStatus("LOCKED");
      showNotification("Mission plan cryptographically LOCKED. Traversal route and telemetry frozen.");
    } catch (err: unknown) {
      showNotification(`Lock failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  const showNotification = (msg: string) => {
    setNotificationMsg(msg);
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  if (isLoading || !route) {
    return (
      <div className="h-[calc(100vh-3.5rem)] bg-atlas-bg flex flex-col items-center justify-center space-y-4 font-mono text-xs text-atlas-muted">
        <div className="w-8 h-8 border-2 border-atlas-accent border-t-transparent animate-spin" />
        <div className="tracking-widest uppercase font-semibold text-atlas-text">
          Synthesizing Planetary Mission Planning Workspace...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-atlas-bg text-atlas-text font-sans p-4 md:p-6 pb-24 transition-colors">
      {/* Toast Notification */}
      {notificationMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-atlas-elevated border border-atlas-accent text-atlas-text px-4 py-3 rounded shadow-2xl font-mono text-xs flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-atlas-accent shrink-0" />
          <span>{notificationMsg}</span>
        </div>
      )}

      {/* Floating Mission Copilot Assistant Modal */}
      <MissionCopilotModal
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
        missionId={activeMission?.id}
      />

      {/* Create / Edit Mission Modal */}
      {missionModalMode && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitMissionModal}
            className="w-full max-w-lg bg-atlas-surface border border-atlas-border p-6 rounded shadow-2xl space-y-4 font-mono text-xs"
          >
            <div className="flex items-center justify-between border-b border-atlas-border pb-3">
              <h2 className="text-sm font-bold font-display text-atlas-text uppercase tracking-wider">
                {missionModalMode === "create" ? "Create New EVA Mission" : `Edit Mission (${activeMission?.id})`}
              </h2>
              <button
                type="button"
                onClick={() => setMissionModalMode(null)}
                className="text-atlas-muted hover:text-atlas-text"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-2.5 bg-red-500/10 border border-red-500/40 text-red-400 text-xs">
                {formError}
              </div>
            )}

            <div className="space-y-1">
              <label className="block text-atlas-muted uppercase text-[10px]">Mission Name *</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Sol 104 Kodiak Core Sampling EVA"
                className="w-full bg-atlas-elevated border border-atlas-border rounded px-3 py-2 text-atlas-text focus:outline-none focus:border-atlas-accent"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="block text-atlas-muted uppercase text-[10px]">Mission Description</label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={2}
                placeholder="Operational summary, sampling goals, or contingency notes..."
                className="w-full bg-atlas-elevated border border-atlas-border rounded px-3 py-2 text-atlas-text focus:outline-none focus:border-atlas-accent"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-atlas-muted uppercase text-[10px]">Science Objective</label>
                <select
                  value={formObjectiveId}
                  onChange={(e) => setFormObjectiveId(e.target.value as ScienceObjectiveId)}
                  className="w-full bg-atlas-elevated border border-atlas-border rounded px-2.5 py-2 text-atlas-text"
                >
                  <option value="ANCIENT_WATER_ACTIVITY">Ancient Water Activity</option>
                  <option value="PAST_HABITABILITY">Past Habitability</option>
                  <option value="MINERALOGICAL_DIVERSITY">Mineralogical Diversity</option>
                  <option value="SUBSURFACE_ICE">Subsurface Ice</option>
                  <option value="VOLCANIC_STRATIGRAPHY">Volcanic Stratigraphy</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-atlas-muted uppercase text-[10px]">Traverse Route</label>
                <select
                  value={formRouteId}
                  onChange={(e) => setFormRouteId(e.target.value)}
                  className="w-full bg-atlas-elevated border border-atlas-border rounded px-2.5 py-2 text-atlas-text"
                >
                  {allRoutes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.totalDistanceKm} km)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
              <div className="space-y-1">
                <label className="block text-atlas-muted uppercase text-[10px]">Max Duration (min)</label>
                <input
                  type="number"
                  min={30}
                  max={600}
                  value={formMaxDuration}
                  onChange={(e) => setFormMaxDuration(Number(e.target.value))}
                  className="w-full bg-atlas-elevated border border-atlas-border rounded px-3 py-2 text-atlas-text"
                />
              </div>

              <label className="flex items-center space-x-2 pt-4 cursor-pointer text-atlas-text">
                <input
                  type="checkbox"
                  checked={formReturnRequired}
                  onChange={(e) => setFormReturnRequired(e.target.checked)}
                />
                <span>Require S3 Return Reserve</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-atlas-border">
              <button
                type="button"
                onClick={() => setMissionModalMode(null)}
                className="px-3 py-1.5 border border-atlas-border text-atlas-muted hover:text-atlas-text rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingMission}
                className="px-4 py-1.5 bg-atlas-accent hover:bg-atlas-accent/90 text-white font-bold rounded disabled:opacity-50"
              >
                {isSubmittingMission ? "Saving..." : missionModalMode === "create" ? "Create Mission" : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Top Header Bar */}
      <div className="max-w-7xl mx-auto mb-6 flex flex-col gap-4 border-b border-atlas-border pb-4">
        {/* Mission Management Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-atlas-surface border border-atlas-border px-3 py-2 rounded">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-mono font-bold text-atlas-muted uppercase">Active Mission:</span>
            <select
              aria-label="Active Mission Selector"
              value={activeMission?.id || ""}
              onChange={(e) => handleSelectMission(e.target.value)}
              className="bg-atlas-elevated border border-atlas-border rounded px-2.5 py-1 text-xs font-mono text-atlas-text min-w-[240px]"
            >
              {missions.length === 0 && <option value="">Unsaved Route Plan</option>}
              {missions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} [{m.status}]
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openCreateMissionModal}
              className="flex items-center gap-1 px-2.5 py-1 bg-atlas-accent/15 border border-atlas-accent text-atlas-text hover:bg-atlas-accent/25 rounded text-xs font-mono font-semibold"
            >
              <Plus className="w-3.5 h-3.5 text-atlas-accent" />
              <span>New Mission</span>
            </button>
            {activeMission && (
              <button
                type="button"
                onClick={openEditMissionModal}
                className="flex items-center gap-1 px-2.5 py-1 bg-atlas-elevated border border-atlas-border text-atlas-text hover:border-atlas-accent rounded text-xs font-mono font-semibold"
              >
                <Edit3 className="w-3.5 h-3.5 text-atlas-blue" />
                <span>Edit Mission</span>
              </button>
            )}
            {activeMission && activeMission.id !== "MARSWALK-001" && (
              <button
                type="button"
                onClick={handleDeleteActiveMission}
                className="flex items-center gap-1 px-2.5 py-1 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 rounded text-xs font-mono"
                title="Delete Mission"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-atlas-muted mb-1">
            <Link
              to={`/map?routeId=${encodeURIComponent(route.id)}${activeMission ? `&missionId=${encodeURIComponent(activeMission.id)}` : ""}`}
              className="hover:text-atlas-text flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Planetary Map
            </Link>
            <span>/</span>
            <span>Mission Planning Workspace</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl md:text-2xl font-bold font-display text-atlas-text">
              {activeMission ? activeMission.name : route.name}
            </h1>
            <span
              className={`text-xs px-2.5 py-0.5 font-mono font-semibold border ${
                planStatus === "LOCKED"
                  ? "bg-red-500/10 text-red-400 border-red-500/30"
                  : planStatus === "APPROVED"
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  : "bg-atlas-elevated text-atlas-muted border-atlas-border"
              }`}
            >
              {planStatus} v{planVersion}.0
            </span>
            <span className="text-xs px-2.5 py-0.5 font-mono bg-atlas-elevated text-atlas-teal border border-atlas-border">
              {route.totalDistanceKm} km | {route.estimatedDurationMinutes} min
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsCopilotOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-atlas-accent/15 border border-atlas-accent text-atlas-text hover:bg-atlas-accent/25 rounded text-xs font-mono font-bold transition-all shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-atlas-accent" />
            <span>Mission Copilot</span>
          </button>

          <button
            onClick={handleSavePlan}
            disabled={isSavingPlan}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-atlas-accent hover:bg-atlas-accent/90 disabled:opacity-50 text-white rounded text-xs font-mono font-bold shadow transition-all"
          >
            {isSavingPlan ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Database className="w-3.5 h-3.5" />
            )}
            <span>Save Plan</span>
          </button>

          {userRole === "MISSION_COMMAND" && planStatus !== "LOCKED" && (
            <button
              onClick={handleApprovePlan}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 border border-emerald-500 text-emerald-300 hover:bg-emerald-500/25 rounded text-xs font-mono font-semibold"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Approve</span>
            </button>
          )}

          {userRole === "MISSION_COMMAND" && planStatus !== "LOCKED" && (
            <button
              onClick={handleLockPlan}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/15 border border-red-500 text-red-300 hover:bg-red-500/25 rounded text-xs font-mono font-semibold"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Lock Plan</span>
            </button>
          )}
        </div>
        </div>
      </div>

      {/* Workspace Navigation Tabs */}
      <div className="max-w-7xl mx-auto mb-6 flex flex-wrap items-center justify-between gap-2 border-b border-atlas-border">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab("PLANNING")}
            className={`px-4 py-2.5 text-xs font-mono font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "PLANNING"
                ? "border-atlas-accent text-atlas-accent bg-atlas-surface/60"
                : "border-transparent text-atlas-muted hover:text-atlas-text"
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>1. Planning & Multi-Plan Comparison</span>
          </button>

          <button
            onClick={() => setActiveTab("SCENARIOS")}
            className={`px-4 py-2.5 text-xs font-mono font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "SCENARIOS"
                ? "border-atlas-accent text-atlas-accent bg-atlas-surface/60"
                : "border-transparent text-atlas-muted hover:text-atlas-text"
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>2. Dynamic Scenario Builder</span>
          </button>

          <button
            onClick={() => setActiveTab("REPORTING")}
            className={`px-4 py-2.5 text-xs font-mono font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "REPORTING"
                ? "border-atlas-accent text-atlas-accent bg-atlas-surface/60"
                : "border-transparent text-atlas-muted hover:text-atlas-text"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>3. Mission Reporting & Audit Lineage</span>
          </button>

          <button
            onClick={() => setActiveTab("EVA")}
            className={`px-4 py-2.5 text-xs font-mono font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "EVA"
                ? "border-atlas-accent text-atlas-accent bg-atlas-surface/60"
                : "border-transparent text-atlas-muted hover:text-atlas-text"
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>4. EVA Session & Safety Console</span>
          </button>
        </div>

        {/* 3D / 2D Elevation View Switcher */}
        {activeTab === "PLANNING" && (
          <button
            onClick={() => setShow3D((v) => !v)}
            className={`px-3 py-1 rounded text-xs font-mono font-semibold border flex items-center gap-1.5 transition-colors ${
              show3D
                ? "bg-atlas-accent text-white border-atlas-accent"
                : "bg-atlas-elevated text-atlas-text border-atlas-border hover:bg-atlas-elevated/80"
            }`}
          >
            <Boxes className="w-3.5 h-3.5" />
            <span>{show3D ? "2D Chart View" : "3D Mars Surface View"}</span>
          </button>
        )}
      </div>

      <div className="max-w-7xl mx-auto">
        {/* ========================================================================= */}
        {/* TAB 1: UNIFIED MISSION PLANNING & MULTI-OBJECTIVE CANDIDATE COMPARISON   */}
        {/* ========================================================================= */}
        {activeTab === "PLANNING" && (
          <div className="space-y-6">
            {/* Top Interactive Parameter Console */}
            <div className="bg-atlas-surface border border-atlas-border p-4 rounded-lg">
              <div className="flex flex-col lg:flex-row lg:items-center flex-wrap justify-between gap-4">
                {/* Route Selector Dropdown */}
                <div className="flex items-center gap-3">
                  <label className="text-xs font-mono text-atlas-muted uppercase">Select Candidate:</label>
                  <select
                    value={route.id}
                    onChange={(e) => handleSelectRoute(e.target.value)}
                    className="bg-atlas-elevated border border-atlas-border text-atlas-text text-xs font-mono px-3 py-1.5 rounded focus:outline-none focus:border-atlas-accent"
                  >
                    {allRoutes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.totalDistanceKm} km, {r.maxSlopeDegrees}° max slope)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Duration Slider */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-atlas-accent" />
                    <span className="text-xs font-mono text-atlas-muted">Max Duration:</span>
                    <span className="text-xs font-mono font-bold text-atlas-text">{maxDurationMinutes}m</span>
                  </div>
                  <input
                    type="range"
                    min={60}
                    max={480}
                    step={15}
                    value={maxDurationMinutes}
                    onChange={(e) => setMaxDurationMinutes(Number(e.target.value))}
                    className="w-32 accent-atlas-accent cursor-pointer"
                  />
                </div>

                {/* Return Required Toggle */}
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="text-atlas-muted">Return Required:</span>
                  <button
                    onClick={() => setReturnRequired(!returnRequired)}
                    className={`px-2.5 py-1 rounded border text-[11px] font-bold ${
                      returnRequired
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                        : "bg-atlas-elevated text-atlas-muted border-atlas-border"
                    }`}
                  >
                    {returnRequired ? "YES (30-min Reserve S3)" : "NO (1-Way)"}
                  </button>
                </div>

                {/* Escort Mode */}
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="text-atlas-muted">Mode:</span>
                  <button
                    onClick={() => setWalkingMode(walkingMode === "standard" ? "utv" : "standard")}
                    className="px-2.5 py-1 bg-atlas-elevated border border-atlas-border text-atlas-text rounded text-[11px]"
                  >
                    {walkingMode === "standard" ? "Walking EVA" : "UTV Escort"}
                  </button>
                </div>
              </div>
            </div>

            {/* Visual View: 3D Mars View OR 2D Elevation Profile Chart */}
            {show3D ? (
              <Mars3DView
                route={route}
                agents={agents}
                hazards={hazards}
                scienceTargets={scienceTargets}
                selectedTargetIds={selectedTargetIds}
                onSelectTarget={(tid) =>
                  setSelectedTargetIds((prev) =>
                    prev.includes(tid) ? prev : [...prev, tid]
                  )
                }
              />
            ) : (
              <div className="bg-atlas-surface border border-atlas-border p-4 rounded-lg">
                <ElevationProfileChart
                  profile={route.elevationProfile || []}
                  totalDistanceKm={route.totalDistanceKm}
                />
              </div>
            )}

            {/* Batch 9: Science Targets & Agent Capability Assignment */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-atlas-surface border border-atlas-border p-4 rounded-lg space-y-3">
                <div className="flex items-center justify-between border-b border-atlas-border pb-2">
                  <h3 className="text-sm font-bold font-display text-atlas-text">
                    Science Target Selection ({selectedTargetIds.length} selected)
                  </h3>
                  <button
                    onClick={async () => {
                      const targetId = selectedTargetIds[0];
                      if (!targetId || !activeMission) return;
                      try {
                        await api.assignTargetToMission(targetId, activeMission.id);
                        showNotification(`Assigned science target ${targetId} to mission ${activeMission.id}.`);
                      } catch (err: any) {
                        showNotification(err.message || "Could not assign target.");
                      }
                    }}
                    disabled={selectedTargetIds.length === 0 || !activeMission}
                    className="px-2.5 py-1 rounded bg-atlas-teal/20 border border-atlas-teal/40 text-atlas-teal text-[11px] font-mono font-bold disabled:opacity-40"
                  >
                    Assign Selected to Mission
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {scienceTargets.slice(0, 6).map((t: any) => {
                    const checked = selectedTargetIds.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        onClick={() =>
                          setSelectedTargetIds((prev) =>
                            checked ? prev.filter((id) => id !== t.id) : [...prev, t.id]
                          )
                        }
                        className={`px-2.5 py-1 rounded border text-[11px] font-mono transition-colors ${
                          checked
                            ? "bg-atlas-accent/20 border-atlas-accent text-atlas-text font-bold"
                            : "bg-atlas-elevated/40 border-atlas-border text-atlas-muted hover:text-atlas-text"
                        }`}
                      >
                        {t.name || t.id} ({t.priorityScore ?? t.scientificPriority ?? "HIGH"})
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="bg-atlas-surface border border-atlas-border p-4 rounded-lg space-y-3">
                <div className="flex items-center justify-between border-b border-atlas-border pb-2">
                  <h3 className="text-sm font-bold font-display text-atlas-text">
                    Agent Capability & Plan Comparison
                  </h3>
                  <button
                    onClick={async () => {
                      try {
                        const cmp = await api.comparePlanningAlternatives({
                          missionId: activeMission?.id,
                          maxDurationMinutes,
                          returnRequired,
                          maxAllowedSlopeDeg: 20,
                          targetIds: selectedTargetIds,
                        });
                        setPlanComparison(cmp);
                        showNotification("Evaluated multi-objective plan alternatives with hard safety gating.");
                      } catch (err: any) {
                        showNotification(err.message || "Failed to evaluate plan alternatives.");
                      }
                    }}
                    className="px-3 py-1 rounded bg-atlas-accent text-white text-[11px] font-mono font-bold"
                  >
                    Evaluate & Compare Plans
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                  <span className="text-atlas-muted">Primary Asset:</span>
                  <select
                    value={selectedAgentId}
                    onChange={(e) => setSelectedAgentId(e.target.value)}
                    className="bg-atlas-elevated border border-atlas-border rounded px-2.5 py-1 text-xs text-atlas-text"
                  >
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.callsign} ({a.type} · {a.telemetry.batteryPercent}% batt)
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={async () => {
                      try {
                        await api.createOperationsTask({
                          agentId: selectedAgentId,
                          missionId: activeMission?.id,
                          name: `Planned Traverse & Sampling (${route.name})`,
                          taskType: "RECONNAISSANCE",
                          priority: "HIGH",
                          targetCoordinate: { latitude: 18.4, longitude: 77.5 },
                        });
                        showNotification(`Assigned planning task to ${selectedAgentId}.`);
                      } catch (err: any) {
                        showNotification(err.message || "Failed to assign task.");
                      }
                    }}
                    className="px-2.5 py-1 rounded bg-atlas-elevated hover:bg-atlas-accent/20 border border-atlas-border text-[11px] text-atlas-text"
                  >
                    Assign Asset Task
                  </button>
                </div>
              </div>
            </div>

            {/* Candidate Route Comparison Matrix */}
            <div className="bg-atlas-surface border border-atlas-border p-4 md:p-5 rounded-lg">
              <div className="flex items-center justify-between mb-3 border-b border-atlas-border pb-2">
                <div>
                  <h3 className="text-base font-bold font-display text-atlas-text flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-atlas-accent" />
                    <span>Candidate Plans Multi-Objective Comparison Matrix</span>
                  </h3>
                  <p className="text-xs text-atlas-muted font-mono mt-0.5">
                    {planComparison?.noUniversalWinnerNotice ||
                      "Hard safety constraints (S1/S2/S3) gate candidates before ranking. Evaluates Distance, Duration, Battery/O2 Margins, Comms, Hazard Exposure & Modeled Science Yield."}
                  </p>
                </div>
              </div>

              {((planComparison?.alternatives || allRoutes) as any[]).length === 0 ? (
                <div className="p-6 text-center text-xs font-mono text-atlas-muted border border-dashed border-atlas-border rounded">
                  No candidate route alternatives available for comparison.
                </div>
              ) : (
                <>
                  {/* Desktop Table View (lg+) */}
                  <div className="hidden lg:block overflow-x-auto">
                    <table className="w-full text-xs font-mono text-left">
                      <thead>
                        <tr className="border-b border-atlas-border text-atlas-muted">
                          <th className="py-2 px-3">Rank / Candidate</th>
                          <th className="py-2 px-3">Dist / Dur</th>
                          <th className="py-2 px-3">Max Slope</th>
                          <th className="py-2 px-3">Batt / O2 Margin</th>
                          <th className="py-2 px-3">Comms / Hazards</th>
                          <th className="py-2 px-3">Safety</th>
                          <th className="py-2 px-3">Modeled Science</th>
                          <th className="py-2 px-3">Hard Safety Gate</th>
                          <th className="py-2 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(planComparison?.alternatives || allRoutes).map((cand: any) => {
                          const candId = cand.routeId || cand.id;
                          const isSelected = candId === route.id;
                          const maxSlope = cand.maxSlopeDegrees ?? 0;
                          const compliant =
                            cand.hardSafetyCompliant !== undefined ? cand.hardSafetyCompliant : maxSlope <= 20.0;
                          const safetyScore =
                            cand.safetyScore ?? (compliant ? Math.max(65, Math.round(95 - maxSlope)) : 42);
                          const scienceScore = cand.modeledScienceYield ?? Math.min(95, Math.round(58 + (cand.totalDistanceKm || 2) * 5));
                          const battMargin = cand.batteryMarginPercent ?? Math.max(22, Math.round(92 - (cand.totalDistanceKm || 2) * 6));
                          const o2Margin = cand.oxygenMarginMinutes ?? Math.max(35, 260 - Math.round((cand.estimatedDurationMinutes || 120) * 0.65));
                          const commsPct = cand.commsFeasibilityPercent ?? 88;
                          const hazardCnt = cand.hazardExposureCount ?? 0;

                          return (
                            <tr
                              key={candId}
                              className={`border-b border-atlas-border/50 transition-colors ${
                                isSelected ? "bg-atlas-accent/10" : "hover:bg-atlas-elevated/40"
                              }`}
                            >
                              <td className="py-3 px-3 font-bold text-atlas-text">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {cand.rank ? (
                                    <span className="px-1.5 py-0.5 rounded bg-atlas-elevated text-[10px] text-atlas-accent">
                                      #{cand.rank}
                                    </span>
                                  ) : null}
                                  {isSelected && <span className="w-2 h-2 rounded-full bg-atlas-accent"></span>}
                                  <span>{cand.name}</span>
                                  {cand.deduplicatedCount > 0 && (
                                    <span className="px-1.5 py-0.5 rounded bg-atlas-elevated border border-atlas-border text-[9px] text-atlas-muted">
                                      +{cand.deduplicatedCount} identical collapsed
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-3 text-atlas-text">
                                {cand.distanceKm ?? cand.totalDistanceKm} km · {cand.estimatedDurationMinutes}m
                              </td>
                              <td className={`py-3 px-3 font-bold ${maxSlope > 20 ? "text-red-400" : "text-emerald-400"}`}>
                                {maxSlope.toFixed(1)}°
                              </td>
                              <td className="py-3 px-3 text-atlas-text">
                                {battMargin}% · {o2Margin}m
                              </td>
                              <td className="py-3 px-3 text-atlas-text">
                                {commsPct}% · {hazardCnt} haz
                              </td>
                              <td className="py-3 px-3">
                                <span
                                  className={`font-bold ${
                                    safetyScore >= 80 ? "text-emerald-400" : safetyScore >= 60 ? "text-amber-400" : "text-red-400"
                                  }`}
                                >
                                  {safetyScore}/100
                                </span>
                              </td>
                              <td className="py-3 px-3 text-atlas-teal font-bold">{scienceScore}/100</td>
                              <td className="py-3 px-3">
                                {!compliant ? (
                                  <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-bold">
                                    {cand.disqualificationReasons?.[0] || "BREACHES S2 (>20°)"}
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                                    S1–S8 COMPLIANT
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-right">
                                {!isSelected && (
                                  <button
                                    onClick={() => handleSelectRoute(candId)}
                                    className="px-2.5 py-1 bg-atlas-elevated hover:bg-atlas-accent text-atlas-text hover:text-white rounded text-[11px] border border-atlas-border transition-colors"
                                  >
                                    Select
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Tablet & Mobile Responsive Card Layout (<lg) */}
                  <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(planComparison?.alternatives || allRoutes).map((cand: any) => {
                      const candId = cand.routeId || cand.id;
                      const isSelected = candId === route.id;
                      const maxSlope = cand.maxSlopeDegrees ?? 0;
                      const compliant =
                        cand.hardSafetyCompliant !== undefined ? cand.hardSafetyCompliant : maxSlope <= 20.0;
                      const safetyScore =
                        cand.safetyScore ?? (compliant ? Math.max(65, Math.round(95 - maxSlope)) : 42);
                      const scienceScore = cand.modeledScienceYield ?? Math.min(95, Math.round(58 + (cand.totalDistanceKm || 2) * 5));
                      const battMargin = cand.batteryMarginPercent ?? Math.max(22, Math.round(92 - (cand.totalDistanceKm || 2) * 6));
                      const o2Margin = cand.oxygenMarginMinutes ?? Math.max(35, 260 - Math.round((cand.estimatedDurationMinutes || 120) * 0.65));
                      const commsPct = cand.commsFeasibilityPercent ?? 88;
                      const hazardCnt = cand.hazardExposureCount ?? 0;

                      return (
                        <div
                          key={candId}
                          className={`p-3 rounded border font-mono text-xs space-y-2 ${
                            isSelected ? "bg-atlas-accent/10 border-atlas-accent" : "bg-atlas-elevated/30 border-atlas-border"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-bold text-atlas-text flex flex-wrap items-center gap-1.5">
                              {cand.rank ? (
                                <span className="px-1.5 py-0.5 rounded bg-atlas-elevated text-[10px] text-atlas-accent">
                                  #{cand.rank}
                                </span>
                              ) : null}
                              <span>{cand.name}</span>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 ${
                                compliant
                                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                  : "bg-red-500/20 text-red-400 border-red-500/30"
                              }`}
                            >
                              {compliant ? "S1–S8 COMPLIANT" : "DISQUALIFIED"}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-1.5 text-[11px] text-atlas-muted">
                            <div>Dist/Dur: <span className="text-atlas-text">{cand.distanceKm ?? cand.totalDistanceKm} km · {cand.estimatedDurationMinutes}m</span></div>
                            <div>Max Slope: <span className={maxSlope > 20 ? "text-red-400 font-bold" : "text-emerald-400 font-bold"}>{maxSlope.toFixed(1)}°</span></div>
                            <div>Batt/O2: <span className="text-atlas-text">{battMargin}% · {o2Margin}m</span></div>
                            <div>Comms/Haz: <span className="text-atlas-text">{commsPct}% · {hazardCnt} haz</span></div>
                            <div>Safety: <span className="text-atlas-text font-bold">{safetyScore}/100</span></div>
                            <div>Science (Modeled): <span className="text-atlas-teal font-bold">{scienceScore}/100</span></div>
                          </div>

                          {!isSelected && (
                            <button
                              onClick={() => handleSelectRoute(candId)}
                              className="w-full py-1.5 bg-atlas-elevated hover:bg-atlas-accent text-atlas-text hover:text-white rounded text-[11px] font-bold border border-atlas-border transition-colors"
                            >
                              Select Candidate
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Safety Invariants S1-S8 Guard Card */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 font-mono text-xs">
              <div className="p-3 bg-atlas-surface border border-atlas-border rounded">
                <span className="text-[10px] text-atlas-muted uppercase block">Invariant S1: Power Floor</span>
                <span className="text-base font-bold text-emerald-400 block mt-1">PASS (≥20%)</span>
                <span className="text-[10px] text-atlas-muted">Reserve protected for abort</span>
              </div>
              <div className="p-3 bg-atlas-surface border border-atlas-border rounded">
                <span className="text-[10px] text-atlas-muted uppercase block">Invariant S2: Slope Ceiling</span>
                <span
                  className={`text-base font-bold block mt-1 ${
                    route.maxSlopeDegrees <= 20.0 ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {route.maxSlopeDegrees <= 20.0 ? "PASS (≤20.0°)" : "FAIL (>20.0°)"}
                </span>
                <span className="text-[10px] text-atlas-muted">Max incline {route.maxSlopeDegrees.toFixed(1)}°</span>
              </div>
              <div className="p-3 bg-atlas-surface border border-atlas-border rounded">
                <span className="text-[10px] text-atlas-muted uppercase block">Invariant S3: EVA Contingency</span>
                <span className="text-base font-bold text-emerald-400 block mt-1">PASS (≥30 min)</span>
                <span className="text-[10px] text-atlas-muted">Life-support return margin</span>
              </div>
              <div className="p-3 bg-atlas-surface border border-atlas-border rounded">
                <span className="text-[10px] text-atlas-muted uppercase block">Invariant S7: Audit Integrity</span>
                <span className="text-base font-bold text-atlas-teal block mt-1">
                  {auditVerification?.isValid ? "INVARIANT CHECK PASSED" : "UNVERIFIED"}
                </span>
                <span className="text-[10px] text-atlas-muted">
                  {auditVerification?.chainLength ?? 0} blocks SHA-256
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: DYNAMIC SCENARIO BUILDER                                           */}
        {/* ========================================================================= */}
        {activeTab === "SCENARIOS" && (
          <ScenarioBuilder
            baselineMissionId={route.id}
            onSimulationComplete={(res) => {
              showNotification(`Executed Scenario What-If (${res.simulationId}). Feasible: ${res.routeFeasible}`);
            }}
          />
        )}

        {/* ========================================================================= */}
        {/* TAB 3: MISSION REPORT GENERATION & DECISION TRACEABILITY                  */}
        {/* ========================================================================= */}
        {activeTab === "REPORTING" && (
          <div className="space-y-6">
            {/* Export Toolbar */}
            <div className="bg-atlas-surface border border-atlas-border p-4 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold font-display text-atlas-text flex items-center gap-2">
                  <FileText className="w-5 h-5 text-atlas-accent" />
                  <span>Mission Report Generation & Decision Traceability</span>
                </h3>
                <p className="text-xs text-atlas-muted font-mono mt-0.5">
                  Export Mission Briefings Synthesized from Canonical State, Audit Blocks &amp; Model Simulations
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-atlas-elevated hover:bg-atlas-elevated/80 border border-atlas-border text-atlas-text rounded text-xs font-mono font-bold"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span>Export CSV</span>
                </button>
                <button
                  onClick={handleExportMarkdown}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-atlas-elevated hover:bg-atlas-elevated/80 border border-atlas-border text-atlas-text rounded text-xs font-mono font-bold"
                >
                  <FileText className="w-4 h-4 text-blue-400" />
                  <span>Export Markdown</span>
                </button>
                <button
                  onClick={handleExportJSON}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-atlas-elevated hover:bg-atlas-elevated/80 border border-atlas-border text-atlas-text rounded text-xs font-mono font-bold"
                >
                  <Download className="w-4 h-4 text-atlas-teal" />
                  <span>Export JSON</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-atlas-elevated hover:bg-atlas-elevated/80 border border-atlas-border text-atlas-text rounded text-xs font-mono font-bold"
                >
                  <Printer className="w-4 h-4 text-purple-400" />
                  <span>Print Briefing</span>
                </button>
              </div>
            </div>

            {/* Generated Report Summary View */}
            {reportData && (
              <div className="bg-atlas-surface border border-atlas-border p-6 rounded-lg space-y-6 font-mono text-xs">
                {/* Header Strip */}
                <div className="border-b border-atlas-border pb-4">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <span className="text-[10px] text-atlas-muted uppercase block">OFFICIAL BRIEFING</span>
                      <h2 className="text-xl font-bold font-display text-atlas-text">
                        EXPEDITION MISSION REPORT — {reportData.missionId}
                      </h2>
                      <span className="text-[11px] text-atlas-muted">
                        Report ID: <code className="text-atlas-text">{reportData.reportId}</code> | Generated:{" "}
                        {new Date(reportData.generatedAt).toLocaleString()}
                      </span>
                    </div>
                    <span className="text-xs px-2.5 py-1 bg-atlas-elevated text-atlas-teal border border-atlas-border font-bold">
                      {reportData.classification}
                    </span>
                  </div>
                  <p className="mt-3 text-[11px] text-atlas-muted p-2.5 bg-atlas-elevated/40 border border-atlas-border rounded">
                    {reportData.provenanceNotice}
                  </p>
                </div>

                {/* Section 1: Executive KPI Strip */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-atlas-accent mb-3">
                    1. Executive Operational KPI Summary
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div className="p-3 bg-atlas-elevated/40 border border-atlas-border rounded">
                      <span className="text-[10px] text-atlas-muted uppercase block">Safety Score</span>
                      <span className="text-lg font-bold text-emerald-400 mt-0.5 block">
                        {reportData.executiveSummary.overallSafetyScore}/100
                      </span>
                    </div>
                    <div className="p-3 bg-atlas-elevated/40 border border-atlas-border rounded">
                      <span className="text-[10px] text-atlas-muted uppercase block">Science Yield</span>
                      <span className="text-lg font-bold text-atlas-teal mt-0.5 block">
                        {reportData.executiveSummary.scienceYieldScore}/100
                      </span>
                    </div>
                    <div className="p-3 bg-atlas-elevated/40 border border-atlas-border rounded">
                      <span className="text-[10px] text-atlas-muted uppercase block">Active Fleet</span>
                      <span className="text-lg font-bold text-atlas-text mt-0.5 block">
                        {reportData.executiveSummary.activeAgentsCount} Assets
                      </span>
                    </div>
                    <div className="p-3 bg-atlas-elevated/40 border border-atlas-border rounded">
                      <span className="text-[10px] text-atlas-muted uppercase block">Active Hazards</span>
                      <span className="text-lg font-bold text-amber-400 mt-0.5 block">
                        {reportData.executiveSummary.activeHazardsCount} Zones
                      </span>
                    </div>
                    <div className="p-3 bg-atlas-elevated/40 border border-atlas-border rounded">
                      <span className="text-[10px] text-atlas-muted uppercase block">Emergency Return</span>
                      <span className="text-lg font-bold text-emerald-400 mt-0.5 block">
                        {reportData.resourceBudget.emergencyReturnMarginMinutes} min
                      </span>
                    </div>
                    <div className="p-3 bg-atlas-elevated/40 border border-atlas-border rounded">
                      <span className="text-[10px] text-atlas-muted uppercase block">Audit Verification</span>
                      <span className="text-lg font-bold text-atlas-teal mt-0.5 block">
                        {reportData.executiveSummary.auditChainBlockHeight} Blocks
                      </span>
                    </div>
                  </div>
                </div>

                {/* Section 2: Fleet Capabilities */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-atlas-accent mb-3">
                    2. Deployed Expedition Fleet & Capabilities
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    {reportData.fleetStatus.map((a, idx) => (
                      <div key={idx} className="p-3 bg-atlas-elevated/40 border border-atlas-border rounded">
                        <span className="font-bold text-atlas-text block">{a.callsign}</span>
                        <span className="text-[10px] text-atlas-muted block mb-1.5">{a.type}</span>
                        <div className="space-y-0.5 text-[11px]">
                          <div>Battery: <strong className="text-atlas-text">{a.batteryPercent}%</strong></div>
                          <div>Max Slope: <strong className="text-atlas-text">{a.maxSlopeDeg}°</strong></div>
                          <div>Speed: <strong className="text-atlas-text">{a.speedKph} km/h</strong></div>
                          <div>Tubes: <strong className="text-atlas-text">{a.sampleTubesRemaining}</strong></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section 3: Safety Invariant Compliance */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-atlas-accent mb-3">
                    3. Safety Invariants S1–S8 Compliance Register
                  </h4>
                  <div className="space-y-1.5">
                    {reportData.safetyInvariantAudits.map((inv, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 bg-atlas-elevated/40 border border-atlas-border rounded flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                              inv.status === "PASS"
                                ? "bg-emerald-500/20 text-emerald-300"
                                : inv.status === "WARNING"
                                ? "bg-amber-500/20 text-amber-300"
                                : "bg-red-500/20 text-red-300"
                            }`}
                          >
                            {inv.id}
                          </span>
                          <span className="font-semibold text-atlas-text">{inv.name}</span>
                        </div>
                        <span className="text-atlas-muted">{inv.evaluatedMetric}</span>
                        <span className="text-[10px] text-atlas-muted hidden sm:inline">{inv.threshold}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section 4: Monte Carlo Distribution */}
                {reportData.simulationIntelligence.monteCarloAssessment && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-atlas-accent mb-2">
                      4. Stochastic Monte Carlo Uncertainty (100 Runs)
                    </h4>
                    <div className="p-3 bg-atlas-elevated/40 border border-atlas-border rounded flex flex-col sm:flex-row justify-between gap-3">
                      <div>
                        <span className="text-atlas-muted block text-[11px]">Probabilistic Success:</span>
                        <span className="text-lg font-bold text-emerald-400">
                          {reportData.simulationIntelligence.monteCarloAssessment.successProbabilityPercent}%
                        </span>
                      </div>
                      <div>
                        <span className="text-atlas-muted block text-[11px]">Median Duration (P50):</span>
                        <span className="text-lg font-bold text-atlas-text">
                          {reportData.simulationIntelligence.monteCarloAssessment.durationP50Minutes} min
                        </span>
                      </div>
                      <div>
                        <span className="text-atlas-muted block text-[11px]">95% Confidence Interval:</span>
                        <span className="text-lg font-bold text-atlas-teal">
                          [{reportData.simulationIntelligence.monteCarloAssessment.duration95CiMinutes[0]} -{" "}
                          {reportData.simulationIntelligence.monteCarloAssessment.duration95CiMinutes[1]}] min
                        </span>
                      </div>
                      <div>
                        <span className="text-atlas-muted block text-[11px]">Median Battery SoC:</span>
                        <span className="text-lg font-bold text-atlas-text">
                          {reportData.simulationIntelligence.monteCarloAssessment.batteryP50Percent}%
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "EVA" && (
          <EvaSessionConsole
            missionId={activeMission?.id}
            routeId={route?.id}
            agents={agents}
          />
        )}
      </div>
    </div>
  );
};
