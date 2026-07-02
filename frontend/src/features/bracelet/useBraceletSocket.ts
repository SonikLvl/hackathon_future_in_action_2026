import { useCallback } from "react";

import { useRiskAlertStream } from "@/features/realtime/useRiskAlertStream";

export function useBraceletSocket() {
  const { status, latestAlert, clearLatestAlert } = useRiskAlertStream({
    historyLimit: 1,
  });

  const clearAlert = useCallback(() => {
    clearLatestAlert();
  }, [clearLatestAlert]);

  return {
    status,
    alert: latestAlert,
    clearAlert,
  };
}
