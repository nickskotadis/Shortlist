"use client";

import { useState, useCallback } from "react";
import type {
  GenerateRequest,
  JdAnalysis,
  ValidatorIssue,
  ValidatorResult,
  ValidatorVerdict,
} from "@/lib/types";

export type GenerateStatus =
  | "idle"
  | "parsing"
  | "generating"
  | "validating"
  | "done"
  | "error";

export interface GenerateResult {
  output: string;
  jdAnalysis: JdAnalysis;
  scores: ValidatorResult["scores"];
  overall: number;
  verdict: ValidatorVerdict;
  retryCount: number;
  issues: ValidatorIssue[];
  generationId: string | null;
  keywords: string[];
}

export function useGenerate() {
  const [status, setStatus] = useState<GenerateStatus>("idle");
  const [streamText, setStreamText] = useState("");
  const [jdAnalysis, setJdAnalysis] = useState<JdAnalysis | null>(null);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  const generate = useCallback(async (request: GenerateRequest) => {
    setStatus("parsing");
    setStreamText("");
    setJdAnalysis(null);
    setResult(null);
    setError(null);
    setLimitReached(false);
    setSessionExpired(false);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Request failed" }));
        if (response.status === 429 && err.error === "monthly_limit_reached") {
          setLimitReached(true);
          setStatus("error");
          return;
        }
        if (response.status === 401) {
          setSessionExpired(true);
          setError("Your session has expired — please log in again.");
          setStatus("error");
          return;
        }
        setError(err.error ?? "Something went wrong");
        setStatus("error");
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        setError("No response stream");
        setStatus("error");
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

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
                setJdAnalysis(event.data);
                setStatus("generating");
                break;
              case "text":
                setStreamText((prev) => prev + event.content);
                break;
              case "retry":
                setStatus("validating");
                setStreamText("");
                break;
              case "done":
                setResult({
                  output: event.output,
                  jdAnalysis: event.jd_analysis,
                  scores: event.scores,
                  overall: event.overall,
                  verdict: event.verdict,
                  retryCount: event.retry_count,
                  issues: event.issues ?? [],
                  generationId: event.generation_id ?? null,
                  keywords: event.keywords ?? [],
                });
                setStatus("done");
                break;
              case "error":
                setError(event.message);
                setStatus("error");
                break;
            }
          } catch {
            // malformed event — skip
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setStreamText("");
    setJdAnalysis(null);
    setResult(null);
    setError(null);
    setLimitReached(false);
    setSessionExpired(false);
  }, []);

  return { generate, reset, status, streamText, jdAnalysis, result, error, limitReached, sessionExpired };
}
