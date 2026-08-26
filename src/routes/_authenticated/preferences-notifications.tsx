import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrentRole } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { NOTIFICATION_EVENTS, notificationPreferencesQuery } from "@/lib/icc";

export const Route = createFileRoute("/_authenticated/preferences-notifications")({ component: PreferencesNotifications });

function PreferencesNotifications() {
  const { userId } = useCurrentRole();
  const prefs = useQuery(notificationPreferencesQuery(userId));
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: async ({ event, field, value }: { event: string; field: "in_app" | "push"; value: boolean }) => {
      if (!userId) throw new Error("Session expirée.");
      const current = (prefs.data ?? []).find((p) => p.event_type === event);
      const { error } = await supabase.from("notification_preferences").upsert({ user_id: userId, event_type: event, in_app: field === "in_app" ? value : (current?.in_app ?? true), push: field === "push" ? value : (current?.push ?? true) }, { onConflict: "user_id,event_type" });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { toast.success("Préférence enregistrée"); qc.invalidateQueries({ queryKey: ["notification-preferences", userId] }); },
    onError: (e: Error) => toast.error("Enregistrement impossible", { description: e.message }),
  });
  const valueOf = (event: string, field: "in_app" | "push") => {
    const row = (prefs.data ?? []).find((p) => p.event_type === event);
    return row ? row[field] : true;
  };
  return <AppShell title="Préférences & notifications" subtitle="Choisissez les alertes que vous souhaitez recevoir">
    <Card><CardHeader><CardTitle className="text-base">Mes notifications</CardTitle></CardHeader><CardContent className="space-y-3">
      {NOTIFICATION_EVENTS.map((e) => <div key={e.key} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
        <span className="text-sm font-medium">{e.label}</span><div className="flex items-center gap-4 text-xs">
          <label className="flex items-center gap-2">Application <Switch checked={valueOf(e.key,"in_app")} onCheckedChange={(v)=>save.mutate({event:e.key,field:"in_app",value:v})}/></label>
          <label className="flex items-center gap-2">Push <Switch checked={valueOf(e.key,"push")} onCheckedChange={(v)=>save.mutate({event:e.key,field:"push",value:v})}/></label>
        </div></div>)}
    </CardContent></Card>
  </AppShell>;
}
