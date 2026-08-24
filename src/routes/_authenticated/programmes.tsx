import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell, EmptyState } from "@/components/AppShell";
import {
  formatDate,
  logAction,
  membersQuery,
  polesQuery,
  programsQuery,
  RESPONSE_LABEL,
  STATUS_LABEL,
  type ResponseStatus,
} from "@/lib/icc";
import { useCurrentRole } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/programmes")({
  head: () => ({
    meta: [
      { title: "Programmes — COM ICC Le Mans" },
      {
        name: "description",
        content: "Programmes du pôle Communication : affectations par pôle, tâches et disponibilités des équipiers.",
      },
      { property: "og:title", content: "Programmes — COM ICC Le Mans" },
      { property: "og:description", content: "Affectations par pôle, tâches et réponses de disponibilité." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Programmes,
});

const RESPONSES: ResponseStatus[] = ["available", "partial", "unavailable"];

function Programmes() {
  const programs = useQuery(programsQuery);
  const poles = useQuery(polesQuery);
  const members = useQuery(membersQuery);
  const { member } = useCurrentRole();
  const queryClient = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);

  const poleName = useMemo(() => new Map((poles.data ?? []).map((p) => [p.id, p.name])), [poles.data]);
  const memberName = useMemo(
    () => new Map((members.data?.members ?? []).map((m) => [m.id, m.full_name])),
    [members.data],
  );

  /** Une seule voie d'écriture pour la réponse de disponibilité (upsert idempotent). */
  const respond = useMutation({
    mutationFn: async ({ programId, status }: { programId: string; status: ResponseStatus }) => {
      if (!member?.id) throw new Error("Votre compte n'est lié à aucun équipier.");
      const { error } = await supabase.from("program_member_responses").upsert(
        {
          id: `${programId}__${member.id}`,
          program_id: programId,
          member_id: member.id,
          status,
          responded_at: new Date().toISOString(),
        },
        { onConflict: "program_id,member_id" },
      );
      if (error) throw new Error(error.message);
      await logAction({
        action: "reponse_disponibilite",
        entity: "program",
        entityId: programId,
        detail: RESPONSE_LABEL[status],
        actorName: member.full_name,
      });
    },
    onSuccess: () => {
      toast.success("Réponse enregistrée");
      queryClient.invalidateQueries({ queryKey: ["programs"] });
    },
    onError: (error: Error) => toast.error("Enregistrement impossible", { description: error.message }),
  });

  if (programs.isLoading) {
    return (
      <AppShell title="Programmes">
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Programmes" subtitle="Affectations par pôle et disponibilités">
      {(programs.data ?? []).length === 0 ? (
        <EmptyState title="Aucun programme" />
      ) : (
        <div className="space-y-4">
          {(programs.data ?? []).map((program) => {
            const mine = program.responses.find((r) => r.member_id === member?.id);
            const open = openId === program.id;
            return (
              <Card key={program.id}>
                <CardHeader className="gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base">{program.title}</CardTitle>
                    <Badge variant="secondary">{STATUS_LABEL[program.status] ?? program.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(program.start_date)}
                    {program.location ? ` · ${program.location}` : ""}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {RESPONSES.map((status) => (
                      <Button
                        key={status}
                        size="sm"
                        variant={mine?.status === status ? "default" : "outline"}
                        disabled={respond.isPending || !member?.id}
                        onClick={() => respond.mutate({ programId: program.id, status })}
                      >
                        {RESPONSE_LABEL[status]}
                      </Button>
                    ))}
                  </div>

                  <Button variant="ghost" size="sm" onClick={() => setOpenId(open ? null : program.id)}>
                    {open ? "Masquer le détail" : `Détail (${program.assignments.length} pôle(s))`}
                  </Button>

                  {open ? (
                    <div className="space-y-3 border-t border-border pt-3">
                      {program.assignments.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Aucun pôle affecté.</p>
                      ) : (
                        program.assignments.map((a) => (
                          <div key={a.id} className="rounded-lg bg-muted/60 p-3">
                            <p className="font-medium">{poleName.get(a.pole_id) ?? "Pôle inconnu"}</p>
                            {a.tasks ? <p className="mt-1 text-sm text-muted-foreground">{a.tasks}</p> : null}
                            {a.memberIds.length > 0 ? (
                              <p className="mt-1 text-sm">
                                {a.memberIds.map((id) => memberName.get(id) ?? id).join(", ")}
                              </p>
                            ) : null}
                          </div>
                        ))
                      )}

                      {program.responses.length > 0 ? (
                        <div>
                          <p className="text-sm font-semibold">Réponses</p>
                          <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                            {program.responses.map((r) => (
                              <li key={r.member_id}>
                                {memberName.get(r.member_id) ?? r.member_id} — {RESPONSE_LABEL[r.status]}
                                {r.reason ? ` (${r.reason})` : ""}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
