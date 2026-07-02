import { useEffect, useMemo, useRef, useState } from "react";

import type { BraceletAlert } from "@/features/bracelet/types";
import type { TelemetryDeviceSnapshot } from "@/features/realtime/useTelemetrySnapshot";
import {
  estimateHeadingDeg,
  getImpactRadius,
  getSceneCenter,
  mapThreatToTarget,
} from "@/features/simulation/sceneMapping";
import type { SimulationActor, SimulationSnapshot } from "@/features/simulation/types";

const TRAIL_LIMIT = 14;
const TRAIL_RECORD_INTERVAL_MS = 120;
const BASE_SMOOTHING = 0.12;
const STALE_VEHICLE_TIMEOUT_MS = 7000;
const METERS_TO_SCENE = 0.85; // 1m -> 0.85 scene units

type UseSimulationEngineInput = {
  activeAlert: BraceletAlert | null;
  telemetryDevices: TelemetryDeviceSnapshot[];
};

const PEDESTRIAN_ID = "pedestrian_1";
const FALLBACK_VEHICLE_ID = "vehicle_unknown";

type VehicleMotionState = {
  target: { x: number; y: number };
  lastUpdatedAt: number;
  lastRiskScore: number;
  ttcSeconds: number | null;
  severity: BraceletAlert["severity"];
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
  if (delta < 0.015) {
    return target;
  }
  const adaptive = Math.min(0.24, BASE_SMOOTHING + delta * 0.015);
  return current + (target - current) * adaptive;
}

export function useSimulationEngine({ activeAlert, telemetryDevices }: UseSimulationEngineInput) {
  const [actors, setActors] = useState<Record<string, SimulationActor>>({
    [PEDESTRIAN_ID]: createPedestrianActor(),
  });

  const trailTickRef = useRef<number>(0);
  const vehicleStateRef = useRef<Record<string, VehicleMotionState>>({});
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

    function toScenePosition(lat: number, lon: number) {
      if (!anchorRef.current) {
        return center;
      }

      const deltaLatMeters = (lat - anchorRef.current.lat) / 0.000009;
      const deltaLonMeters = (lon - anchorRef.current.lon) / 0.000014;
      const x = center.x + deltaLonMeters * METERS_TO_SCENE;
      const y = center.y - deltaLatMeters * METERS_TO_SCENE;

      return { x: Math.max(8, Math.min(92, x)), y: Math.max(10, Math.min(92, y)) };
    }

    setActors((currentActors) => {
      const nextActors: Record<string, SimulationActor> = {
        [PEDESTRIAN_ID]: currentActors[PEDESTRIAN_ID] ?? createPedestrianActor(),
      };

      for (const device of telemetryDevices) {
        const id = device.deviceId;
        const existingActor = currentActors[id];
        const position = toScenePosition(device.lat, device.lon);
        const headingDeg =
          typeof device.azimuth === "number"
            ? device.azimuth
            : estimateHeadingDeg(position, center);

        nextActors[id] = {
          id,
          kind: device.isPedestrian ? "pedestrian" : "vehicle",
          label: device.isPedestrian ? "Pedestrian" : "Vehicle",
          position,
          velocity: existingActor?.velocity ?? { x: 0, y: 0 },
          headingDeg,
          speedKmh: device.speed * 3.6,
          trail: existingActor?.trail ?? [],
        };
      }

      // In telemetry-driven mode, do not keep alert-based motion targets.
      if (telemetryDevices.length > 0) {
        vehicleStateRef.current = {};
      }

      return nextActors;
    });
  }, [telemetryDevices]);

  useEffect(() => {
    if (!activeAlert) {
      return;
    }

    // If live telemetry is available, movement should be telemetry-only.
    // Alerts are used for severity/primary-threat overlays, not for motion targets.
    if (telemetryDevices.length > 0) {
      return;
    }

    const vehicleId = activeAlert.vehicleId ?? FALLBACK_VEHICLE_ID;
    const nextTarget = mapThreatToTarget(
      activeAlert.direction,
      activeAlert.distanceMeters,
      activeAlert.timeToConflictSeconds,
    );
    vehicleStateRef.current[vehicleId] = {
      target: nextTarget,
      lastUpdatedAt: activeAlert.receivedAt,
      lastRiskScore: activeAlert.riskScore ?? 0,
      ttcSeconds: activeAlert.timeToConflictSeconds,
      severity: activeAlert.severity,
    };

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
  }, [activeAlert, telemetryDevices.length]);

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
          if (actor.kind !== "vehicle") {
            acc[id] = actor;
            return acc;
          }

          const vehicleState = vehicleStateRef.current[id];
          if (!vehicleState) {
            acc[id] = actor;
            return acc;
          }

          const ageMs = timestamp - vehicleState.lastUpdatedAt;
          if (ageMs > STALE_VEHICLE_TIMEOUT_MS) {
            changed = true;
            delete vehicleStateRef.current[id];
            return acc;
          }

          const nextX = lerpAdaptive(actor.position.x, vehicleState.target.x);
          const nextY = lerpAdaptive(actor.position.y, vehicleState.target.y);
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
            speedKmh: actor.speedKmh,
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
    const vehicleActors = actorList.filter((actor) => actor.kind === "vehicle");

    const primaryVehicle = vehicleActors
      .map((vehicle) => ({
        vehicle,
        state: vehicleStateRef.current[vehicle.id],
      }))
      .sort((a, b) => {
        const scoreDiff = (b.state?.lastRiskScore ?? 0) - (a.state?.lastRiskScore ?? 0);
        if (scoreDiff !== 0) {
          return scoreDiff;
        }
        return (b.state?.lastUpdatedAt ?? 0) - (a.state?.lastUpdatedAt ?? 0);
      })[0]?.vehicle;

    return {
      severity,
      actors: actorList,
      conflictPoint: center,
      threatVectors: vehicleActors.map((vehicle) => ({
        from: vehicle.position,
        to: center,
      })),
      primaryThreatVehicleId: primaryVehicle?.id ?? null,
      impactRadius: getImpactRadius(severity, activeAlert?.timeToConflictSeconds ?? null),
    };
  }, [activeAlert?.severity, activeAlert?.timeToConflictSeconds, actors]);
}
