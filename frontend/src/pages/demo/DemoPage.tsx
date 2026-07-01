import type { ScenarioStatus } from "@/features/demo/types";
import { useScenarioRunner } from "@/features/demo/useScenarioRunner";

const statusLabel: Record<ScenarioStatus, string> = {
  idle: "Ready",
  running: "Scenario running",
  completed: "Scenario completed",
  error: "Error",
};

const statusClassName: Record<ScenarioStatus, string> = {
  idle: "border-slate-700 bg-slate-900 text-slate-100",
  running: "border-cyan-500/40 bg-cyan-950 text-cyan-50",
  completed: "border-emerald-500/40 bg-emerald-950 text-emerald-50",
  error: "border-red-500/40 bg-red-950 text-red-50",
};

function formatCoordinate(value: number): string {
  return value.toFixed(6);
}

export function DemoPage() {
  const { status, isRunning, lastFrame, errorMessage, runScenario, resetScenario } =
    useScenarioRunner();

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-50">
      <section className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-3">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
            VARTA Demo Console
          </p>

          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
                Vehicle Alert Scenario
              </h1>
              <p className="mt-3 max-w-2xl text-lg text-slate-300">
                Start a simulated scooter approach from the laptop console. The backend receives
                telemetry, calculates risk, and sends the alert to the phone bracelet prototype.
              </p>
            </div>

            <div
              className={`rounded-2xl border px-5 py-4 text-sm font-semibold ${statusClassName[status]}`}
            >
              {statusLabel[status]}
            </div>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-white/10 bg-white/4 p-6 shadow-2xl shadow-black/20">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-bold">Scooter approaching pedestrian</h2>
                <p className="mt-2 text-slate-300">
                  This scenario sends live telemetry for{" "}
                  <span className="font-semibold text-white">pedestrian_1</span> and{" "}
                  <span className="font-semibold text-white">scooter_1</span>.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  className="rounded-full bg-cyan-300 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
                  type="button"
                  disabled={isRunning}
                  onClick={runScenario}
                >
                  Start scenario
                </button>

                <button
                  className="rounded-full border border-white/20 px-5 py-3 font-semibold text-white transition hover:bg-white/10"
                  type="button"
                  onClick={resetScenario}
                >
                  Reset
                </button>
              </div>
            </div>

            <div className="mt-8 rounded-2xl border border-white/10 bg-slate-950/70 p-5">
              <p className="text-sm uppercase tracking-[0.25em] text-slate-400">Current frame</p>

              <h3 className="mt-3 text-2xl font-bold">{lastFrame?.label ?? "Waiting"}</h3>

              <p className="mt-2 text-slate-300">
                {lastFrame?.description ?? "Open /bracelet, then start the scenario."}
              </p>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl bg-white/4 p-4">
                  <p className="text-sm text-slate-400">Estimated distance</p>
                  <p className="mt-2 text-3xl font-bold">
                    {lastFrame ? `${lastFrame.distanceMeters} m` : "—"}
                  </p>
                </div>

                <div className="rounded-2xl bg-white/4 p-4">
                  <p className="text-sm text-slate-400">Vehicle speed</p>
                  <p className="mt-2 text-3xl font-bold">
                    {lastFrame ? `${lastFrame.vehicle.speed} m/s` : "—"}
                  </p>
                </div>

                <div className="rounded-2xl bg-white/4 p-4">
                  <p className="text-sm text-slate-400">Vehicle azimuth</p>
                  <p className="mt-2 text-3xl font-bold">
                    {lastFrame ? `${lastFrame.vehicle.azimuth}°` : "—"}
                  </p>
                </div>
              </div>

              {errorMessage ? (
                <p className="mt-5 rounded-2xl border border-red-500/40 bg-red-950 p-4 text-red-50">
                  {errorMessage}
                </p>
              ) : null}
            </div>
          </div>

          <aside className="rounded-3xl border border-white/10 bg-white/4 p-6">
            <h2 className="text-2xl font-bold">Live telemetry</h2>

            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
                <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Pedestrian</p>
                <p className="mt-2 text-xl font-semibold">pedestrian_1</p>
                <p className="mt-3 text-sm text-slate-300">
                  Lat: {lastFrame ? formatCoordinate(lastFrame.pedestrian.lat) : "—"}
                </p>
                <p className="text-sm text-slate-300">
                  Lon: {lastFrame ? formatCoordinate(lastFrame.pedestrian.lon) : "—"}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
                <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Vehicle</p>
                <p className="mt-2 text-xl font-semibold">scooter_1</p>
                <p className="mt-3 text-sm text-slate-300">
                  Lat: {lastFrame ? formatCoordinate(lastFrame.vehicle.lat) : "—"}
                </p>
                <p className="text-sm text-slate-300">
                  Lon: {lastFrame ? formatCoordinate(lastFrame.vehicle.lon) : "—"}
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-cyan-400/20 bg-cyan-950/40 p-5 text-cyan-50">
              <p className="font-semibold">Demo instruction</p>
              <p className="mt-2 text-sm leading-6 text-cyan-100">
                Keep the bracelet page open in another window or on your phone. When the scooter
                enters the risk zone, the bracelet should switch to High alert.
              </p>
            </div>
          </aside>
        </section>
      </section>
    </main>
  );
}
