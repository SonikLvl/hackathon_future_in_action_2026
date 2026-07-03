import type { AlertSeverity } from "@/features/bracelet/types";
import { getRiskZoneRadii } from "@/features/simulation/sceneMapping";
import type { SimulationSnapshot } from "@/features/simulation/types";

const severitySceneGlowClassName: Record<AlertSeverity, string> = {
  safe: "from-emerald-500/10 via-cyan-500/10 to-slate-950",
  caution: "from-yellow-500/15 via-cyan-500/10 to-slate-950",
  warning: "from-orange-500/20 via-cyan-500/10 to-slate-950",
  critical: "from-red-500/25 via-orange-500/15 to-slate-950",
};

function formatMetric(value: number | null, suffix = ""): string {
  if (value === null) {
    return "n/a";
  }
  return `${value.toFixed(1)}${suffix}`;
}

type ThreatSceneProps = {
  snapshot: SimulationSnapshot;
  ttcSeconds: number | null;
};

function getLiveDirectionLabel(snapshot: SimulationSnapshot): string {
  const pedestrian = snapshot.actors.find((actor) => actor.kind === "pedestrian");
  const primaryVehicle = snapshot.actors.find(
    (actor) => actor.kind === "vehicle" && actor.id === snapshot.primaryThreatVehicleId,
  );

  if (!pedestrian || !primaryVehicle) {
    return "Nearby";
  }

  const dx = primaryVehicle.position.x - pedestrian.position.x;
  const dy = primaryVehicle.position.y - pedestrian.position.y;

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? "Right" : "Left";
  }
  return dy > 0 ? "Behind" : "Front";
}

export function ThreatScene({ snapshot, ttcSeconds }: ThreatSceneProps) {
  const primaryVehicleId = snapshot.primaryThreatVehicleId;
  const MAX_VISIBLE_SECONDARY_VEHICLES = 2;
  const pedestrian = snapshot.actors.find((actor) => actor.kind === "pedestrian") ?? null;
  const primaryVehicle =
    snapshot.actors.find((actor) => actor.kind === "vehicle" && actor.id === primaryVehicleId) ?? null;
  const allOtherVehicles = snapshot.actors.filter(
    (actor) => actor.kind === "vehicle" && actor.id !== primaryVehicleId,
  );
  const focusPoint = pedestrian?.position ?? snapshot.conflictPoint;
  const visibleOtherVehicles = [...allOtherVehicles]
    .sort((a, b) => {
      const distA = Math.hypot(a.position.x - focusPoint.x, a.position.y - focusPoint.y);
      const distB = Math.hypot(b.position.x - focusPoint.x, b.position.y - focusPoint.y);
      return distA - distB;
    })
    .slice(0, MAX_VISIBLE_SECONDARY_VEHICLES);
  const hiddenOtherVehiclesCount = Math.max(0, allOtherVehicles.length - visibleOtherVehicles.length);
  const liveDirectionLabel = getLiveDirectionLabel(snapshot);

  const hasActiveThreat = snapshot.severity !== "safe";
  const zoneRadii = getRiskZoneRadii();
  const riskZones = [
    { key: "caution", radius: zoneRadii.caution, stroke: "rgba(250,204,21,0.35)", meters: 24 },
    { key: "warning", radius: zoneRadii.warning, stroke: "rgba(251,146,60,0.45)", meters: 14 },
    { key: "critical", radius: zoneRadii.critical, stroke: "rgba(248,113,113,0.6)", meters: 7 },
  ];

  // Threat arrow: a clean, centered vector from the primary vehicle toward the
  // pedestrian, stopping just short of the safety ring, with a solid arrowhead.
  // Only shown while there is a real (non-safe) threat.
  const threatArrow = (() => {
    if (!primaryVehicle || !hasActiveThreat) {
      return null;
    }
    const from = primaryVehicle.position;
    const dx = focusPoint.x - from.x;
    const dy = focusPoint.y - from.y;
    const length = Math.hypot(dx, dy) || 1;
    const ux = dx / length;
    const uy = dy / length;
    const endGap = 3.2; // stop just outside the pedestrian marker
    const tip = { x: focusPoint.x - ux * endGap, y: focusPoint.y - uy * endGap };
    const headSize = 3.4;
    const spread = 0.45;
    const angle = Math.atan2(uy, ux);
    const left = {
      x: tip.x - headSize * Math.cos(angle - spread),
      y: tip.y - headSize * Math.sin(angle - spread),
    };
    const right = {
      x: tip.x - headSize * Math.cos(angle + spread),
      y: tip.y - headSize * Math.sin(angle + spread),
    };
    return { from, tip, left, right };
  })();

  return (
    <div className="mt-6 rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-slate-950 via-slate-950 to-cyan-950/40 p-5">
      <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">Live simulation area</p>
      <div className="mt-4 rounded-2xl border border-cyan-900/60 bg-slate-950 p-4">
        <div
          className={`relative aspect-square w-full overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b ${severitySceneGlowClassName[snapshot.severity]}`}
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
            {riskZones.map((zone) => (
              <circle
                key={zone.key}
                cx={focusPoint.x}
                cy={focusPoint.y}
                r={zone.radius}
                fill={zone.key === "critical" ? "rgba(248,113,113,0.06)" : "none"}
                stroke={zone.stroke}
                strokeWidth="1"
                strokeDasharray="2 2"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {threatArrow ? (
              <>
                <line
                  x1={threatArrow.from.x}
                  y1={threatArrow.from.y}
                  x2={threatArrow.tip.x}
                  y2={threatArrow.tip.y}
                  stroke="rgba(248,113,113,0.9)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
                <polygon
                  points={`${threatArrow.tip.x},${threatArrow.tip.y} ${threatArrow.left.x},${threatArrow.left.y} ${threatArrow.right.x},${threatArrow.right.y}`}
                  fill="rgba(248,113,113,0.95)"
                />
              </>
            ) : null}
          </svg>

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

          {primaryVehicle && hasActiveThreat ? (
            <div
              className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-red-100 bg-red-300"
              style={{ left: `${primaryVehicle.position.x}%`, top: `${primaryVehicle.position.y}%` }}
            />
          ) : null}

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
            Approach {liveDirectionLabel}
          </div>
          <div className="absolute right-4 top-4 flex flex-col items-end gap-2">
            <div className="rounded-full border border-white/20 bg-slate-900/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-200">
              TTC {formatMetric(ttcSeconds, "s")}
            </div>
            <div className="rounded-full border border-white/20 bg-slate-900/85 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-200">
              Other traffic: {visibleOtherVehicles.length}
              {hiddenOtherVehiclesCount > 0 ? ` (+${hiddenOtherVehiclesCount})` : ""}
            </div>
          </div>

          <div className="absolute bottom-3 left-3 max-w-[78%] rounded-lg border border-white/10 bg-slate-900/85 px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-300">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-300" />
                Pedestrian
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-1.5 w-3 rounded-sm bg-red-400" />
                Threat
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full border border-yellow-300/80" />
                24m
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full border border-orange-300/80" />
                14m
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full border border-red-300/80" />
                7m
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
