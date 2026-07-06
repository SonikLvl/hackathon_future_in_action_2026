import { directionLabel, severityShortLabel } from "@/features/bracelet/labels";
import type { AlertSeverity, BraceletConnectionStatus } from "@/features/bracelet/types";
import { useRiskAlertStream } from "@/features/realtime/useRiskAlertStream";
import { useTelemetrySnapshot } from "@/features/realtime/useTelemetrySnapshot";
import { ScenarioControls } from "@/features/simulation/ScenarioControls";
import { ThreatScene } from "@/features/simulation/ThreatScene";
import { useSimulationEngine } from "@/features/simulation/useSimulationEngine";

const connectionLabel: Record<BraceletConnectionStatus, string> = {
  connecting: "З'єднання...",
  connected: "Наживо",
  reconnecting: "Перепідключення...",
  disconnected: "Немає з'єднання",
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

function formatMetric(value: number | null, suffix = ""): string {
  if (value === null) {
    return "н/д";
  }
  return `${value.toFixed(1)}${suffix}`;
}

function formatLastSeen(timestamp: number | null): string {
  if (timestamp === null) {
    return "Подій ще немає";
  }

  const diffMs = Date.now() - timestamp;
  if (diffMs < 1000) {
    return "щойно";
  }

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) {
    return `${seconds}с тому`;
  }

  const minutes = Math.floor(seconds / 60);
  return `${minutes}хв тому`;
}

export function DemoPage() {
  const { status, latestAlert, alertHistory, lastMessageAt, clearAlertHistory } =
    useRiskAlertStream();
  const { devices: telemetryDevices } = useTelemetrySnapshot();
  const activeAlert = latestAlert;
  const feedItems = alertHistory.slice(0, 8);
  const simulationSnapshot = useSimulationEngine({ activeAlert, telemetryDevices });

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-50 lg:px-8">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-slate-900/70 p-6 backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300">
              Командна консоль безпеки VARTA
            </p>
            <div
              className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] ${connectionClassName[status]}`}
            >
              {connectionLabel[status]}
            </div>
          </div>

          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            Виявлення транспортних загроз у реальному часі
          </h1>

          <p className="max-w-3xl text-slate-300">
            Консоль показує загрози для пішоходів у реальному часі: активну небезпеку, ключові
            показники та стрічку останніх подій.
          </p>
          <div className="flex flex-wrap items-center gap-5 text-sm text-slate-300">
            <p>
              Остання подія: <span className="font-semibold text-slate-100">{formatLastSeen(lastMessageAt)}</span>
            </p>
            <p>
              Розмір стрічки: <span className="font-semibold text-slate-100">{feedItems.length}</span>
            </p>
          </div>
        </header>

        <ScenarioControls />

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-2xl shadow-black/30">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Активна загроза</p>
                <h2 className="mt-2 text-2xl font-bold">
                  {activeAlert ? activeAlert.message : "Немає активної загрози"}
                </h2>
                <p className="mt-2 text-sm text-slate-300">
                  {activeAlert?.reason ??
                    "Зараз активних загроз немає. Щойно транспорт наблизиться до пішохода, тут з'явиться деталізація."}
                </p>
              </div>

              <div
                className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] ${activeAlert ? severityBadgeClassName[activeAlert.severity] : "border-slate-700 bg-slate-900 text-slate-300"}`}
              >
                {activeAlert ? severityShortLabel[activeAlert.severity] : "Очікування"}
              </div>
            </div>

            <p className="mt-2 text-xs uppercase tracking-[0.14em] text-slate-400">
              Рівень небезпеки визначається за поточним основним транспортом-загрозою:{" "}
              <span className="font-semibold text-slate-200">{activeAlert?.vehicleId ?? "н/д"}</span>
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Рівень ризику</p>
                <p className="mt-2 text-3xl font-bold text-white">
                  {activeAlert?.riskScore ?? "—"}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Відстань</p>
                <p className="mt-2 text-3xl font-bold text-white">
                  {formatMetric(activeAlert?.distanceMeters ?? null, " м")}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Час до зіткнення</p>
                <p className="mt-2 text-3xl font-bold text-white">
                  {formatMetric(activeAlert?.timeToConflictSeconds ?? null, " с")}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Напрямок</p>
                <p className="mt-2 text-xl font-semibold text-white">
                  {activeAlert ? directionLabel[activeAlert.direction] : "н/д"}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Транспорт</p>
                <p className="mt-2 text-xl font-semibold text-white">{activeAlert?.vehicleId ?? "н/д"}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.15em] text-slate-400">
                  {activeAlert?.vehicleType ?? "невідомо"}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Швидкість</p>
                <p className="mt-2 text-xl font-semibold text-white">
                  {formatMetric(activeAlert?.speedKmh ?? null, " км/год")}
                </p>
              </div>
            </div>

            <ThreatScene
              snapshot={simulationSnapshot}
              ttcSeconds={activeAlert?.timeToConflictSeconds ?? null}
            />
          </div>

          <aside className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-2xl shadow-black/30">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">Історія останніх подій</h2>
                <p className="mt-2 text-sm text-slate-300">
                  Останні сповіщення з бекенду, отримані цією консоллю оператора.
                </p>
              </div>
              <button
                type="button"
                disabled={feedItems.length === 0}
                onClick={clearAlertHistory}
                className="shrink-0 rounded-full border border-white/15 bg-slate-950/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-200 transition-colors hover:border-cyan-400/40 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Очистити історію
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {feedItems.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-400">
                  Поки що подій немає. Тут з'являтимуться отримані сповіщення про загрози.
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
                      {severityShortLabel[event.severity]}
                    </p>
                    <p className="text-xs text-slate-400">{formatLastSeen(event.receivedAt)}</p>
                  </div>

                  <p className="mt-3 font-semibold text-slate-100">{event.message}</p>
                  <p className="mt-1 text-sm text-slate-300">{event.reason ?? "Причину не вказано."}</p>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-300">
                    <p>Напрямок: {directionLabel[event.direction]}</p>
                    <p>Оцінка: {event.riskScore ?? "н/д"}</p>
                    <p>Відстань: {formatMetric(event.distanceMeters, " м")}</p>
                    <p>До зіткнення: {formatMetric(event.timeToConflictSeconds, " с")}</p>
                    <p>Транспорт: {event.vehicleId ?? "н/д"}</p>
                    <p>Швидкість: {formatMetric(event.speedKmh ?? null, " км/год")}</p>
                  </div>
                </article>
              ))}
            </div>
          </aside>
        </section>
      </section>
    </main>
  );
}