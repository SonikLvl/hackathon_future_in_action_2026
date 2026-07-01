import type { AlertDirection, AlertSeverity, BraceletAlert } from "@/features/bracelet/types";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function parseSeverity(value: unknown): AlertSeverity {
  if (value === "safe" || value === "warning" || value === "high" || value === "critical") {
    return value;
  }

  return "high";
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

  return [200, 100, 200];
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
      const message =
        typeof parsed.message === "string" ? parsed.message : "Danger nearby. Look around.";

      return {
        severity: parseSeverity(parsed.severity),
        direction: parseDirection(parsed.direction),
        message,
        vibrationPattern: parseVibrationPattern(parsed.vibrationPattern),
        receivedAt: Date.now(),
      };
    }
  } catch {
    // Current backend sends plain text, so this is expected for now.
  }

  return {
    severity: "high",
    direction: guessDirectionFromText(rawMessage),
    message: rawMessage,
    vibrationPattern: [200, 100, 200],
    receivedAt: Date.now(),
  };
}
