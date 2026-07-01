import { useCallback, useEffect, useRef, useState } from "react";

import { scooterApproachScenario } from "@/features/demo/scenarios";
import { sendTelemetryFrame } from "@/features/demo/telemetryApi";
import type { ScenarioFrame, ScenarioStatus } from "@/features/demo/types";

const FRAME_DELAY_MS = 900;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown scenario error";
}

export function useScenarioRunner() {
  const [status, setStatus] = useState<ScenarioStatus>("idle");
  const [lastFrame, setLastFrame] = useState<ScenarioFrame | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const timeoutRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const runScenario = useCallback(() => {
    clearTimer();

    setStatus("running");
    setErrorMessage(null);
    setLastFrame(null);

    async function runFrame(index: number) {
      const frame = scooterApproachScenario[index];

      if (!frame) {
        setStatus("completed");
        return;
      }

      try {
        setLastFrame(frame);
        await sendTelemetryFrame(frame);

        if (index >= scooterApproachScenario.length - 1) {
          setStatus("completed");
          return;
        }

        timeoutRef.current = window.setTimeout(() => {
          void runFrame(index + 1);
        }, FRAME_DELAY_MS);
      } catch (error) {
        clearTimer();
        setStatus("error");
        setErrorMessage(getErrorMessage(error));
      }
    }

    void runFrame(0);
  }, [clearTimer]);

  const resetScenario = useCallback(() => {
    clearTimer();
    setStatus("idle");
    setLastFrame(null);
    setErrorMessage(null);
  }, [clearTimer]);

  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  return {
    status,
    isRunning: status === "running",
    lastFrame,
    errorMessage,
    runScenario,
    resetScenario,
  };
}
