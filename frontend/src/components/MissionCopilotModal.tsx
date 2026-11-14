import React, { useState } from "react";
import { api } from "../services/api.js";
import {
  Sparkles,
  Send,
  X,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  ShieldAlert,
  Database,
  Info,
} from "lucide-react";

interface MissionCopilotModalProps {
  isOpen: boolean;
  onClose: () => void;
  missionId?: string;
  initialQuery?: string;
  onActionExecuted?: () => void;
}

const QUICK_QUERIES = [
  "Why was this route selected over alternatives?",
  "Which routes were rejected and why?",
  "Summarize safety invariants and resource feasibility",
  "What are the science yield vs risk trade-offs?",
  "Switch route to safest compliant alternative",
  "Assign reconnaissance task to ROVER-01",
  "Execute isolated scenario simulation",
];

export const MissionCopilotModal: React.FC<MissionCopilotModalProps> = ({
  isOpen,
  onClose,
  missionId,
  initialQuery,
  onActionExecuted,
}) => {
  const [query, setQuery] = useState<string>(initialQuery || QUICK_QUERIES[0]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const [response, setResponse] = useState<any>(null);
  const [actionResult, setActionResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSendQuery = async (queryText?: string) => {
    const textToSend = queryText || query;
    if (!textToSend.trim()) return;

    setIsLoading(true);
    setError(null);
    setActionResult(null);
    try {
      const res = await api.queryStructuredCopilot(textToSend, missionId);
      setResponse(res);
    } catch (err: any) {
      setError(err.message || "Failed to reach Mission Copilot service.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!response?.proposedAction) return;
    setIsConfirming(true);
    setError(null);
    try {
      const res = await api.confirmCopilotAction({
        missionId: response.proposedAction.targetMissionId,
        actionType: response.proposedAction.actionType,
        payload: response.proposedAction.payload,
        confirmed: true,
        userRole: "MISSION_COMMAND",
      });
      setActionResult(`Confirmed & executed ${res.actionType} on ${response.proposedAction.targetMissionId}.`);
      if (onActionExecuted) onActionExecuted();
    } catch (err: any) {
      setError(err.message || "Action confirmation failed.");
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-atlas-surface border border-atlas-border w-full max-w-4xl max-h-[85vh] rounded-lg shadow-2xl flex flex-col overflow-hidden font-sans">
        {/* Header */}
        <div className="p-4 border-b border-atlas-border flex items-center justify-between bg-atlas-elevated/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-atlas-accent/20 border border-atlas-accent/40 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-atlas-accent" />
            </div>
            <div>
              <h3 className="font-bold font-display text-atlas-text text-base flex items-center gap-2">
                Explainable Mission Copilot
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-atlas-elevated text-atlas-teal border border-atlas-border">
                  Deterministic Rule Engine (Non-LLM)
                </span>
              </h3>
              <p className="text-xs text-atlas-muted font-mono">
                Grounded in Persisted State, Safety Invariants & Confirmation-Gated Actions
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 hover:bg-atlas-elevated text-atlas-muted hover:text-atlas-text rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
          {/* Quick Queries */}
          <div>
            <label className="text-[11px] font-mono text-atlas-muted uppercase tracking-wider block mb-2">
              Structured Mission Inquiries & Confirmation-Gated Proposals
            </label>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_QUERIES.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setQuery(q);
                    handleSendQuery(q);
                  }}
                  className="px-2.5 py-1 rounded bg-atlas-elevated hover:bg-atlas-accent/20 border border-atlas-border text-xs font-mono text-atlas-text transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Input Bar */}
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendQuery()}
              placeholder="Ask why a route was selected/rejected, trade-offs, safety reserves, or propose an action..."
              className="flex-1 bg-atlas-elevated border border-atlas-border rounded px-3 py-2 text-xs font-mono text-atlas-text focus:outline-none focus:border-atlas-accent"
            />
            <button
              onClick={() => handleSendQuery()}
              disabled={isLoading}
              className="px-4 py-2 rounded bg-atlas-accent hover:bg-atlas-accent/90 text-white text-xs font-mono font-bold flex items-center gap-1.5"
            >
              {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>Ask</span>
            </button>
          </div>

          {error && (
            <div className="p-3 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-mono flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {actionResult && (
            <div className="p-3 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{actionResult}</span>
            </div>
          )}

          {/* Structured Response */}
          {response && (
            <div className="space-y-4 border-t border-atlas-border pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-atlas-elevated border border-atlas-border text-atlas-accent">
                  Intent: {response.intent} · Mission: {response.missionId}
                </span>
                <span className="text-[11px] font-mono text-atlas-muted">
                  Provenance: {response.provenanceType}
                </span>
              </div>

              <div className="p-4 rounded bg-atlas-elevated/40 border border-atlas-border text-sm text-atlas-text leading-relaxed">
                {response.answer}
              </div>

              {/* Proposed Action Confirmation Gate */}
              {response.proposedAction && (
                <div className="p-4 rounded bg-amber-500/10 border border-amber-500/40 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-mono font-bold text-amber-300">
                    <ShieldAlert className="w-4 h-4" />
                    <span>CONSEQUENTIAL ACTION — EXPLICIT USER CONFIRMATION REQUIRED</span>
                  </div>
                  <p className="text-xs font-mono text-atlas-text">{response.proposedAction.description}</p>
                  {response.proposedAction.blockedByApproval && (
                    <p className="text-xs font-mono text-red-400">
                      Warning: Target mission is APPROVED/LOCKED; direct mutation will be blocked unless cloned as a draft.
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleConfirmAction}
                      disabled={isConfirming}
                      className="px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-600 text-black text-xs font-mono font-bold"
                    >
                      {isConfirming ? "Executing..." : "Confirm & Execute Action"}
                    </button>
                    <button
                      onClick={() => setResponse({ ...response, proposedAction: undefined })}
                      className="px-3 py-1.5 rounded bg-atlas-elevated border border-atlas-border text-xs font-mono text-atlas-muted hover:text-atlas-text"
                    >
                      Dismiss Proposal
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 rounded bg-atlas-elevated/30 border border-atlas-border space-y-1.5">
                  <div className="text-[11px] font-mono font-bold text-atlas-text flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-atlas-teal" /> Cited Evidence
                  </div>
                  <ul className="list-disc pl-4 space-y-1 text-xs font-mono text-atlas-muted">
                    {response.evidence?.map((item: string, idx: number) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-3 rounded bg-atlas-elevated/30 border border-atlas-border space-y-1.5">
                  <div className="text-[11px] font-mono font-bold text-atlas-text flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-atlas-accent" /> Sources, Assumptions & Disclosures
                  </div>
                  <div className="text-[11px] font-mono text-atlas-teal">
                    Sources: {(response.sources || []).join(", ")}
                  </div>
                  <ul className="list-disc pl-4 space-y-1 text-[11px] font-mono text-atlas-muted">
                    {[...(response.assumptions || []), ...(response.serviceDisclosures || [])].map(
                      (item: string, idx: number) => (
                        <li key={idx}>{item}</li>
                      )
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
