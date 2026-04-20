"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface MatchUpdate {
  id: string;
  status: string;
  compatibility_score: number;
}

/**
 * Supabase Realtime으로 매칭 알림을 구독한다.
 */
export function useMatchRealtime(userId: string | undefined) {
  const [newMatch, setNewMatch] = useState<MatchUpdate | null>(null);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  const clearNotification = useCallback(() => {
    setNewMatch(null);
  }, []);

  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();

    // matches 테이블의 변경을 구독
    const ch = supabase
      .channel(`matches:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matches",
          filter: `user_a_id=eq.${userId}`,
        },
        (payload) => {
          const record = payload.new as Record<string, unknown>;
          if (record) {
            setNewMatch({
              id: record.id as string,
              status: record.status as string,
              compatibility_score: record.compatibility_score as number,
            });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matches",
          filter: `user_b_id=eq.${userId}`,
        },
        (payload) => {
          const record = payload.new as Record<string, unknown>;
          if (record) {
            setNewMatch({
              id: record.id as string,
              status: record.status as string,
              compatibility_score: record.compatibility_score as number,
            });
          }
        }
      )
      .subscribe();

    setChannel(ch);

    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId]);

  return { newMatch, clearNotification };
}
