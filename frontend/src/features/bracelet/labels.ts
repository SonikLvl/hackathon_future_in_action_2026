import type { AlertDirection, AlertSeverity } from "@/features/bracelet/types";

/** Full severity titles for the pedestrian device screen. */
export const severityTitle: Record<AlertSeverity, string> = {
  safe: "Безпечно",
  caution: "Обережно",
  warning: "Увага",
  critical: "Критична загроза",
};

/** Compact severity labels for badges and dense lists. */
export const severityShortLabel: Record<AlertSeverity, string> = {
  safe: "Безпечно",
  caution: "Обережно",
  warning: "Увага",
  critical: "Критично",
};

/** Threat direction, relative to the pedestrian's heading. */
export const directionLabel: Record<AlertDirection, string> = {
  front: "Спереду",
  back: "Позаду",
  left: "Ліворуч",
  right: "Праворуч",
  unknown: "Поблизу",
};
