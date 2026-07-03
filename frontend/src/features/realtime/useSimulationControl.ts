import { useCallback, useEffect, useState } from "react";

const DEFAULT_API_URL = "http://localhost:8000";
const STATUS_POLL_INTERVAL_MS = 1000;

export type Scenario = {
  id: string;
  name: string;
  description: string;
};

export type SimulationStatus = {
  running: boolean;
  scenarioId: string | null;
  phase: string;
  elapsedSeconds: number;
};

const IDLE_STATUS: SimulationStatus = {
  running: false,
  scenarioId: null,
  phase: "idle",
  elapsedSeconds: 0,
};

function getApiUrl(): string {
  const apiUrl = import.meta.env.VITE_API_URL ?? DEFAULT_API_URL;
  return apiUrl.replace(/\/$/, "");
}

export function useSimulationControl() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [status, setStatus] = useState<SimulationStatus>(IDLE_STATUS);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadScenarios() {
      try {
        const response = await fetch(`${getApiUrl()}/api/simulation/scenarios`);
        if (!response.ok || cancelled) {
          return;
        }
        const payload = (await response.json()) as { scenarios: Scenario[] };
        if (!cancelled) {
          setScenarios(payload.scenarios);
        }
      } catch {
        // Backend may not be up yet; the panel simply shows no scenarios.
      }
    }

    async function refreshStatus() {
      try {
        const response = await fetch(`${getApiUrl()}/api/simulation/status`);
        if (!response.ok || cancelled) {
          return;
        }
        const payload = (await response.json()) as SimulationStatus;
        if (!cancelled) {
          setStatus(payload);
        }
      } catch {
        // Ignore transient polling errors; keep last known status.
      }
    }

    void loadScenarios();
    void refreshStatus();
    const intervalId = window.setInterval(() => {
      void refreshStatus();
    }, STATUS_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const start = useCallback(async (scenarioId: string) => {
    setIsBusy(true);
    setError(null);
    try {
      const response = await fetch(`${getApiUrl()}/api/simulation/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId }),
      });
      if (!response.ok) {
        throw new Error(`Start failed (${response.status})`);
      }
      setStatus((await response.json()) as SimulationStatus);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start scenario");
    } finally {
      setIsBusy(false);
    }
  }, []);

  const stop = useCallback(async () => {
    setIsBusy(true);
    setError(null);
    try {
      const response = await fetch(`${getApiUrl()}/api/simulation/stop`, { method: "POST" });
      if (!response.ok) {
        throw new Error(`Stop failed (${response.status})`);
      }
      setStatus((await response.json()) as SimulationStatus);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not stop scenario");
    } finally {
      setIsBusy(false);
    }
  }, []);

  return { scenarios, status, isBusy, error, start, stop };
}
