export type BraceletConnectionStatus = "connecting" | "connected" | "reconnecting" | "disconnected";

export type AlertSeverity = "safe" | "warning" | "high" | "critical";

export type AlertDirection = "front" | "back" | "left" | "right" | "unknown";

export type BraceletAlert = {
  severity: AlertSeverity;
  direction: AlertDirection;
  message: string;
  vibrationPattern: number[];
  receivedAt: number;
};
