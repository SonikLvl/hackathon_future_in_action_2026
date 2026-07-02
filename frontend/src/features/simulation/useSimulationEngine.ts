import { useEffect, useMemo, useRef, useState } from "react";

import type { BraceletAlert } from "@/features/bracelet/types";
import type { TelemetryDeviceSnapshot } from "@/features/realtime/useTelemetrySnapshot";
import { estimateHeadingDeg, getImpactRadius, getSceneCenter } from "@/features/simulation/sceneMapping";
import type { SimulationActor, SimulationSnapshot } from "@/features/simulation/types";

const TRAIL_LIMIT = 14;
const BASE_SMOOTHING = 0.18;
const METERS_TO_SCENE = 0.85; // 1m -> 0.85 scene units
const PEDESTRIAN_ID = "pedestrian_1";

type UseSimulationEngineInput = {
  activeAlert: BraceletAlert | null;
  telemetryDevices: TelemetryDeviceSnapshot[];
};

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

function lerpAdaptive(current: number, target: number): number {
  const delta = Math.abs(target - current);
  if (delta < 0.012) {
    return target;
  }
  const adaptive = Math.min(0.28, BASE_SMOOTHING + delta * 0.015);
  return current + (target - current) * adaptive;
}

function toScenePosition(
  lat: number,
  lon: number,
  anchor: { lat: number; lon: number } | null,
  center: { x: number; y: number },
) {
  if (!anchor) {
    return center;
  }

  const deltaLatMeters = (lat - anchor.lat) / 0.000009;
  const deltaLonMeters = (lon - anchor.lon) / 0.000014;
  const x = center.x + deltaLonMeters * METERS_TO_SCENE;
  const y = center.y - deltaLatMeters * METERS_TO_SCENE;

  return { x: Math.max(8, Math.min(92, x)), y: Math.max(10, Math.min(92, y)) };
}

export function useSimulationEngine({ activeAlert, telemetryDevices }: UseSimulationEngineInput) {
  const [actors, setActors] = useState<Record<string, SimulationActor>>({
    [PEDESTRIAN_ID]: createPedestrianActor(),
  });
  const anchorRef = useRef<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    if (telemetryDevices.length === 0) {
      return;
    }

    const center = getSceneCenter();
    const pedestrianDevice =
      telemetryDevices.find((device) => device.isPedestrian && device.deviceId === PEDESTRIAN_ID) ??
      telemetryDevices.find((device) => device.isPedestrian) ??
      null;

    if (pedestrianDevice && anchorRef.current === null) {
      anchorRef.current = {
        lat: pedestrianDevice.lat,
        lon: pedestrianDevice.lon,
      };
    }

    setActors((currentActors) => {
      const nextActors: Record<string, SimulationActor> = {};

      for (const device of telemetryDevices) {
        const id = device.deviceId;
        const existingActor = currentActors[id];
        const targetPosition = toScenePosition(device.lat, device.lon, anchorRef.current, center);
        const nextPosition = existingActor
          ? {
              x: lerpAdaptive(existingActor.position.x, targetPosition.x),
              y: lerpAdaptive(existingActor.position.y, targetPosition.y),
            }
          : targetPosition;
        const velocity = existingActor
          ? {
              x: nextPosition.x - existingActor.position.x,
              y: nextPosition.y - existingActor.position.y,
            }
          : { x: 0, y: 0 };

        const headingDeg =
          typeof device.azimuth === "number"
            ? device.azimuth
            : estimateHeadingDeg(nextPosition, center);

        const existingTrail = existingActor?.trail ?? [];
        const nextTrail =
          device.isPedestrian || (Math.abs(velocity.x) < 0.001 && Math.abs(velocity.y) < 0.001)
            ? existingTrail
            : [{ x: nextPosition.x, y: nextPosition.y }, ...existingTrail].slice(0, TRAIL_LIMIT);

        nextActors[id] = {
          id,
          kind: device.isPedestrian ? "pedestrian" : "vehicle",
          label: device.isPedestrian ? "Pedestrian" : "Vehicle",
          position: nextPosition,
          velocity,
          headingDeg,
          speedKmh: device.speed * 3.6,
          trail: nextTrail,
        };
      }

      if (!nextActors[PEDESTRIAN_ID]) {
        nextActors[PEDESTRIAN_ID] = currentActors[PEDESTRIAN_ID] ?? createPedestrianActor();
      }

      return nextActors;
    });
  }, [telemetryDevices]);

  return useMemo<SimulationSnapshot>(() => {
    const severity = activeAlert?.severity ?? "safe";
    const center = getSceneCenter();
    const actorList = Object.values(actors);
    const vehicleActors = actorList.filter((actor) => actor.kind === "vehicle");

    const primaryVehicle =
      (activeAlert?.vehicleId
        ? vehicleActors.find((vehicle) => vehicle.id === activeAlert.vehicleId)
        : null) ??
      vehicleActors[0] ??
      null;

    return {
      severity,
      actors: actorList,
      conflictPoint: center,
      threatVectors: primaryVehicle
        ? [
            {
              from: primaryVehicle.position,
              to: center,
            },
          ]
        : [],
      primaryThreatVehicleId: primaryVehicle?.id ?? null,
      impactRadius: getImpactRadius(severity, activeAlert?.timeToConflictSeconds ?? null),
    };
  }, [activeAlert?.severity, activeAlert?.timeToConflictSeconds, activeAlert?.vehicleId, actors]);
}
