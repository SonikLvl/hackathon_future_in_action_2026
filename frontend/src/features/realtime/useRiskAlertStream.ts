import { useEffect, useMemo, useRef, useState } from "react";

import { parseBraceletMessage } from "@/features/bracelet/parseBraceletMessage";
import type { BraceletAlert, BraceletConnectionStatus } from "@/features/bracelet/types";

const DEFAULT_WS_URL = "ws://localhost:8000";
const DEFAULT_CLIENT_ID = "pedestrian_1";
const DEFAULT_RECONNECT_DELAY_MS = 1500;
const DEFAULT_HISTORY_LIMIT = 12;

type UseRiskAlertStreamOptions = {
  clientId?: string;
  historyLimit?: number;
  reconnectDelayMs?: number;
};

function getWsBaseUrl(): string {
  return import.meta.env.VITE_WS_URL ?? DEFAULT_WS_URL;
}

function getWsClientId(explicitClientId?: string): string {
  return explicitClientId ?? import.meta.env.VITE_BRACELET_CLIENT_ID ?? DEFAULT_CLIENT_ID;
}

function buildWsUrl(clientId?: string): string {
  return `${getWsBaseUrl()}/ws/${getWsClientId(clientId)}`;
}

export function useRiskAlertStream(options: UseRiskAlertStreamOptions = {}) {
  const historyLimit = options.historyLimit ?? DEFAULT_HISTORY_LIMIT;
  const reconnectDelayMs = options.reconnectDelayMs ?? DEFAULT_RECONNECT_DELAY_MS;

  const [status, setStatus] = useState<BraceletConnectionStatus>("connecting");
  const [latestAlert, setLatestAlert] = useState<BraceletAlert | null>(null);
  const [alertHistory, setAlertHistory] = useState<BraceletAlert[]>([]);
  const [lastMessageAt, setLastMessageAt] = useState<number | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    let shouldReconnect = true;

    function clearReconnectTimeout() {
      if (reconnectTimeoutRef.current !== null) {
        window.clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    }

    function connect() {
      clearReconnectTimeout();

      const socket = new WebSocket(buildWsUrl(options.clientId));
      socketRef.current = socket;

      setStatus((currentStatus) => (currentStatus === "connected" ? "connected" : "connecting"));

      socket.addEventListener("open", () => {
        setStatus("connected");
      });

      socket.addEventListener("message", (event: MessageEvent<string>) => {
        const parsedAlert = parseBraceletMessage(event.data);
        setLatestAlert(parsedAlert);
        setLastMessageAt(parsedAlert.receivedAt);
        setAlertHistory((currentHistory) => [parsedAlert, ...currentHistory].slice(0, historyLimit));
      });

      socket.addEventListener("close", () => {
        if (!shouldReconnect) {
          setStatus("disconnected");
          return;
        }

        setStatus("reconnecting");
        reconnectTimeoutRef.current = window.setTimeout(connect, reconnectDelayMs);
      });

      socket.addEventListener("error", () => {
        socket.close();
      });
    }

    connect();

    return () => {
      shouldReconnect = false;
      clearReconnectTimeout();
      socketRef.current?.close();
    };
  }, [historyLimit, options.clientId, reconnectDelayMs]);

  const isConnected = useMemo(() => status === "connected", [status]);

  return {
    status,
    isConnected,
    latestAlert,
    alertHistory,
    lastMessageAt,
    clearLatestAlert: () => setLatestAlert(null),
    clearAlertHistory: () => setAlertHistory([]),
  };
}
