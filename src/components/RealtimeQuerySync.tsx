import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function RealtimeQuerySync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refreshVisibleData = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        queryClient.invalidateQueries({ refetchType: "active" });
      }, 200);
    };

    const channel = supabase
      .channel("icc-operational-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public" },
        refreshVisibleData,
      )
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return null;
}
