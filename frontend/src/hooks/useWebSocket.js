import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Custom hook for WebSocket connection to the backend.
 * Handles connection lifecycle, reconnection, and message parsing.
 */
export function useWebSocket(jobId) {
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const wsRef = useRef(null);

  const connect = useCallback(() => {
    if (!jobId) return;

    const wsUrl = `ws://localhost:8000/ws/${jobId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      console.log(`WebSocket connected: ${wsUrl}`);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.stage !== "keepalive") {
          setMessages((prev) => [...prev, msg]);
          setLastMessage(msg);
        }
      } catch (e) {
        console.error("Failed to parse WebSocket message:", e);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      console.log("WebSocket disconnected");
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    return ws;
  }, [jobId]);

  useEffect(() => {
    const ws = connect();
    return () => {
      if (ws) ws.close();
    };
  }, [connect]);

  const sendMessage = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof data === "string" ? data : JSON.stringify(data));
    }
  }, []);

  return { messages, lastMessage, isConnected, sendMessage };
}
