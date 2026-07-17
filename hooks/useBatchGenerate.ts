"use client";

import { useState, useCallback } from "react";
import type {
  GenerateRequest,
  JdAnalysis,
  ValidatorIssue,
  ValidatorResult,
  ValidatorVerdict,
  DocumentType,
} from "@/lib/types";
import type { GenerateStatus } from "./useGenerate";

// The 3 doc types generated in a batch
const BATCH_DOC_TYPES: DocumentType[] = ["bullets", "cover_letter", "linkedin_about"];

export interface BatchDocResult {
  docType: DocumentType;
  output: string;
  scores: ValidatorResult["scores"];
  overall: number;
  verdict: ValidatorVerdict;
  validationUnavailable: boolean;
  issues: ValidatorIssue[];
  generationId: string | null;
  keywords: string[];
}

export interface BatchState {
  docType: DocumentType;
  status: GenerateStatus;
  streamText: string;
  result: BatchDocResult | null;
}

function makeInitialState(docType: DocumentType): BatchState {
  return { docType, status: "idle", streamText: "", result: null };
}

export function useBatchGenerate() {
  const [states, setStates] = useState<BatchState[]>(
    BATCH_DOC_TYPES.map(makeInitialState)
  );
  const [jdAnalysis, setJdAnalysis] = useState<JdAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [running, setRunning] = useState(false);

  const updateState = useCallback((docType: DocumentType, patch: Partial<BatchState>) => {
    setStates((prev) =>
      prev.map((s) => (s.docType === docType ? { ...s, ...patch } : s))
    );
  }, []);

  const generateOne = useCallback(
    async (
      request: GenerateRequest,
      docType: DocumentType,
      cachedJdAnalysis: JdAnalysis | null,
      onAbort?: () => void
    ): Promise<JdAnalysis | null> => {
      updateState(docType, { status: "parsing", streamText: "", result: null });

      const payload: GenerateRequest = {
        ...request,
        document_type: docType,
        // Pass cached JD analysis after first doc to avoid re-parsing
        jd_analysis: cachedJdAnalysis ?? undefined,
        // LinkedIn About doesn't need a JD
        jd_text: docType === "linkedin_about" ? undefined : request.jd_text,
      };

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Request failed" }));
        if (response.status === 429 && err.error === "monthly_limit_reached") {
          setLimitReached(true);
          onAbort?.();
          updateState(docType, { status: "error" });
          return null;
        }
        if (response.status === 401) {
          setSessionExpired(true);
          onAbort?.();
          updateState(docType, { status: "error" });
          return null;
        }
        updateState(docType, { status: "error" });
        setError(err.error ?? "Something went wrong");
        return null;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        updateState(docType, { status: "error" });
        return null;
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let returnedJdAnalysis: JdAnalysis | null = cachedJdAnalysis;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (!data) continue;

          try {
            const event = JSON.parse(data);
            switch (event.type) {
              case "jd_analysis":
                returnedJdAnalysis = event.data;
                if (!cachedJdAnalysis) setJdAnalysis(event.data);
                updateState(docType, { status: "generating" });
                break;
              case "text":
                setStates((prev) =>
                  prev.map((s) =>
                    s.docType === docType
                      ? { ...s, streamText: s.streamText + event.content }
                      : s
                  )
                );
                break;
              case "retry":
                updateState(docType, { status: "validating", streamText: "" });
                break;
              case "done":
                updateState(docType, {
                  status: "done",
                  result: {
                    docType,
                    output: event.output,
                    scores: event.scores,
                    overall: event.overall,
                    verdict: event.verdict,
                    validationUnavailable: event.validation_unavailable ?? false,
                    issues: event.issues ?? [],
                    generationId: event.generation_id ?? null,
                    keywords: event.keywords ?? [],
                  },
                });
                break;
              case "error":
                setError(event.message);
                updateState(docType, { status: "error" });
                break;
            }
          } catch {
            // malformed event — skip
          }
        }
      }

      return returnedJdAnalysis;
    },
    [updateState]
  );

  const generateBatch = useCallback(
    async (request: GenerateRequest) => {
      setRunning(true);
      setError(null);
      setLimitReached(false);
      setSessionExpired(false);
      setJdAnalysis(null);
      setStates(BATCH_DOC_TYPES.map(makeInitialState));

      // Local mutable flag — avoids stale-closure issue with React state reads mid-loop
      let aborted = false;
      let cachedJdAnalysis: JdAnalysis | null = null;

      for (const docType of BATCH_DOC_TYPES) {
        if (aborted) break;
        const result = await generateOne(request, docType, cachedJdAnalysis, () => {
          aborted = true;
        });
        // Cache JD analysis from first successful generation
        if (result && !cachedJdAnalysis) {
          cachedJdAnalysis = result;
        }
      }

      setRunning(false);
    },
    [generateOne]
  );

  const reset = useCallback(() => {
    setStates(BATCH_DOC_TYPES.map(makeInitialState));
    setJdAnalysis(null);
    setError(null);
    setLimitReached(false);
    setSessionExpired(false);
    setRunning(false);
  }, []);

  return {
    generateBatch,
    reset,
    states,
    jdAnalysis,
    error,
    limitReached,
    sessionExpired,
    running,
    batchDocTypes: BATCH_DOC_TYPES,
  };
}
