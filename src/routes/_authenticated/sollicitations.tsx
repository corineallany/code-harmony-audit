import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { AppShell, EmptyState } from "@/components/AppShell";
import { formatDate, logAction, solicitationsQuery, STATUS_LABEL } from "@/lib/icc";
import { useCurrentRole } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/sollicitations")({
  head: () => ({
    meta: [
      { title: "Sollicitations — COM ICC Le Mans" },
      {
        name: "description",
        content: "Suivi des sollicitations adressées au pôle Communication : demandeur, échéance et décision.",
      },
      { property: "og:title", content: "Sollicitations — COM ICC Le Mans" },
      { property: "og:description", content: "Demandes reçues par le pôle Communication et leur décision." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Sollicitations,
});

function Sollicitations() {
  const solicitations = useQuery(solicitationsQuery);
  const { isStaff, member } = useCurrentRole();
  const queryClient = useQueryClient();

  const decide = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "accepted" | "refused" }) => {
      const { error } = await supabase
        .from("solicitations")
        .update({ status, decided_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw new Error(error.message);
      await supabase.from("solicitation_decision_history").insert({
        id: `d${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
        solicitation_id: id,
        status,
        actor_name: member?.full_name ?? null,
      });
      await logAction({
        action: "decision_sollicitation",
        entity: "solicitation",
        entityId: id,
        detail: STATUS_LABEL[status],
        actorName: member?.full_name,
      });
    },
    onSuccess: () => {
      toast.success("Décision enregistrée");
      queryClient.invalidateQueries({ queryKey: ["solicitations"] });
    },
    onError: (error: Error) => toast.error("Action impossible", { description: error.message }),
  });

  if (solicitations.isLoading) {
    return (
      <AppShell title="Sollicitations">
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Sollicitations" subtitle="Demandes reçues par le pôle">
      {(solicitations.data ?? []).length === 0 ? (
        <EmptyState title="Aucune sollicitation" />
      ) : (
        <div className="space-y-4">
          {(solicitations.data ?? []).map((s) => (
            <Card key={s.id}>
              <CardHeader className="gap-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">{s.title}</CardTitle>
                  <Badge variant={s.status === "pending" ? "outline" : "secondary"}>
                    {STATUS_LABEL[s.status] ?? s.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {s.requester ?? "Demandeur inconnu"} · {formatDate(s.event_date)}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {s.description ? <p className="text-sm">{s.description}</p> : null}
                {isStaff && s.status === "pending" ? (
                  <div className="flex gap-2">
                    <Button size="sm" disabled={decide.isPending} onClick={() => decide.mutate({ id: s.id, status: "accepted" })}>
                      Accepter
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={decide.isPending}
                      onClick={() => decide.mutate({ id: s.id, status: "refused" })}
                    >
                      Refuser
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
