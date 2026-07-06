import { BraceletPage } from "@/pages/bracelet/BraceletPage";

/**
 * A presentation-only wrapper that renders the live `/bracelet` screen inside a
 * realistic device mockup. Intended for screen recordings and slides where a bare
 * full-page bracelet would look out of place.
 */
export function BraceletPreviewPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-10 overflow-hidden bg-slate-950 px-6 py-12">
      {/* Ambient backdrop: soft glow + faint grid */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(56,189,248,0.14),transparent_62%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.5] [background-image:linear-gradient(rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.05)_1px,transparent_1px)] [background-size:44px_44px]" />

      <div className="relative">
        {/* Side buttons */}
        <div className="absolute -left-[6px] top-[6rem] h-9 w-[6px] rounded-l-md bg-slate-700/90" />
        <div className="absolute -left-[6px] top-[9.5rem] h-16 w-[6px] rounded-l-md bg-slate-700/90" />
        <div className="absolute -left-[6px] top-[13.5rem] h-16 w-[6px] rounded-l-md bg-slate-700/90" />
        <div className="absolute -right-[6px] top-[10.5rem] h-24 w-[6px] rounded-r-md bg-slate-700/90" />

        {/* Device body */}
        <div className="relative h-[45rem] w-[22rem] rounded-[3.2rem] border-[6px] border-slate-800 bg-slate-950 p-[3px] shadow-[0_45px_120px_-25px_rgba(0,0,0,0.9)] ring-1 ring-white/10">
          <div className="relative h-full w-full overflow-hidden rounded-[2.9rem] bg-black">
            <BraceletPage embedded />

            {/* Dynamic-island notch */}
            <div className="pointer-events-none absolute left-1/2 top-3 z-10 h-7 w-28 -translate-x-1/2 rounded-full bg-black/90 ring-1 ring-white/10">
              <div className="absolute right-4 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-slate-700 ring-1 ring-white/10" />
            </div>

            {/* Screen glare */}
            <div className="pointer-events-none absolute inset-0 rounded-[2.9rem] bg-[linear-gradient(140deg,rgba(255,255,255,0.10),transparent_34%)]" />

            {/* Home indicator */}
            <div className="pointer-events-none absolute bottom-2 left-1/2 z-10 h-1 w-28 -translate-x-1/2 rounded-full bg-white/50" />
          </div>
        </div>
      </div>

      <div className="relative max-w-sm text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.32em] text-slate-300">
          VARTA · прев&apos;ю пристрою
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          Дзеркало екрана <span className="font-mono text-slate-300">/bracelet</span> у корпусі
          пристрою — для запису відео та презентацій. Реагує на той самий потік подій у реальному
          часі.
        </p>
      </div>
    </main>
  );
}
