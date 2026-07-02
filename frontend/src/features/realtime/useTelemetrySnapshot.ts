import { useEffect, useMemo, useState } from "react";

const DEFAULT_API_URL = "http://localhost:8000";
const DEFAULT_POLL_INTERVAL_MS = 500;

export type TelemetryDeviceSnapshot = {
  deviceId: string;
  isPedestrian: boolean;
  lat: number;
  lon: number;
  speed: number;
  azimuth: number | null;
  lastUpdated: number;
};

type ActiveDevicesApiResponse = {
  devices: Array<{
    device_id: string;
    is_pedestrian: boolean;
    lat: number;
    lon: number;
    speed: number;
    azimuth: number | null;
    last_updated: number;
  }>;
};

function getApiUrl(): string {
  const apiUrl = import.meta.env.VITE_API_URL ?? DEFAULT_API_URL;
  return apiUrl.replace(/\/$/, "");
}

type UseTelemetrySnapshotOptions = {
  pollIntervalMs?: number;
};

export function useTelemetrySnapshot(options: UseTelemetrySnapshotOptions = {}) {
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const [devices, setDevices] = useState<TelemetryDeviceSnapshot[]>([]);

  useEffect(() => {
    let cancelled = false;
    let intervalId: number | null = null;

    async function refresh() {
      try {
        const response = await fetch(`${getApiUrl()}/api/active-devices`);
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as ActiveDevicesApiResponse;
        if (cancelled) {
          return;
        }

        setDevices(
          payload.devices.map((device) => ({
            deviceId: device.device_id,
            isPedestrian: device.is_pedestrian,
            lat: device.lat,
            lon: device.lon,
            speed: device.speed,
            azimuth: device.azimuth,
            lastUpdated: device.last_updated,
          })),
        );
      } catch {
        // Ignore transient polling errors; UI remains on last known state.
      }
    }

    void refresh();
    intervalId = window.setInterval(() => {
      void refresh();
    }, pollIntervalMs);

    return () => {
      cancelled = true;
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, [pollIntervalMs]);

  return useMemo(() => ({ devices }), [devices]);
}
