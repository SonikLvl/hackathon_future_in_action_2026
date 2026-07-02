import type { AlertDirection, AlertSeverity } from "@/features/bracelet/types";

import type { ScenePoint } from "@/features/simulation/types";

const SCENE_CENTER: ScenePoint = { x: 50, y: 62 };
const DIRECTION_START_POINTS: Record<AlertDirection, ScenePoint> = {
  front: { x: 50, y: 12 },
  back: { x: 50, y: 92 },
  left: { x: 8, y: 52 },
  right: { x: 92, y: 52 },
  unknown: { x: 18, y: 24 },
};

export function getSceneCenter(): ScenePoint {
  return SCENE_CENTER;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function estimateHeadingDeg(from: ScenePoint, to: ScenePoint): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const radians = Math.atan2(dx, -dy);
  const degrees = (radians * 180) / Math.PI;
  return (degrees + 360) % 360;
}

export function getDirectionStartPoint(direction: AlertDirection): ScenePoint {
  return DIRECTION_START_POINTS[direction];
}

export function mapThreatToTarget(
  direction: AlertDirection,
  distanceMeters: number | null,
  timeToConflictSeconds: number | null,
): ScenePoint {
  const start = getDirectionStartPoint(direction);
  const to = getSceneCenter();

  const ttcProgress =
    timeToConflictSeconds === null ? 0.5 : clamp(1 - timeToConflictSeconds / 8, 0.08, 0.95);
  const distanceProgress =
    distanceMeters === null ? 0.5 : clamp(1 - distanceMeters / 45, 0.08, 0.95);
  const progress = clamp((ttcProgress + distanceProgress) / 2, 0.08, 0.96);

  return {
    x: start.x + (to.x - start.x) * progress,
    y: start.y + (to.y - start.y) * progress,
  };
}

export function getImpactRadius(severity: AlertSeverity, ttcSeconds: number | null): number {
  const bySeverity: Record<AlertSeverity, number> = {
    safe: 8,
    caution: 11,
    warning: 14,
    critical: 18,
  };

  const ttcBoost = ttcSeconds === null ? 0 : clamp(7 - ttcSeconds, 0, 5);
  return bySeverity[severity] + ttcBoost;
}
