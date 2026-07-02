import type { AlertDirection, AlertSeverity } from "@/features/bracelet/types";
import type { SimulationSnapshot } from "@/features/simulation/types";

const severitySceneGlowClassName: Record<AlertSeverity, string> = {
  safe: "from-emerald-500/10 via-cyan-500/10 to-slate-950",
  caution: "from-yellow-500/15 via-cyan-500/10 to-slate-950",
  warning: "from-orange-500/20 via-cyan-500/10 to-slate-950",
  critical: "from-red-500/25 via-orange-500/15 to-slate-950",
};

const directionLabel: Record<AlertDirection, string> = {
  front: "Front",
  back: "Behind",
  left: "Left",
  right: "Right",
  unknown: "Nearby",
};

function formatMetric(value: number | null, suffix = ""): string {
  if (value === null) {
    return "n/a";
  }
  return `${value.toFixed(1)}${suffix}`;
}

type ThreatSceneProps = {
  snapshot: SimulationSnapshot;
  direction: AlertDirection;
  ttcSeconds: number | null;
};

export function ThreatScene({ snapshot, direction, ttcSeconds }: ThreatSceneProps) {
  const primaryVehicleId = snapshot.primaryThreatVehicleId;
  const MAX_VISIBLE_SECONDARY_VEHICLES = 2;
  const primaryVehicle =
    snapshot.actors.find((actor) => actor.kind === "vehicle" && actor.id === primaryVehicleId) ?? null;
  const allOtherVehicles = snapshot.actors.filter(
    (actor) => actor.kind === "vehicle" && actor.id !== primaryVehicleId,
  );
  const visibleOtherVehicles = [...allOtherVehicles]
    .sort((a, b) => {
      const distA = Math.hypot(
        a.position.x - snapshot.conflictPoint.x,
        a.position.y - snapshot.conflictPoint.y,
      );
      const distB = Math.hypot(
        b.position.x - snapshot.conflictPoint.x,
        b.position.y - snapshot.conflictPoint.y,
      );
      return distA - distB;
    })
    .slice(0, MAX_VISIBLE_SECONDARY_VEHICLES);
  const hiddenOtherVehiclesCount = Math.max(0, allOtherVehicles.length - visibleOtherVehicles.length);

  return (
    <div className="mt-6 rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-slate-950 via-slate-950 to-cyan-950/40 p-5">
      <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">Live simulation area</p>
      <div className="mt-4 rounded-2xl border border-cyan-900/60 bg-slate-950 p-4">
        <div
          className={`relative h-64 overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b ${severitySceneGlowClassName[snapshot.severity]}`}
        >
          <div className="absolute left-1/2 top-5 h-[78%] w-40 -translate-x-1/2 rounded-3xl border border-slate-600/60 bg-slate-900/70">
            <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 border-l border-dashed border-cyan-300/40" />
            <div className="absolute inset-x-3 top-[42%] h-8 rounded-md border border-white/15 bg-white/5" />
            <div className="absolute inset-x-3 top-[42%] grid h-8 grid-cols-6 gap-1 p-1">
              <div className="rounded-sm bg-white/20" />
              <div className="rounded-sm bg-white/10" />
              <div className="rounded-sm bg-white/20" />
              <div className="rounded-sm bg-white/10" />
              <div className="rounded-sm bg-white/20" />
              <div className="rounded-sm bg-white/10" />
            </div>
          </div>

          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            {visibleOtherVehicles.map((vehicle) => (
              <polyline
                key={`${vehicle.id}-trail`}
                points={vehicle.trail.map((point) => `${point.x},${point.y}`).join(" ")}
                fill="none"
                stroke="rgba(148,163,184,0.28)"
                strokeWidth="0.7"
              />
            ))}
            {primaryVehicle ? (
              <polyline
                points={primaryVehicle.trail.map((point) => `${point.x},${point.y}`).join(" ")}
                fill="none"
                stroke="rgba(248,113,113,0.45)"
                strokeWidth="1.1"
              />
            ) : null}

            {primaryVehicle ? (
              <line
                x1={primaryVehicle.position.x}
                y1={primaryVehicle.position.y}
                x2={snapshot.conflictPoint.x}
                y2={snapshot.conflictPoint.y}
                stroke="rgba(248,113,113,0.75)"
                strokeWidth="1.2"
                strokeDasharray="3 2"
              />
            ) : null}
          </svg>

          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-red-300/60 bg-red-400/10"
            style={{
              left: `${snapshot.conflictPoint.x}%`,
              top: `${snapshot.conflictPoint.y}%`,
              width: `${snapshot.impactRadius * 1.25}px`,
              height: `${snapshot.impactRadius * 1.25}px`,
            }}
          />
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-red-200/80 bg-red-300/20"
            style={{
              left: `${snapshot.conflictPoint.x}%`,
              top: `${snapshot.conflictPoint.y}%`,
              width: "10px",
              height: "10px",
            }}
          />

          {snapshot.actors.map((actor) => {
            if (
              actor.kind === "vehicle" &&
              actor.id !== primaryVehicleId &&
              !visibleOtherVehicles.some((vehicle) => vehicle.id === actor.id)
            ) {
              return null;
            }

            if (actor.kind === "pedestrian") {
              return (
                <div
                  key={actor.id}
                  className="absolute h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-300/80 bg-emerald-300/20"
                  style={{ left: `${actor.position.x}%`, top: `${actor.position.y}%` }}
                />
              );
            }

            return (
              <div
                key={actor.id}
                className={`absolute h-8 w-14 -translate-x-1/2 -translate-y-1/2 rounded-md border transition-all duration-300 ${
                  actor.id === primaryVehicleId
                    ? "border-red-200/90 bg-red-400/35 shadow-[0_0_26px_rgba(248,113,113,0.45)]"
                    : "border-orange-200/90 bg-orange-400/30 shadow-[0_0_20px_rgba(251,146,60,0.35)]"
                }`}
                style={{
                  left: `${actor.position.x}%`,
                  top: `${actor.position.y}%`,
                  rotate: `${actor.headingDeg}deg`,
                }}
              />
            );
          })}

          {snapshot.actors.map((actor) => (
            (actor.kind === "vehicle" &&
              actor.id !== primaryVehicleId &&
              !visibleOtherVehicles.some((vehicle) => vehicle.id === actor.id))
              ? null
              : (
            <div
              key={`${actor.id}-label`}
              className="absolute -translate-x-1/2 rounded-full border border-white/15 bg-slate-900/80 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-200"
              style={{ left: `${actor.position.x}%`, top: `${Math.max(4, actor.position.y - 7)}%` }}
            >
              {actor.kind === "pedestrian" ? "Pedestrian" : actor.id}
            </div>
              )
          ))}

          <div className="absolute left-4 top-4 rounded-full border border-cyan-300/30 bg-slate-900/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-200">
            Approach {directionLabel[direction]}
          </div>
          <div className="absolute right-4 top-4 rounded-full border border-white/20 bg-slate-900/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-200">
            TTC {formatMetric(ttcSeconds, "s")}
          </div>

          <p className="absolute bottom-3 left-3 text-[10px] uppercase tracking-[0.2em] text-slate-300">
            Legend: green=pedestrian, red=primary threat, orange=other vehicles
          </p>
          <div className="absolute bottom-3 right-3 rounded-full border border-white/20 bg-slate-900/85 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-200">
            Other traffic: {visibleOtherVehicles.length}
            {hiddenOtherVehiclesCount > 0 ? ` (+${hiddenOtherVehiclesCount})` : ""}
          </div>
        </div>
      </div>
    </div>
  );
}
