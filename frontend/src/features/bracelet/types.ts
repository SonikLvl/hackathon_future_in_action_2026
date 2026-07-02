export type BraceletConnectionStatus = "connecting" | "connected" | "reconnecting" | "disconnected";

export type AlertSeverity = "safe" | "caution" | "warning" | "critical";

export type AlertDirection = "front" | "back" | "left" | "right" | "unknown";

export type RiskAlertEvent = {
  type: "risk_alert";
  version: 1;
  timestamp: string;
  deviceId: string;
  vehicleId: string;
  severity: AlertSeverity;
  riskScore: number;
  message: string;
  direction: AlertDirection;
  distanceMeters: number;
  timeToConflictSeconds: number | null;
  vehicleType: string | null;
  speedKmh: number;
  reason: string;
  vibrationPattern: number[];
};

export type BraceletAlert = {
  severity: AlertSeverity;
  direction: AlertDirection;
  message: string;
  vibrationPattern: number[];
  receivedAt: number;
  riskScore: number | null;
  distanceMeters: number | null;
  timeToConflictSeconds: number | null;
  vehicleId: string | null;
  vehicleType: string | null;
  reason: string | null;
};
