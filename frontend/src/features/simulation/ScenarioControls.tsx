import { useSimulationControl } from "@/features/realtime/useSimulationControl";

const phaseLabel: Record<string, string> = {
  idle: "Idle",
  running: "Running",
  stabilizing: "Stabilizing",
  finished: "Finished",
};

export function ScenarioControls() {
  const { scenarios, status, isBusy, error, start, stop } = useSimulationControl();
  const activeScenarioId = status.running ? status.scenarioId : null;

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-2xl shadow-black/30">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Demo scenarios</h2>
          <p className="mt-1 text-sm text-slate-300">
            Drive the console straight from here — no terminal needed.
          </p>
        </div>
        <div
          className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${
            status.running
              ? "border-cyan-500/40 bg-cyan-950/60 text-cyan-100"
              : "border-slate-600 bg-slate-900 text-slate-200"
          }`}
        >
          {phaseLabel[status.phase] ?? status.phase}
          {status.running ? ` · ${status.elapsedSeconds.toFixed(0)}s` : ""}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {scenarios.length === 0 ? (
          <p className="text-sm text-slate-400">
            No scenarios available. Is the backend running?
          </p>
        ) : null}

        {scenarios.map((scenario) => {
          const isActive = scenario.id === activeScenarioId;
          return (
            <button
              key={scenario.id}
              type="button"
              disabled={isBusy}
              onClick={() => void start(scenario.id)}
              className={`flex flex-col gap-1 rounded-2xl border p-4 text-left transition-colors disabled:opacity-60 ${
                isActive
                  ? "border-cyan-400/60 bg-cyan-950/50 text-cyan-50"
                  : "border-white/10 bg-slate-950/80 text-slate-100 hover:border-cyan-400/40 hover:bg-slate-900"
              }`}
            >
              <span className="flex items-center justify-between gap-2 font-semibold">
                {scenario.name}
                {isActive ? (
                  <span className="rounded-full bg-cyan-400/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] text-cyan-100">
                    Live
                  </span>
                ) : null}
              </span>
              <span className="text-xs leading-5 text-slate-400">{scenario.description}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={isBusy || !status.running}
          onClick={() => void stop()}
          className="rounded-full border border-red-400/40 bg-red-950/60 px-5 py-2 text-sm font-semibold text-red-100 transition-colors hover:bg-red-900/60 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Stop scenario
        </button>
        <p className="text-xs text-slate-400">
          Starting a scenario replaces any running one.
        </p>
        {error ? <p className="text-xs font-semibold text-red-300">{error}</p> : null}
      </div>
    </section>
  );
}
