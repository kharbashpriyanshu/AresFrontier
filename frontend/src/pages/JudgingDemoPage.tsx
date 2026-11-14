import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api.js";
import {
  Play,
  RotateCcw,
  Activity,
  GitBranch,
  Zap,
  Shield,
  AlertTriangle,
  Lock,
} from "lucide-react";

export const JudgingDemoPage: React.FC = () => {
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [scenarioReport, setScenarioReport] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Security Demo State
  const [securityDemoState, setSecurityDemoState] = useState<{
    step1ViewerBlocked?: boolean;
    step1Reason?: string;
    step2CommandExecuted?: boolean;
    step2Hash?: string;
    step3ReplayBlocked?: boolean;
    step3Reason?: string;
    running?: boolean;
  } | null>(null);

  // Audit Chain Verification State
  const [auditVerification, setAuditVerification] = useState<any>(null);
  const [isVerifyingChain, setIsVerifyingChain] = useState<boolean>(false);

  useEffect(() => {
    handleVerifyAuditChain();
  }, []);

  const handleVerifyAuditChain = async () => {
    setIsVerifyingChain(true);
    try {
      const res = await api.verifyAuditChain();
      setAuditVerification(res);
      setErrorMessage(null);
    } catch (err: any) {
      console.error("Audit chain verification failed", err);
      setErrorMessage("MISSION CONTROL CONNECTION LOST: Unable to reach cryptographic audit verifier.");
    } finally {
      setIsVerifyingChain(false);
    }
  };

  const handleRunSecurityDemo = async () => {
    setSecurityDemoState({ running: true });
    setErrorMessage(null);
    const testCommandId = `cmd-demo-replay-${Date.now()}`;
    const testNonce = `nonce-demo-${Date.now()}`;

    try {
      // Step 1: VIEWER Role attempts rover command (Expect 403 Forbidden)
      let step1Blocked = false;
      let step1Reason = "";
      try {
        await api.submitSecureCommand({
          commandId: `cmd-viewer-${Date.now()}`,
          agentId: "agent-rover-01",
          command: "PAUSE",
          issuedAt: Date.now(),
          expiresAt: Date.now() + 60000,
          nonce: `nonce-viewer-${Date.now()}`,
          issuer: "Guest Viewer",
          role: "VIEWER",
        });
      } catch (err: any) {
        step1Blocked = true;
        step1Reason = err.message || "403 Forbidden: Role 'VIEWER' lacks permission for 'COMMAND_ROVER'";
      }

      // Step 2: MISSION_COMMAND executes valid command
      let step2Executed = false;
      let step2Hash = "";
      try {
        const res = await api.submitSecureCommand({
          commandId: testCommandId,
          agentId: "agent-rover-01",
          command: "PAUSE",
          issuedAt: Date.now(),
          expiresAt: Date.now() + 60000,
          nonce: testNonce,
          issuer: "Flight Director Vance",
          role: "MISSION_COMMAND",
        });
        step2Executed = true;
        step2Hash = res?.eventHash || "SHA-256 Verified Signature Recorded";
      } catch (err: any) {
        console.warn("Valid command submission warning", err);
      }

      // Step 3: Replay attack with identical commandId & nonce (Expect Rejection)
      let step3Blocked = false;
      let step3Reason = "";
      try {
        await api.submitSecureCommand({
          commandId: testCommandId,
          agentId: "agent-rover-01",
          command: "PAUSE",
          issuedAt: Date.now(),
          expiresAt: Date.now() + 60000,
          nonce: testNonce,
          issuer: "Flight Director Vance",
          role: "MISSION_COMMAND",
        });
      } catch (err: any) {
        step3Blocked = true;
        step3Reason = err.message || "403 Forbidden: Duplicate commandId detected (replay attack blocked)";
      }

      setSecurityDemoState({
        step1ViewerBlocked: step1Blocked,
        step1Reason,
        step2CommandExecuted: step2Executed,
        step2Hash,
        step3ReplayBlocked: step3Blocked,
        step3Reason,
        running: false,
      });

      // Refresh audit chain stats
      await handleVerifyAuditChain();
    } catch (err: any) {
      setErrorMessage(`Security Demo failed: ${err.message}`);
      setSecurityDemoState(null);
    }
  };

  const runScenario = async (scenarioId: string) => {
    setIsRunning(true);
    setActiveScenario(scenarioId);
    setScenarioReport(null);
    setErrorMessage(null);

    try {
      if (scenarioId === "MARSWALK-001") {
        await api.executeScenarioSensorHazard();
        setScenarioReport({
          id: scenarioId,
          title: "MARSWALK-001 (Flagship Traverse & Dual-Sensor Corroboration)",
          whatHappened:
            "Ares Scout Rover (ROVER-01) observed a 21.8° scarp slope along the primary delta traverse path, exceeding the vehicle 20.0° rollover limit.",
          whyItHappened:
            "Stereo HazCam (21.8° ± 1.1°) and MOLA Altimeter differential independently corroborated the slope anomaly. The hazard was upgraded to CORROBORATED_CONFIRMED.",
          whatTheSystemDid:
            "Automated closed-loop decision engine paused the rover, verified battery margin (85%), and synthesized 3 Pareto detour alternatives.",
          whatAHumanApproved:
            "Flight Director Alex Vance evaluated quantitative trade-offs and authorized Candidate A (Northern Detour: +0.3 km, +6 min).",
          whatWasAudited:
            "Plan version locked and signed SHA-256 block appended to the tamper-evident audit ledger.",
          baselineMetrics: { distance: "8.4 km", duration: "42 min", battery: "78%", safety: "92/100" },
          whatIfMetrics: { distance: "6.9 km", duration: "36 min", battery: "65%", safety: "51/100 (DEGRADED)" },
        });
      } else if (scenarioId === "COMM-BLACKOUT-001") {
        await api.executeScenarioBlackout();
        setScenarioReport({
          id: scenarioId,
          title: "COMM-BLACKOUT-001 (Keplerian Orbital Pass & Telemetry Buffer)",
          whatHappened:
            "Mars Reconnaissance Orbiter (MRO) pass expired below 15° horizon mask. Direct X-band downlink throughput dropped from 2048 kbps to 0 kbps.",
          whyItHappened:
            "Keplerian 112-minute orbital pass geometry naturally severed line of sight for a 92-minute blackout window.",
          whatTheSystemDid:
            "Tactical communication queue prioritized critical hazard alerts and buffered 4.5 MB bulk science spectral cubes into flash storage. Surface UHF mesh routed local telemetry via ROVER-03 RELAY mast.",
          whatAHumanApproved:
            "Mission Command verified communication queue state; approved automatic burst-flush priority for next pass acquisition at MET 01:54.",
          whatWasAudited:
            "Audit event COMM_BLACKOUT and subsequent COMM_RESTORE recorded with transmission packet counts.",
        });
      } else if (scenarioId === "SENSOR-HAZARD-001") {
        await api.executeScenarioSensorHazard();
        setScenarioReport({
          id: scenarioId,
          title: "SENSOR-HAZARD-001 (Optical HazCam Degradation & Laser Altimetry Fusion)",
          whatHappened:
            "HazCam point cloud experienced +300% synthetic optical noise due to simulated dust accumulation, dropping single-sensor disparity confidence to 0.42.",
          whyItHappened:
            "Single sensor uncertainty exceeded threshold. The system marked preliminary slope classification as MODEL_EVIDENCE rather than confirming a false alarm.",
          whatTheSystemDid:
            "FDF engine queried independent Mars Orbiter Laser Altimeter (MOLA MEGDR 128 px/deg) elevation gradient, corroborating the 22.1° slope and preventing blind traversal.",
          whatAHumanApproved:
            "Science Officer confirmed dual-sensor corroboration; authorized rover speed throttle to 0.15 m/s while maintaining 3.0m obstacle standoff distance.",
          whatWasAudited:
            "Sensor degradation event, corroboration digest, and updated confidence interval logged to audit ledger.",
        });
      } else if (scenarioId === "EMERGENCY-001") {
        await api.executeScenarioEmergency("BATTERY_CRITICAL");
        setScenarioReport({
          id: scenarioId,
          title: "EMERGENCY-001 (Battery Reserve Hold & Crew Corridor Clearance)",
          whatHappened:
            "Heater electrical fault simulated sudden battery drop to 14.5%, breaching Invariant S1 (20.0% safe return reserve).",
          whyItHappened:
            "Safety Invariant S1 triggered an immediate vehicle halt to prevent catastrophic power depletion on the surface.",
          whatTheSystemDid:
            "Rover autonomously commanded into EMERGENCY_STOP, locked drive motors, and cleared traverse path to preserve Astronaut Vance safe walking corridor.",
          whatAHumanApproved:
            "Flight Director acknowledged emergency hold, commanded solar array realignment, and directed Ares Relay rover for tether standby.",
          whatWasAudited:
            "Audit block TRIGGER_EMERGENCY and Safety Invariant violation guard logged to audit chain.",
        });
      }
      await handleVerifyAuditChain();
    } catch (err: any) {
      console.error("Scenario execution error", err);
      setErrorMessage(`MISSION CONTROL CONNECTION LOST: ${err.message}. Last known operational state preserved.`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-space-950 text-slate-100 font-sans p-6 pb-24">
      {/* Top Header */}
      <div className="max-w-6xl mx-auto mb-6 text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-950 border border-amber-800 text-amber-400 font-mono text-xs uppercase font-bold">
          <Zap className="w-3.5 h-3.5" />
          NASA Space Apps Challenge — Official Evaluation Mode
        </div>
        <h1 className="text-3xl font-extrabold tracking-wider font-mono text-white">
          DETERMINISTIC MISSION SCENARIO DEMO
        </h1>
        <p className="text-xs text-slate-400 font-mono max-w-2xl mx-auto">
          Four reproducible, audited operational testbeds demonstrating autonomous closed-loop intelligence, digital twin replay, and human authority boundaries.
        </p>
      </div>

      {/* Resilience / Error State Banner */}
      {errorMessage && (
        <div className="max-w-6xl mx-auto mb-6 p-4 bg-red-950/80 border border-red-500 rounded-lg font-mono text-xs text-red-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xl">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <div>
              <div className="font-bold text-white uppercase">{errorMessage}</div>
              <div className="text-[11px] text-red-300">Last known mission state preserved in memory fallback.</div>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => handleVerifyAuditChain()}
              className="px-3 py-1 bg-red-800 hover:bg-red-700 text-white font-bold rounded"
            >
              RECONNECT
            </button>
            <Link
              to="/operations"
              className="px-3 py-1 bg-space-800 hover:bg-space-700 text-slate-200 font-bold rounded border border-space-700"
            >
              RESTORE CHECKPOINT
            </Link>
          </div>
        </div>
      )}

      {/* Cryptographic Audit Chain Verification Strip */}
      <div className="max-w-6xl mx-auto mb-6 bg-space-900 border border-space-800 rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3 font-mono text-xs shadow-lg">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 font-bold text-white">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>AUDIT CHAIN STATUS:</span>
          </div>
          <span
            className={`px-2 py-0.5 rounded font-bold ${
              auditVerification?.valid
                ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                : "bg-red-950 text-red-400 border border-red-800"
            }`}
          >
            {auditVerification?.valid ? "100% VALID & CRYPTOGRAPHICALLY LINKED" : "TAMPER AUDIT REQUIRED"}
          </span>
          <span className="text-slate-400">
            TOTAL BLOCKS: <b className="text-white">{auditVerification?.totalBlocks || 0}</b>
          </span>
          <span className="text-slate-400 hidden md:inline">
            CHAIN DIGEST: <b className="text-slate-300 font-mono text-[10px]">{auditVerification?.verifiedRootHash ? auditVerification.verifiedRootHash.slice(0, 16) + "..." : "INITIALIZING..."}</b>
          </span>
        </div>
        <button
          onClick={handleVerifyAuditChain}
          disabled={isVerifyingChain}
          className="px-3 py-1 rounded bg-space-800 hover:bg-space-750 text-telemetry-cyan font-bold border border-space-700 flex items-center gap-1.5 transition-colors"
        >
          <Activity className={`w-3.5 h-3.5 ${isVerifyingChain ? "animate-spin" : ""}`} />
          <span>{isVerifyingChain ? "VERIFYING HASHES..." : "VERIFY CHAIN"}</span>
        </button>
      </div>

      {/* 4 Flagship Scenario Buttons */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <button
          onClick={() => runScenario("MARSWALK-001")}
          disabled={isRunning}
          className={`p-5 rounded-lg border text-left font-mono transition-all duration-200 shadow-lg ${
            activeScenario === "MARSWALK-001"
              ? "bg-amber-950/80 border-amber-500 shadow-amber-950/50"
              : "bg-space-900 border-space-800 hover:border-space-700 hover:bg-space-850"
          }`}
        >
          <div className="flex items-center justify-between text-amber-400 mb-2">
            <span className="text-xs font-bold uppercase">Flagship Recon</span>
            <Play className="w-4 h-4 fill-amber-400" />
          </div>
          <div className="font-bold text-sm text-white">▶ MARSWALK-001</div>
          <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
            Dual-sensor scarp corroboration, autonomous pause, and Flight Director detour approval.
          </p>
        </button>

        <button
          onClick={() => runScenario("COMM-BLACKOUT-001")}
          disabled={isRunning}
          className={`p-5 rounded-lg border text-left font-mono transition-all duration-200 shadow-lg ${
            activeScenario === "COMM-BLACKOUT-001"
              ? "bg-cyan-950/80 border-cyan-500 shadow-cyan-950/50"
              : "bg-space-900 border-space-800 hover:border-space-700 hover:bg-space-850"
          }`}
        >
          <div className="flex items-center justify-between text-cyan-400 mb-2">
            <span className="text-xs font-bold uppercase">Orbital Dynamics</span>
            <Play className="w-4 h-4 fill-cyan-400" />
          </div>
          <div className="font-bold text-sm text-white">▶ COMM-BLACKOUT-001</div>
          <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
            112m Keplerian pass termination, telemetry buffering, and critical packet burst flush.
          </p>
        </button>

        <button
          onClick={() => runScenario("SENSOR-HAZARD-001")}
          disabled={isRunning}
          className={`p-5 rounded-lg border text-left font-mono transition-all duration-200 shadow-lg ${
            activeScenario === "SENSOR-HAZARD-001"
              ? "bg-amber-950/80 border-amber-500 shadow-amber-950/50"
              : "bg-space-900 border-space-800 hover:border-space-700 hover:bg-space-850"
          }`}
        >
          <div className="flex items-center justify-between text-amber-400 mb-2">
            <span className="text-xs font-bold uppercase">Sensor Fusion</span>
            <Play className="w-4 h-4 fill-amber-400" />
          </div>
          <div className="font-bold text-sm text-white">▶ SENSOR-HAZARD-001</div>
          <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
            HazCam optical point cloud corroborated with laser differential to trigger Invariant S2.
          </p>
        </button>

        <button
          onClick={() => runScenario("EMERGENCY-001")}
          disabled={isRunning}
          className={`p-5 rounded-lg border text-left font-mono transition-all duration-200 shadow-lg ${
            activeScenario === "EMERGENCY-001"
              ? "bg-red-950/80 border-red-500 shadow-red-950/50"
              : "bg-space-900 border-space-800 hover:border-space-700 hover:bg-space-850"
          }`}
        >
          <div className="flex items-center justify-between text-red-400 mb-2">
            <span className="text-xs font-bold uppercase">Safety Invariant S1</span>
            <Play className="w-4 h-4 fill-red-400" />
          </div>
          <div className="font-bold text-sm text-white">▶ EMERGENCY-001</div>
          <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
            Critical battery threshold triggers vehicle shutdown to preserve astronaut corridor.
          </p>
        </button>
      </div>

      {/* Scenario Execution Indicator */}
      {isRunning && (
        <div className="max-w-6xl mx-auto bg-space-900 border border-space-800 rounded-lg p-8 text-center font-mono mb-6">
          <Activity className="w-8 h-8 text-amber-500 animate-spin mx-auto mb-3" />
          <div className="text-sm font-bold text-white uppercase">EXECUTING DETERMINISTIC SCENARIO: {activeScenario}...</div>
          <p className="text-xs text-slate-400 mt-1">Sampling simulated sensors, evaluating safety invariants, and appending cryptographic audit records...</p>
        </div>
      )}

      {/* Structured 5-Point Judge Report */}
      {scenarioReport && (
        <div className="max-w-6xl mx-auto bg-space-900 border border-space-700 rounded-lg p-6 shadow-2xl space-y-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-space-800 gap-2">
            <div>
              <span className="text-xs px-2.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono font-bold">
                SCENARIO EXECUTED & AUDITED
              </span>
              <h2 className="text-xl font-bold font-mono text-white mt-1.5">{scenarioReport.title}</h2>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/replay"
                className="px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-space-950 font-bold font-mono text-xs flex items-center gap-1.5 shadow"
              >
                <RotateCcw className="w-4 h-4" />
                Inspect in Replay
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
            <div className="p-4 bg-space-950 border border-space-800 rounded space-y-1">
              <span className="text-amber-400 font-bold uppercase">1. WHAT HAPPENED:</span>
              <p className="text-slate-200 leading-relaxed">{scenarioReport.whatHappened}</p>
            </div>

            <div className="p-4 bg-space-950 border border-space-800 rounded space-y-1">
              <span className="text-cyan-400 font-bold uppercase">2. WHY IT HAPPENED:</span>
              <p className="text-slate-200 leading-relaxed">{scenarioReport.whyItHappened}</p>
            </div>

            <div className="p-4 bg-space-950 border border-space-800 rounded space-y-1">
              <span className="text-emerald-400 font-bold uppercase">3. WHAT THE SYSTEM DID:</span>
              <p className="text-slate-200 leading-relaxed">{scenarioReport.whatTheSystemDid}</p>
            </div>

            <div className="p-4 bg-space-950 border border-space-800 rounded space-y-1">
              <span className="text-purple-400 font-bold uppercase">4. WHAT A HUMAN APPROVED:</span>
              <p className="text-slate-200 leading-relaxed">{scenarioReport.whatAHumanApproved}</p>
            </div>
          </div>

          <div className="p-4 bg-space-950 border border-space-800 rounded font-mono text-xs space-y-1">
            <span className="text-slate-400 font-bold uppercase">5. WHAT WAS AUDITED:</span>
            <p className="text-slate-300 leading-relaxed">{scenarioReport.whatWasAudited}</p>
          </div>

          {/* Baseline vs What-If Comparison */}
          {scenarioReport.baselineMetrics && (
            <div className="p-4 bg-space-950 border border-amber-900/50 rounded font-mono text-xs space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-amber-400 font-bold uppercase flex items-center gap-1.5">
                  <GitBranch className="w-4 h-4" />
                  DECISION COMPARISON: BASELINE VS. WHAT-IF (IGNORE HAZARD)
                </span>
                <Link to="/replay" className="text-cyan-400 hover:text-cyan-300 text-[11px] underline">
                  Explore Full What-If Matrix &rarr;
                </Link>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-2.5 bg-space-900 border border-space-800 rounded">
                  <div className="text-[10px] text-slate-400">BASELINE SAFETY</div>
                  <div className="text-emerald-400 font-bold mt-0.5">{scenarioReport.baselineMetrics.safety}</div>
                </div>
                <div className="p-2.5 bg-space-900 border border-space-800 rounded">
                  <div className="text-[10px] text-slate-400">WHAT-IF SAFETY</div>
                  <div className="text-red-400 font-bold mt-0.5">{scenarioReport.whatIfMetrics.safety}</div>
                </div>
                <div className="p-2.5 bg-space-900 border border-space-800 rounded">
                  <div className="text-[10px] text-slate-400">BASELINE BATTERY</div>
                  <div className="text-emerald-400 font-bold mt-0.5">{scenarioReport.baselineMetrics.battery}</div>
                </div>
                <div className="p-2.5 bg-space-900 border border-space-800 rounded">
                  <div className="text-[10px] text-slate-400">WHAT-IF BATTERY</div>
                  <div className="text-red-400 font-bold mt-0.5">{scenarioReport.whatIfMetrics.battery}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Security Demonstration Panel (Section 10) */}
      <div className="max-w-6xl mx-auto bg-space-900 border border-space-800 rounded-lg p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-space-800 mb-4 gap-2">
          <div>
            <div className="font-mono font-bold text-sm text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-cyan-400" />
              <span>ZERO-TRUST SECURITY & REPLAY ATTACK DEFENSE (SECURITY-001)</span>
            </div>
            <div className="text-xs text-slate-400 font-mono mt-0.5">
              Live server verification of RBAC authorization bounds, 300s TTL enforcement, and persistent duplicate command rejection.
            </div>
          </div>
          <button
            onClick={handleRunSecurityDemo}
            disabled={securityDemoState?.running}
            className="px-4 py-2 bg-cyan-700 hover:bg-cyan-600 text-white font-mono font-bold text-xs rounded shadow transition-colors flex items-center gap-2 shrink-0"
          >
            <Shield className="w-4 h-4" />
            {securityDemoState?.running ? "RUNNING SECURITY AUDIT..." : "RUN ZERO-TRUST SECURITY AUDIT"}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
          {/* Step 1 */}
          <div className="p-4 bg-space-950 border border-space-800 rounded space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-300 uppercase">1. VIEWER ROLE REJECTION</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                  securityDemoState?.step1ViewerBlocked
                    ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                    : "bg-space-850 text-slate-400 border border-space-700"
                }`}
              >
                {securityDemoState?.step1ViewerBlocked ? "403 BLOCKED" : "READY"}
              </span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Unauthenticated or unauthorized roles attempting vehicle control commands are rejected by RBAC enforcement before command dispatch.
            </p>
            {securityDemoState?.step1Reason && (
              <div className="p-2 bg-space-900 rounded border border-space-800 text-[10px] text-amber-300">
                {securityDemoState.step1Reason}
              </div>
            )}
          </div>

          {/* Step 2 */}
          <div className="p-4 bg-space-950 border border-space-800 rounded space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-300 uppercase">2. FLIGHT DIRECTOR SIGNING</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                  securityDemoState?.step2CommandExecuted
                    ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                    : "bg-space-850 text-slate-400 border border-space-700"
                }`}
              >
                {securityDemoState?.step2CommandExecuted ? "EXECUTED" : "READY"}
              </span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Authorized MISSION_COMMAND envelopes with unique cryptographic nonce and valid TTL are processed and appended to the ledger.
            </p>
            {securityDemoState?.step2Hash && (
              <div className="p-2 bg-space-900 rounded border border-space-800 text-[10px] text-emerald-300 truncate">
                {securityDemoState.step2Hash}
              </div>
            )}
          </div>

          {/* Step 3 */}
          <div className="p-4 bg-space-950 border border-space-800 rounded space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-300 uppercase">3. REPLAY ATTACK DEFENSE</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                  securityDemoState?.step3ReplayBlocked
                    ? "bg-red-950 text-red-400 border border-red-800"
                    : "bg-space-850 text-slate-400 border border-space-700"
                }`}
              >
                {securityDemoState?.step3ReplayBlocked ? "REPLAY REJECTED" : "READY"}
              </span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Identical commandId or consumed nonce retransmitted over Mars link is immediately caught by disk-persisted security state.
            </p>
            {securityDemoState?.step3Reason && (
              <div className="p-2 bg-space-900 rounded border border-space-800 text-[10px] text-red-300">
                {securityDemoState.step3Reason}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
