import type { AlertDirection, AlertSeverity, BraceletAlert, RiskAlertEvent } from "@/features/bracelet/types";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function parseSeverity(value: unknown): AlertSeverity {
  if (value === "safe" || value === "caution" || value === "warning" || value === "critical") {
    return value;
  }

  return "warning";
}

function parseDirection(value: unknown): AlertDirection {
  if (
    value === "front" ||
    value === "back" ||
    value === "left" ||
    value === "right" ||
    value === "unknown"
  ) {
    return value;
  }

  return "unknown";
}

function parseVibrationPattern(value: unknown): number[] {
  if (Array.isArray(value) && value.every((item) => typeof item === "number")) {
    return value;
  }

  return [140, 90, 140];
}

function parseNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseOptionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function parseRiskAlertEvent(payload: UnknownRecord): RiskAlertEvent | null {
  if (payload.type !== "risk_alert" || payload.version !== 1) {
    return null;
  }

  if (typeof payload.message !== "string" || typeof payload.deviceId !== "string") {
    return null;
  }

  return {
    type: "risk_alert",
    version: 1,
    timestamp: typeof payload.timestamp === "string" ? payload.timestamp : new Date().toISOString(),
    deviceId: payload.deviceId,
    vehicleId: typeof payload.vehicleId === "string" ? payload.vehicleId : "unknown",
    severity: parseSeverity(payload.severity),
    riskScore: parseNumber(payload.riskScore) ?? 0,
    message: payload.message,
    direction: parseDirection(payload.direction),
    distanceMeters: parseNumber(payload.distanceMeters) ?? 0,
    timeToConflictSeconds: parseNumber(payload.timeToConflictSeconds),
    vehicleType: parseOptionalString(payload.vehicleType),
    speedKmh: parseNumber(payload.speedKmh) ?? 0,
    reason: typeof payload.reason === "string" ? payload.reason : "Vehicle risk detected nearby.",
    vibrationPattern: parseVibrationPattern(payload.vibrationPattern),
  };
}

export type RiskClearSignal = {
  deviceId: string | null;
  vehicleId: string | null;
  reason: string | null;
  receivedAt: number;
};

export function tryParseRiskClear(rawMessage: string): RiskClearSignal | null {
  try {
    const parsed: unknown = JSON.parse(rawMessage);
    if (isRecord(parsed) && parsed.type === "risk_clear") {
      return {
        deviceId: parseOptionalString(parsed.deviceId),
        vehicleId: parseOptionalString(parsed.vehicleId),
        reason: parseOptionalString(parsed.reason),
        receivedAt: Date.now(),
      };
    }
  } catch {
    // Not JSON or not a clear event; fall through to alert parsing.
  }

  return null;
}

function guessDirectionFromText(message: string): AlertDirection {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("ззаду")) {
    return "back";
  }

  if (lowerMessage.includes("зліва")) {
    return "left";
  }

  if (lowerMessage.includes("справа")) {
    return "right";
  }

  if (lowerMessage.includes("спереду")) {
    return "front";
  }

  return "unknown";
}

export function parseBraceletMessage(rawMessage: string): BraceletAlert {
  try {
    const parsed: unknown = JSON.parse(rawMessage);

    if (isRecord(parsed)) {
      const structuredEvent = parseRiskAlertEvent(parsed);
      if (structuredEvent) {
        return {
          severity: structuredEvent.severity,
          direction: structuredEvent.direction,
          message: structuredEvent.message,
          vibrationPattern: structuredEvent.vibrationPattern,
          receivedAt: Date.now(),
          riskScore: structuredEvent.riskScore,
          distanceMeters: structuredEvent.distanceMeters,
          timeToConflictSeconds: structuredEvent.timeToConflictSeconds,
          vehicleId: structuredEvent.vehicleId,
          vehicleType: structuredEvent.vehicleType,
          speedKmh: structuredEvent.speedKmh,
          reason: structuredEvent.reason,
        };
      }

      const message = typeof parsed.message === "string" ? parsed.message : "Danger nearby. Look around.";

      return {
        severity: parseSeverity(parsed.severity),
        direction: parseDirection(parsed.direction),
        message,
        vibrationPattern: parseVibrationPattern(parsed.vibrationPattern),
        receivedAt: Date.now(),
        riskScore: parseNumber(parsed.riskScore),
        distanceMeters: parseNumber(parsed.distanceMeters),
        timeToConflictSeconds: parseNumber(parsed.timeToConflictSeconds),
        vehicleId: parseOptionalString(parsed.vehicleId),
        vehicleType: parseOptionalString(parsed.vehicleType),
        speedKmh: parseNumber(parsed.speedKmh),
        reason: parseOptionalString(parsed.reason),
      };
    }
  } catch {
    // Current backend sends plain text, so this is expected for now.
  }

  return {
    severity: "warning",
    direction: guessDirectionFromText(rawMessage),
    message: rawMessage,
    vibrationPattern: [140, 90, 140],
    receivedAt: Date.now(),
    riskScore: null,
    distanceMeters: null,
    timeToConflictSeconds: null,
    vehicleId: null,
    vehicleType: null,
    speedKmh: null,
    reason: null,
  };
}
