import type { AlertDirection, AlertSeverity, BraceletConnectionStatus } from "@/features/bracelet/types";
import { useRiskAlertStream } from "@/features/realtime/useRiskAlertStream";

const connectionLabel: Record<BraceletConnectionStatus, string> = {
  connecting: "Connecting",
  connected: "Live",
  reconnecting: "Reconnecting",
  disconnected: "Disconnected",
};

const connectionClassName: Record<BraceletConnectionStatus, string> = {
  connecting: "border-cyan-500/40 bg-cyan-950/60 text-cyan-100",
  connected: "border-emerald-500/40 bg-emerald-950/60 text-emerald-100",
  reconnecting: "border-amber-500/40 bg-amber-950/60 text-amber-100",
  disconnected: "border-slate-600 bg-slate-900 text-slate-200",
};

const severityBadgeClassName: Record<AlertSeverity, string> = {
  safe: "border-emerald-400/30 bg-emerald-950/70 text-emerald-100",
  caution: "border-yellow-400/30 bg-yellow-950/70 text-yellow-100",
  warning: "border-orange-400/30 bg-orange-950/70 text-orange-100",
  critical: "border-red-400/40 bg-red-950/70 text-red-100",
};

const severityLabel: Record<AlertSeverity, string> = {
  safe: "Safe",
  caution: "Caution",
  warning: "Warning",
  critical: "Critical",
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

function formatLastSeen(timestamp: number | null): string {
  if (timestamp === null) {
    return "No events yet";
  }

  const diffMs = Date.now() - timestamp;
  if (diffMs < 1000) {
    return "just now";
  }

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}

export function DemoPage() {
  const { status, latestAlert, alertHistory, lastMessageAt } = useRiskAlertStream();
  const activeAlert = latestAlert;
  const feedItems = alertHistory.slice(0, 8);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-50 lg:px-8">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-slate-900/70 p-6 backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300">
              VARTA Safety Command Console
            </p>
            <div
              className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] ${connectionClassName[status]}`}
            >
              {connectionLabel[status]}
            </div>
          </div>

          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            Real-time vehicle threat awareness
          </h1>

          <p className="max-w-3xl text-slate-300">
            The console listens to live backend `risk_alert` events and highlights the latest
            threat for operators. Keep `/bracelet` open in parallel to verify synchronized alerts.
          </p>
          <div className="flex flex-wrap items-center gap-5 text-sm text-slate-300">
            <p>
              Last event: <span className="font-semibold text-slate-100">{formatLastSeen(lastMessageAt)}</span>
            </p>
            <p>
              Feed size: <span className="font-semibold text-slate-100">{feedItems.length}</span>
            </p>
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-2xl shadow-black/30">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Active threat</p>
                <h2 className="mt-2 text-2xl font-bold">
                  {activeAlert ? activeAlert.message : "No active risk event"}
                </h2>
                <p className="mt-2 text-sm text-slate-300">
                  {activeAlert?.reason ??
                    "Waiting for backend event stream. Start emulator telemetry to trigger alerts."}
                </p>
              </div>

              <div
                className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] ${activeAlert ? severityBadgeClassName[activeAlert.severity] : "border-slate-700 bg-slate-900 text-slate-300"}`}
              >
                {activeAlert ? severityLabel[activeAlert.severity] : "Idle"}
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Risk score</p>
                <p className="mt-2 text-3xl font-bold text-white">
                  {activeAlert?.riskScore ?? "—"}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Distance</p>
                <p className="mt-2 text-3xl font-bold text-white">
                  {formatMetric(activeAlert?.distanceMeters ?? null, " m")}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Time to conflict</p>
                <p className="mt-2 text-3xl font-bold text-white">
                  {formatMetric(activeAlert?.timeToConflictSeconds ?? null, " s")}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Direction</p>
                <p className="mt-2 text-xl font-semibold text-white">
                  {activeAlert ? directionLabel[activeAlert.direction] : "n/a"}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Vehicle</p>
                <p className="mt-2 text-xl font-semibold text-white">{activeAlert?.vehicleId ?? "n/a"}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.15em] text-slate-400">
                  {activeAlert?.vehicleType ?? "unknown"}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Speed</p>
                <p className="mt-2 text-xl font-semibold text-white">
                  {formatMetric(activeAlert?.speedKmh ?? null, " km/h")}
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-slate-950 via-slate-950 to-cyan-950/40 p-5">
              <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">Live simulation area</p>
              <div className="mt-4 rounded-2xl border border-cyan-900/60 bg-slate-950 p-4">
                <div className="relative h-56 overflow-hidden rounded-xl border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.15),_rgba(2,6,23,0.95))]">
                  <div className="absolute inset-x-8 top-8 h-3 rounded-full bg-slate-700/80" />
                  <div className="absolute inset-x-8 top-20 h-3 rounded-full bg-slate-700/80" />
                  <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 border-l border-dashed border-cyan-400/50" />
                  <div className="absolute bottom-8 left-1/2 h-12 w-12 -translate-x-1/2 rounded-full border-2 border-emerald-300/80 bg-emerald-400/20" />
                  <div className="absolute left-1/2 top-9 h-10 w-16 -translate-x-1/2 rounded-lg border border-orange-300/80 bg-orange-400/20" />
                  <p className="absolute bottom-3 left-3 text-[10px] uppercase tracking-[0.2em] text-slate-300">
                    Placeholder for animated map and trajectory vectors
                  </p>
                </div>
              </div>
            </div>
          </div>

          <aside className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-2xl shadow-black/30">
            <h2 className="text-xl font-bold">Recent event timeline</h2>
            <p className="mt-2 text-sm text-slate-300">
              Latest backend alerts received by this operator console.
            </p>

            <div className="mt-5 space-y-3">
              {feedItems.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-400">
                  Waiting for realtime events. Start telemetry emulator to populate the feed.
                </div>
              ) : null}

              {feedItems.map((event, index) => (
                <article
                  key={`${event.receivedAt}-${index}`}
                  className="rounded-2xl border border-white/10 bg-slate-950/80 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p
                      className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${severityBadgeClassName[event.severity]}`}
                    >
                      {severityLabel[event.severity]}
                    </p>
                    <p className="text-xs text-slate-400">{formatLastSeen(event.receivedAt)}</p>
                  </div>

                  <p className="mt-3 font-semibold text-slate-100">{event.message}</p>
                  <p className="mt-1 text-sm text-slate-300">{event.reason ?? "No reason provided."}</p>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-300">
                    <p>Direction: {directionLabel[event.direction]}</p>
                    <p>Score: {event.riskScore ?? "n/a"}</p>
                    <p>Distance: {formatMetric(event.distanceMeters, " m")}</p>
                    <p>TTC: {formatMetric(event.timeToConflictSeconds, " s")}</p>
                    <p>Vehicle: {event.vehicleId ?? "n/a"}</p>
                    <p>Speed: {formatMetric(event.speedKmh ?? null, " km/h")}</p>
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-cyan-400/20 bg-cyan-950/40 p-4 text-cyan-50">
              <p className="font-semibold">Operator note</p>
              <p className="mt-2 text-sm leading-6 text-cyan-100">
                Open `/bracelet` in parallel. Both views should react to the same event stream from
                `/ws/pedestrian_1`.
              </p>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
