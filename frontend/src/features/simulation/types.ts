import type { AlertSeverity } from "@/features/bracelet/types";

export type ScenePoint = {
  x: number;
  y: number;
};

export type SimulationActorKind = "pedestrian" | "vehicle";

export type SimulationActor = {
  id: string;
  kind: SimulationActorKind;
  label: string;
  position: ScenePoint;
  velocity: ScenePoint;
  headingDeg: number;
  speedKmh: number;
  trail: ScenePoint[];
};

export type SimulationVector = {
  from: ScenePoint;
  to: ScenePoint;
};

export type SimulationSnapshot = {
  severity: AlertSeverity;
  actors: SimulationActor[];
  threatVector: SimulationVector | null;
  conflictPoint: ScenePoint;
  impactRadius: number;
};
