"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useAuthStore } from "@/stores/authStore";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export interface MatchUpdate {
  id: string;
  status: string;
  compatibilityScore?: number;
}

/**
 * 백엔드 NotificationGateway(Socket.IO)로 실시간 매칭 이벤트 수신.
 *
 * 수신 이벤트:
 * - match:new        새 매칭 발견
 * - match:accepted   상대가 수락 (한 쪽)
 * - match:completed  양쪽 수락
 * - match:rejected   상대가 거절
 */
export function useMatchRealtime(userId: string | undefined) {
  const token = useAuthStore((s) => s.token);
  const [newMatch, setNewMatch] = useState<MatchUpdate | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const clearNotification = useCallback(() => setNewMatch(null), []);

  useEffect(() => {
    if (!userId || !token) return;

    const socket = io(API_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    const handleNew = (payload: MatchUpdate) => setNewMatch(payload);
    const handleAccepted = (payload: MatchUpdate) => setNewMatch(payload);
    const handleCompleted = (payload: MatchUpdate) => setNewMatch(payload);

    socket.on("match:new", handleNew);
    socket.on("match:accepted", handleAccepted);
    socket.on("match:completed", handleCompleted);

    return () => {
      socket.off("match:new", handleNew);
      socket.off("match:accepted", handleAccepted);
      socket.off("match:completed", handleCompleted);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [userId, token]);

  return { newMatch, clearNotification };
}
