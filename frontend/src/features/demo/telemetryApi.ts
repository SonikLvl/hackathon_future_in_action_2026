import type { ScenarioFrame, TelemetryPayload, TelemetryResponse } from "@/features/demo/types";

const DEFAULT_API_URL = "http://localhost:8000";

function getApiUrl(): string {
  const apiUrl = import.meta.env.VITE_API_URL ?? DEFAULT_API_URL;

  return apiUrl.replace(/\/$/, "");
}

export async function sendTelemetry(payload: TelemetryPayload): Promise<TelemetryResponse> {
  const response = await fetch(`${getApiUrl()}/api/telemetry`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Telemetry request failed with status ${response.status}`);
  }

  return response.json() as Promise<TelemetryResponse>;
}

export async function sendTelemetryFrame(frame: ScenarioFrame) {
  const pedestrianResponse = await sendTelemetry(frame.pedestrian);
  const vehicleResponse = await sendTelemetry(frame.vehicle);

  return {
    pedestrianResponse,
    vehicleResponse,
  };
}
