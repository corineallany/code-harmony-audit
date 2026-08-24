import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { AppShell, EmptyState } from "@/components/AppShell";
import { Field } from "@/components/admin/form-kit";
import { useCurrentRole } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  debriefsQuery,
  formatDate,
  logAction,
  programsQuery,
  RESPONSE_LABEL,
  type ProgramDebrief,
} from "@/lib/icc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/post-service")({
  head: () => ({
    meta: [
      { title: "Post-service — COM ICC Le Mans" },
      {
        name: "description",
        content:
          "Comptes rendus post-service du pôle Communication : synthèse du programme réalisé, points forts, points à améliorer et présence.",
      },
      { property: "og:title", content: "Post-service — COM ICC Le Mans" },
      {
        property: "og:description",
        content: "Débrief structuré après chaque programme réalisé, rattaché à la fiche programme.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PostService;
});

type Draft = {
  id: string | null;
  program_id: string;
  summary: string;
  went_well: string;
  to_improve: string;
  attendance_note: string;
  rating: number;
};

function PostService() {
  const programs = useQuery(programsQuery);
  const debriefs = useQuery(debriefsQuery);
  const queryClient = useQueryClient();
  const { member, userId, isStaff } = useCurrentRole();
  const [draft, setDraft] = useState<Draft | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const past = (programs.data ?? [])
    .filter((p) => !p.archived && (p.start_date ?? "9999") <= today)
    .sort((a, b) => (b.start_date ?? "").localeCompare(a.start_date ?? ""))
    .slice(0, 30);
  const byProgram = new Map<string, ProgramDebrief>();
  for (const d of debriefs.data ?? []) if (!byProgram.has(d.program_id)) byProgram.set(d.program_id, d);

  const save = useMutation({
    mutationFn: async (value: Draft) => {
      const payload = {
        program_id: value.program_id,
        author_member_id: member?.id ?? null,
        created_by: userId ?? null,
        summary: value.summary.trim() || null,
        went_well: value.went_well.trim() || null,
        to_improve: value.to_improve.trim() || null,
        attendance_note: value.attendance_note.trim() || null,
        rating: value.rating || null,
      };
      if (value.id) {
        const { error } = await supabase.from("program_debriefs").update(payload).eq("id", value.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("program_debriefs").insert(payload);
        if (error) throw new Error(error.message);
      }
      await logAction({
        action: value.id ? "post_service_modifie" : "post_service_cree",
        entity: "program_debrief",
        entityId: value.program_id,
        actorName: member?.full_name,
      });
    },
    onSuccess: () => {
      toast.success("Compte rendu enregistré");
      setDraft(null);
      queryClient.invalidateQueries({ queryKey: ["program-debriefs"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const loading = programs.isLoading || debriefs.isLoading;

  return (
    <AppShell title="Post-service" subtitle="Débrief des programmes réalisés, rattaché au programme">
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : past.length === 0 ? (
        <EmptyState title="Aucun programme passé" description="Le débrief s'ouvre après la date du programme." />
      ) : (
        <div className="space-y-3">
          {past.map((program) => {
            const debrief = byProgram.get(program.id);
            const counts = program.responses.reduce<Record<string, number>>((acc, r) => {
              acc[r.status] = (acc[r.status] ?? 0) + 1;
              return acc;
            }, {});
            return (
              <Card key={program.id}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{program.title}</CardTitle>
                      <p className="text-xs text-muted-foreground">{formatDate(program.start_date)}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(counts).map(([status, count]) => (
                        <Badge key={status} variant="outline">
                          {RESPONSE_LABEL[status as keyof typeof RESPONSE_LABEL] ?? status} : {count}
                        </Badge>
                      ))}
                      {debrief?.rating ? (
                        <Badge variant="secondary">{debrief.rating}/5</Badge>
                      ) : (
                        <Badge variant="secondary">Débrief manquant</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {debrief ? (
                    <div className="space-y-1.5 text-sm">
                      {debrief.summary ? <p>{debrief.summary}</p> : null}
                      {debrief.went_well ? (
                        <p>
                          <span className="font-bold text-emerald-700">A bien fonctionné :</span>{" "}
                          {debrief.went_well}
                        </p>
                      ) : null}
                      {debrief.to_improve ? (
                        <p>
                          <span className="font-bold text-amber-700">À améliorer :</span> {debrief.to_improve}
                        </p>
                      ) : null}
                      {debrief.attendance_note ? (
                        <p className="text-muted-foreground">Présence : {debrief.attendance_note}</p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Aucun compte rendu pour ce programme.</p>
                  )}
                  {isStaff ? (
                    <Button
                      size="sm"
                      variant={debrief ? "outline" : "default"}
                      className="gap-1"
                      onClick={() =>
                        setDraft({
                          id: debrief?.id ?? null,
                          program_id: program.id,
                          summary: debrief?.summary ?? "",
                          went_well: debrief?.went_well ?? "",
                          to_improve: debrief?.to_improve ?? "",
                          attendance_note: debrief?.attendance_note ?? "",
                          rating: debrief?.rating ?? 0,
                        })
                      }
                    >
                      {debrief ? (
                        <>
                          <Pencil className="size-4" /> Modifier le débrief
                        </>
                      ) : (
                        <>
                          <Plus className="size-4" /> Rédiger le débrief
                        </>
                      )}
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!draft} onOpenChange={(open) => (open ? null : setDraft(null))}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Compte rendu post-service</DialogTitle>
          </DialogHeader>
          {draft ? (
            <div className="space-y-3">
              <Field label="Note globale">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setDraft({ ...draft, rating: n })}
                      className={
                        draft.rating === n
                          ? "size-8 rounded-md bg-icc-violet text-sm font-bold text-white"
                          : "size-8 rounded-md border border-input text-sm"
                      }
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Synthèse">
                <Textarea
                  rows={3}
                  value={draft.summary}
                  onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
                />
              </Field>
              <Field label="Ce qui a bien fonctionné">
                <Textarea
                  rows={2}
                  value={draft.went_well}
                  onChange={(e) => setDraft({ ...draft, went_well: e.target.value })}
                />
              </Field>
              <Field label="À améliorer">
                <Textarea
                  rows={2}
                  value={draft.to_improve}
                  onChange={(e) => setDraft({ ...draft, to_improve: e.target.value })}
                />
              </Field>
              <Field label="Remarques de présence">
                <Textarea
                  rows={2}
                  value={draft.attendance_note}
                  onChange={(e) => setDraft({ ...draft, attendance_note: e.target.value })}
                />
              </Field>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Annuler
            </Button>
            <Button disabled={save.isPending} onClick={() => draft && save.mutate(draft)}>
              {save.isPending ? "Synchronisation…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
