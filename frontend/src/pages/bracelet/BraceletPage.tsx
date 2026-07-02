import { useEffect } from "react";

import type { AlertDirection, AlertSeverity } from "@/features/bracelet/types";
import { useBraceletSocket } from "@/features/bracelet/useBraceletSocket";

const severityTitle: Record<AlertSeverity, string> = {
  safe: "Safe",
  caution: "Caution",
  warning: "Warning",
  critical: "Critical alert",
};

const severityClassName: Record<AlertSeverity, string> = {
  safe: "bg-emerald-950 text-emerald-50",
  caution: "bg-yellow-950 text-yellow-50",
  warning: "bg-orange-950 text-orange-50",
  critical: "bg-red-950 text-red-50",
};

const directionLabel: Record<AlertDirection, string> = {
  front: "Front",
  back: "Behind",
  left: "Left",
  right: "Right",
  unknown: "Nearby",
};

export function BraceletPage() {
  const { status, alert, clearAlert } = useBraceletSocket();

  const severity = alert?.severity ?? "safe";
  const isAlertActive = Boolean(alert);
  const hasMetrics = Boolean(
    alert && (alert.distanceMeters !== null || alert.timeToConflictSeconds !== null),
  );
  const distanceText =
    alert?.distanceMeters !== null && alert?.distanceMeters !== undefined
      ? `${alert.distanceMeters.toFixed(1)} m`
      : "Distance n/a";
  const ttcText =
    alert?.timeToConflictSeconds !== null && alert?.timeToConflictSeconds !== undefined
      ? `${alert.timeToConflictSeconds.toFixed(1)} s to conflict`
      : "TTC n/a";

  useEffect(() => {
    if (!alert) {
      return;
    }

    if ("vibrate" in navigator) {
      navigator.vibrate(alert.vibrationPattern);
    }
  }, [alert]);

  return (
    <main
      className={`flex min-h-screen items-center justify-center px-6 transition-colors duration-300 ${severityClassName[severity]}`}
    >
      <section
        className={`w-full max-w-sm text-center ${isAlertActive ? "bracelet-vibrating" : ""}`}
      >
        <p className="text-sm uppercase tracking-[0.3em] opacity-75">VARTA</p>

        <div className="mt-8 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm">
          WebSocket: {status}
        </div>

        <div className="mt-10">
          <p className="text-sm uppercase tracking-[0.25em] opacity-70">
            {alert ? directionLabel[alert.direction] : "Monitoring"}
          </p>

          <h1 className="mt-4 text-5xl font-bold tracking-tight">{severityTitle[severity]}</h1>

          <p className="mt-6 text-xl leading-relaxed">
            {alert?.message ?? "Bracelet prototype is waiting for alerts."}
          </p>

          {hasMetrics ? (
            <p className="mt-3 text-sm opacity-80">
              {distanceText} {" • "} {ttcText}
            </p>
          ) : null}
        </div>

        {isAlertActive ? (
          <button
            className="mt-10 rounded-full bg-white px-6 py-3 font-semibold text-slate-950"
            type="button"
            onClick={clearAlert}
          >
            Clear alert
          </button>
        ) : null}

        <p className="mt-10 text-xs uppercase tracking-[0.2em] opacity-60">
          Phone bracelet prototype
        </p>
      </section>
    </main>
  );
}
