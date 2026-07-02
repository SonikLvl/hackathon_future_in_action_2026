import { useEffect, useMemo, useRef, useState } from "react";

import type { BraceletAlert } from "@/features/bracelet/types";
import {
  estimateHeadingDeg,
  getImpactRadius,
  getSceneCenter,
  mapThreatToTarget,
} from "@/features/simulation/sceneMapping";
import type { SimulationActor, SimulationSnapshot } from "@/features/simulation/types";

const TRAIL_LIMIT = 14;
const TRAIL_RECORD_INTERVAL_MS = 120;
const SMOOTHING = 0.12;

type UseSimulationEngineInput = {
  activeAlert: BraceletAlert | null;
};

const PEDESTRIAN_ID = "pedestrian_1";

function createPedestrianActor(): SimulationActor {
  const center = getSceneCenter();
  return {
    id: PEDESTRIAN_ID,
    kind: "pedestrian",
    label: "Pedestrian",
    position: center,
    velocity: { x: 0, y: 0 },
    headingDeg: 0,
    speedKmh: 4,
    trail: [],
  };
}

function lerp(current: number, target: number): number {
  return current + (target - current) * SMOOTHING;
}

export function useSimulationEngine({ activeAlert }: UseSimulationEngineInput) {
  const [actors, setActors] = useState<Record<string, SimulationActor>>({
    [PEDESTRIAN_ID]: createPedestrianActor(),
  });

  const targetRef = useRef<{ x: number; y: number } | null>(null);
  const latestSpeedRef = useRef<number>(10);
  const trailTickRef = useRef<number>(0);

  useEffect(() => {
    if (!activeAlert) {
      return;
    }

    const vehicleId = activeAlert.vehicleId ?? "vehicle_unknown";
    const nextTarget = mapThreatToTarget(
      activeAlert.direction,
      activeAlert.distanceMeters,
      activeAlert.timeToConflictSeconds,
    );
    targetRef.current = nextTarget;
    latestSpeedRef.current = activeAlert.speedKmh ?? latestSpeedRef.current;

    setActors((currentActors) => {
      const pedestrian = currentActors[PEDESTRIAN_ID] ?? createPedestrianActor();
      const existingVehicle = currentActors[vehicleId];
      const from = existingVehicle?.position ?? {
        x: nextTarget.x + (getSceneCenter().x - nextTarget.x) * 0.25,
        y: nextTarget.y + (getSceneCenter().y - nextTarget.y) * 0.25,
      };

      const nextVehicle: SimulationActor = {
        id: vehicleId,
        kind: "vehicle",
        label: activeAlert.vehicleType ?? "Vehicle",
        position: existingVehicle?.position ?? from,
        velocity: existingVehicle?.velocity ?? { x: 0, y: 0 },
        headingDeg: estimateHeadingDeg(from, getSceneCenter()),
        speedKmh: activeAlert.speedKmh ?? existingVehicle?.speedKmh ?? 10,
        trail: existingVehicle?.trail ?? [],
      };

      return {
        ...currentActors,
        [PEDESTRIAN_ID]: pedestrian,
        [vehicleId]: nextVehicle,
      };
    });
  }, [activeAlert]);

  useEffect(() => {
    let frameId = 0;
    let previousTimestamp = performance.now();

    const tick = (timestamp: number) => {
      const deltaMs = timestamp - previousTimestamp;
      previousTimestamp = timestamp;
      trailTickRef.current += deltaMs;

      setActors((currentActors) => {
        const entries = Object.entries(currentActors);
        if (entries.length === 0) {
          return currentActors;
        }

        let changed = false;
        const nextActors = entries.reduce<Record<string, SimulationActor>>((acc, [id, actor]) => {
          if (actor.kind !== "vehicle" || !targetRef.current) {
            acc[id] = actor;
            return acc;
          }

          const nextX = lerp(actor.position.x, targetRef.current.x);
          const nextY = lerp(actor.position.y, targetRef.current.y);
          const velocity = {
            x: nextX - actor.position.x,
            y: nextY - actor.position.y,
          };

          const headingDeg = estimateHeadingDeg({ x: nextX, y: nextY }, getSceneCenter());

          const shouldRecordTrail = trailTickRef.current >= TRAIL_RECORD_INTERVAL_MS;
          const nextTrail = shouldRecordTrail
            ? [{ x: nextX, y: nextY }, ...actor.trail].slice(0, TRAIL_LIMIT)
            : actor.trail;

          if (Math.abs(velocity.x) > 0.001 || Math.abs(velocity.y) > 0.001 || shouldRecordTrail) {
            changed = true;
          }

          acc[id] = {
            ...actor,
            position: { x: nextX, y: nextY },
            velocity,
            headingDeg,
            speedKmh: latestSpeedRef.current,
            trail: nextTrail,
          };

          return acc;
        }, {});

        if (trailTickRef.current >= TRAIL_RECORD_INTERVAL_MS) {
          trailTickRef.current = 0;
        }

        return changed ? nextActors : currentActors;
      });

      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  return useMemo<SimulationSnapshot>(() => {
    const severity = activeAlert?.severity ?? "safe";
    const center = getSceneCenter();
    const actorList = Object.values(actors);
    const primaryVehicle = actorList.find((actor) => actor.kind === "vehicle") ?? null;

    return {
      severity,
      actors: actorList,
      conflictPoint: center,
      threatVector: primaryVehicle
        ? {
            from: primaryVehicle.position,
            to: center,
          }
        : null,
      impactRadius: getImpactRadius(severity, activeAlert?.timeToConflictSeconds ?? null),
    };
  }, [activeAlert?.severity, activeAlert?.timeToConflictSeconds, actors]);
}
