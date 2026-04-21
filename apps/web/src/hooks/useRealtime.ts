"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";

export interface MatchUpdate {
  id: string;
  status: string;
  compatibilityScore: number;
}

/**
 * 매칭 테이블 폴링 — Supabase Realtime 대체.
 * NotificationGateway(Socket.IO)가 붙으면 WebSocket 구독으로 바꿀 예정.
 *
 * - 30초마다 /matching 조회
 * - 이전과 비교해 새로 추가되거나 'notified' 상태가 된 매칭을 newMatch로 노출
 */
const POLL_INTERVAL_MS = 30_000;

export function useMatchRealtime(userId: string | undefined) {
  const token = useAuthStore((s) => s.token);
  const [newMatch, setNewMatch] = useState<MatchUpdate | null>(null);
  const knownIdsRef = useRef<Set<string>>(new Set());

  const clearNotification = useCallback(() => setNewMatch(null), []);

  useEffect(() => {
    if (!userId || !token) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const res = await apiClient<{ matches: { id: string; status: string; compatibilityScore: number }[] }>(
          '/matching',
          { token },
        );
        if (cancelled) return;

        const current = new Set(res.matches.map((m) => m.id));
        const previouslyEmpty = knownIdsRef.current.size === 0;

        for (const m of res.matches) {
          const isNew = !knownIdsRef.current.has(m.id);
          if (isNew && !previouslyEmpty && m.status === 'notified') {
            setNewMatch({ id: m.id, status: m.status, compatibilityScore: m.compatibilityScore });
            break;
          }
        }
        knownIdsRef.current = current;
      } catch {
        // 네트워크 실패 무시 — 다음 주기에 재시도
      }
    };

    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [userId, token]);

  return { newMatch, clearNotification };
}
