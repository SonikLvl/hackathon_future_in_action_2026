import { useCallback, useEffect, useRef, useState } from "react";

import { parseBraceletMessage } from "@/features/bracelet/parseBraceletMessage";
import type { BraceletAlert, BraceletConnectionStatus } from "@/features/bracelet/types";

const DEFAULT_WS_URL = "ws://localhost:8000";
const DEFAULT_CLIENT_ID = "pedestrian_1";
const RECONNECT_DELAY_MS = 1500;

function getBraceletWsUrl(): string {
  const wsBaseUrl = import.meta.env.VITE_WS_URL ?? DEFAULT_WS_URL;
  const clientId = import.meta.env.VITE_BRACELET_CLIENT_ID ?? DEFAULT_CLIENT_ID;

  return `${wsBaseUrl}/ws/${clientId}`;
}

export function useBraceletSocket() {
  const [status, setStatus] = useState<BraceletConnectionStatus>("connecting");
  const [alert, setAlert] = useState<BraceletAlert | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const clearAlert = useCallback(() => {
    setAlert(null);
  }, []);

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

      const socket = new WebSocket(getBraceletWsUrl());

      socketRef.current = socket;
      setStatus((currentStatus) => (currentStatus === "connected" ? "connected" : "connecting"));

      socket.addEventListener("open", () => {
        setStatus("connected");
      });

      socket.addEventListener("message", (event: MessageEvent<string>) => {
        const nextAlert = parseBraceletMessage(event.data);
        setAlert(nextAlert);
      });

      socket.addEventListener("close", () => {
        if (!shouldReconnect) {
          setStatus("disconnected");
          return;
        }

        setStatus("reconnecting");
        reconnectTimeoutRef.current = window.setTimeout(connect, RECONNECT_DELAY_MS);
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
  }, []);

  return {
    status,
    alert,
    clearAlert,
  };
}
