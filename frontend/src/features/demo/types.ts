export type TelemetryPayload = {
  device_id: string;
  is_pedestrian: boolean;
  lat: number;
  lon: number;
  speed: number;
  azimuth: number;
};

export type TelemetryResponse = {
  status: string;
  processed_at: number;
};

export type ScenarioFrame = {
  label: string;
  description: string;
  distanceMeters: number;
  pedestrian: TelemetryPayload;
  vehicle: TelemetryPayload;
};

export type ScenarioStatus = "idle" | "running" | "completed" | "error";
