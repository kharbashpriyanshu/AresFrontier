import React, { useState, useEffect } from "react";
import { api } from "../services/api.js";
import {
  Sparkles,
  CheckCircle,
  Circle,
  Clock,
  Wrench,
  Bot,
  User,
  ShieldCheck,
  X,
  AlertTriangle,
} from "lucide-react";

interface SamplingProtocolPanelProps {
  targetId?: string;
  targetName?: string;
  targetType?: string;
  formation?: string;
  onClose: () => void;
}

export const SamplingProtocolPanel: React.FC<SamplingProtocolPanelProps> = ({
  targetId = "tgt-kodiak-delta",
  targetName = "Kodiak Butte Delta Front",
  targetType = "LACUSTRINE_FAN",
  formation = "Shenandoah (Ns)",
  onClose,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [protocol, setProtocol] = useState<any>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    api
      .getObservationPlan(targetId, targetType, formation)
      .then((res) => {
        if (isMounted) {
          setProtocol(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || "Failed to load observation plan");
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [targetId, targetType, formation]);

  const toggleStep = (stepNumber: number) => {
    setCompletedSteps((prev) => {
      const updated = new Set(prev);
      if (updated.has(stepNumber)) {
        updated.delete(stepNumber);
      } else {
        updated.add(stepNumber);
      }
      return updated;
    });
  };

  const stepsCount = protocol?.samplingChecklist?.length || 8;
  const progressPct = Math.round((completedSteps.size / stepsCount) * 100);

  return (
    <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 w-[480px] max-w-[calc(100vw-2rem)] bg-atlas-surface/95 border border-atlas-border backdrop-blur-md shadow-2xl p-4 font-mono text-xs text-atlas-text flex flex-col space-y-3 pointer-events-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-atlas-border pb-2">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-atlas-accent" />
          <span className="font-bold uppercase tracking-wider text-sm truncate max-w-[320px]">
            {targetName} - Sampling Protocol
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-atlas-elevated text-atlas-muted hover:text-atlas-text transition-colors"
          title="Close sampling protocol panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="py-8 flex flex-col items-center justify-center space-y-2 text-atlas-muted">
          <div className="w-5 h-5 border-2 border-atlas-accent border-t-transparent animate-spin rounded-full" />
          <span className="text-[11px]">Generating NASA In-Situ Caching Protocol...</span>
        </div>
      ) : error ? (
        <div className="py-4 text-atlas-red text-[11px] flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : protocol ? (
        <div className="space-y-3 overflow-y-auto max-h-[70vh] pr-1">
          {/* Scientific Objective & MEPAG Banner */}
          <div className="bg-atlas-bg/60 border border-atlas-border/60 p-2.5">
            <div className="flex items-center justify-between text-atlas-muted mb-1 text-[11px]">
              <span className="font-semibold text-atlas-text">Primary Science Rationale</span>
              <span className="text-[10px] text-cyan-300 bg-cyan-950/40 px-1.5 py-0.5 border border-cyan-800/50">
                MEPAG: {protocol.mepagGoal}
              </span>
            </div>
            <div className="text-xs text-atlas-text leading-relaxed">
              {protocol.scientificRationale}
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-atlas-muted pt-1 border-t border-atlas-border/40">
              <span>Formation: <strong className="text-purple-300">{protocol.formation}</strong></span>
              <span>Target Type: <strong className="text-atlas-text">{protocol.targetType}</strong></span>
            </div>
          </div>

          {/* Progress Header */}
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-atlas-text">
              Standard Sampling Checklist ({completedSteps.size}/{stepsCount})
            </span>
            <span className="text-atlas-teal font-bold">{progressPct}% Complete</span>
          </div>
          <div className="w-full bg-atlas-elevated h-1.5 border border-atlas-border overflow-hidden">
            <div
              className="bg-atlas-teal h-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {/* 8-Step Checklist */}
          <div className="space-y-2">
            {protocol.samplingChecklist.map((step: any) => {
              const isDone = completedSteps.has(step.stepNumber);
              return (
                <div
                  key={step.stepNumber}
                  onClick={() => toggleStep(step.stepNumber)}
                  className={`p-2.5 border cursor-pointer transition-all flex items-start space-x-2.5 ${
                    isDone
                      ? "bg-atlas-elevated/80 border-emerald-700/60 opacity-80"
                      : "bg-atlas-surface hover:bg-atlas-elevated border-atlas-border"
                  }`}
                >
                  <button
                    type="button"
                    className="mt-0.5 shrink-0 text-atlas-accent"
                    title={isDone ? "Mark incomplete" : "Mark complete"}
                  >
                    {isDone ? (
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Circle className="w-4 h-4 text-atlas-muted" />
                    )}
                  </button>

                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span
                        className={`font-bold text-[11px] ${
                          isDone ? "line-through text-atlas-muted" : "text-atlas-text"
                        }`}
                      >
                        Step {step.stepNumber}: {step.operation}
                      </span>
                      <span className="text-[10px] text-atlas-muted flex items-center space-x-1 shrink-0 ml-2">
                        <Clock className="w-3 h-3 text-atlas-accent" />
                        <span>{step.durationMinutes} min</span>
                      </span>
                    </div>

                    <div className="text-[10px] text-atlas-muted mt-0.5 leading-snug">
                      {step.protocol}
                    </div>

                    <div className="mt-1.5 flex items-center justify-between text-[9px] text-atlas-muted pt-1 border-t border-atlas-border/30">
                      <span className="flex items-center space-x-1">
                        <Wrench className="w-3 h-3 text-atlas-teal" />
                        <span>Tool: <strong className="text-atlas-text">{step.tool}</strong></span>
                      </span>
                      <span className="flex items-center space-x-1">
                        {step.operator === "ASTRONAUT_EV1" ? (
                          <User className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Bot className="w-3 h-3 text-cyan-400" />
                        )}
                        <span>{step.operator.replace("_", " ")}</span>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Cache Tube Sealing Verification */}
          <div className="p-2.5 bg-atlas-elevated border border-atlas-border flex items-center justify-between text-[10px]">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-atlas-teal" />
              <div>
                <span className="font-semibold block text-atlas-text">Hermetic Titanium Tube Sealing</span>
                <span className="text-atlas-muted">NASA Planetary Protection Category IVb</span>
              </div>
            </div>
            <span
              className={`px-2 py-1 font-bold border ${
                progressPct === 100
                  ? "bg-emerald-950/60 border-emerald-600 text-emerald-300"
                  : "bg-atlas-surface border-atlas-border text-atlas-muted"
              }`}
            >
              {progressPct === 100 ? "SEALED & LOGGED" : "PENDING ALL STEPS"}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
};
