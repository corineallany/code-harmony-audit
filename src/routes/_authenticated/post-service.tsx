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
  attendanceQuery,
  COMPLETION_LABEL,
  debriefsQuery,
  formatDate,
  INCIDENT_TYPES,
  logAction,
  membersQuery,
  PRESENCE_LABEL,
  programsQuery,
  RESPONSE_LABEL,
  type ProgramDebrief,
} from "@/lib/icc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/post-service")({
  head: () => ({
    meta: [
      { title: "Post-service — COM ICC Le Mans" },
      {
        name: "description",
        content:
          "Comptes rendus post-service du pôle Communication : réalisation, horaires réels, présence réelle, incidents et remontée Direction.",
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
  component: PostService,
});

type PresenceDraft = { member_id: string; presence: string; note: string };

type Draft = {
  id: string | null;
  program_id: string;
  summary: string;
  went_well: string;
  to_improve: string;
  attendance_note: string;
  rating: number;
  actual_start: string;
  actual_end: string;
  completion: string;
  difficulties: string;
  needs: string;
  to_direction: boolean;
  incident_type: string;
  incident_detail: string;
  presences: PresenceDraft[];
};

function PostService() {
  const programs = useQuery(programsQuery);
  const debriefs = useQuery(debriefsQuery);
  const attendance = useQuery(attendanceQuery);
  const membersData = useQuery(membersQuery);
  const queryClient = useQueryClient();
  const { member, userId, isStaff } = useCurrentRole();
  const [draft, setDraft] = useState<Draft | null>(null);

  const memberName = (id: string) =>
    membersData.data?.members.find((m) => m.id === id)?.full_name ?? "Membre";

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
        actual_start: value.actual_start.trim() || null,
        actual_end: value.actual_end.trim() || null,
        completion: value.completion,
        difficulties: value.difficulties.trim() || null,
        needs: value.needs.trim() || null,
        to_direction: value.to_direction,
        incident_type: value.incident_type || null,
        incident_detail: value.incident_detail.trim() || null,
      };
      if (value.id) {
        const { error } = await supabase.from("program_debriefs").update(payload).eq("id", value.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("program_debriefs").insert(payload);
        if (error) throw new Error(error.message);
      }

      // Présence réelle : une seule source, on remplace les lignes du programme.
      const { error: delError } = await supabase
        .from("program_attendance")
        .delete()
        .eq("program_id", value.program_id);
      if (delError) throw new Error(delError.message);
      const rows = value.presences
        .filter((p) => p.presence)
        .map((p) => ({
          program_id: value.program_id,
          member_id: p.member_id,
          presence: p.presence,
          is_reinforcement: p.presence === "renfort",
          note: p.note.trim() || null,
          recorded_by: userId ?? null,
        }));
      if (rows.length) {
        const { error } = await supabase.from("program_attendance").insert(rows);
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
      queryClient.invalidateQueries({ queryKey: ["program-attendance"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function openDraft(programId: string, debrief: ProgramDebrief | undefined) {
    const program = past.find((p) => p.id === programId);
    const assigned = Array.from(
      new Set((program?.assignments ?? []).flatMap((a) => a.memberIds)),
    );
    const rows = (attendance.data ?? []).filter((a) => a.program_id === programId);
    const presences: PresenceDraft[] = assigned.map((id) => {
      const row = rows.find((r) => r.member_id === id);
      return { member_id: id, presence: row?.presence ?? "present", note: row?.note ?? "" };
    });
    for (const row of rows) {
      if (!presences.some((p) => p.member_id === row.member_id)) {
        presences.push({ member_id: row.member_id, presence: row.presence, note: row.note ?? "" });
      }
    }
    setDraft({
      id: debrief?.id ?? null,
      program_id: programId,
      summary: debrief?.summary ?? "",
      went_well: debrief?.went_well ?? "",
      to_improve: debrief?.to_improve ?? "",
      attendance_note: debrief?.attendance_note ?? "",
      rating: debrief?.rating ?? 0,
      actual_start: debrief?.actual_start ?? "",
      actual_end: debrief?.actual_end ?? "",
      completion: debrief?.completion ?? "total",
      difficulties: debrief?.difficulties ?? "",
      needs: debrief?.needs ?? "",
      to_direction: debrief?.to_direction ?? false,
      incident_type: debrief?.incident_type ?? "",
      incident_detail: debrief?.incident_detail ?? "",
      presences,
    });
  }

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
            const rows = (attendance.data ?? []).filter((a) => a.program_id === program.id);
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
                      {debrief?.to_direction ? <Badge>Remonté à la Direction</Badge> : null}
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
                      <p className="text-xs text-muted-foreground">
                        {COMPLETION_LABEL[debrief.completion] ?? debrief.completion}
                        {debrief.actual_start || debrief.actual_end
                          ? ` · Horaires réels ${debrief.actual_start ?? "?"} → ${debrief.actual_end ?? "?"}`
                          : ""}
                      </p>
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
                      {debrief.difficulties ? (
                        <p>
                          <span className="font-bold">Difficultés :</span> {debrief.difficulties}
                        </p>
                      ) : null}
                      {debrief.needs ? (
                        <p>
                          <span className="font-bold">Besoins :</span> {debrief.needs}
                        </p>
                      ) : null}
                      {debrief.incident_type ? (
                        <p className="text-destructive">
                          <span className="font-bold">Incident {debrief.incident_type} :</span>{" "}
                          {debrief.incident_detail ?? "—"}
                        </p>
                      ) : null}
                      {debrief.attendance_note ? (
                        <p className="text-muted-foreground">Présence : {debrief.attendance_note}</p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Aucun compte rendu pour ce programme.</p>
                  )}

                  {rows.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {rows.map((r) => (
                        <Badge key={r.id} variant="outline">
                          {memberName(r.member_id)} · {PRESENCE_LABEL[r.presence] ?? r.presence}
                        </Badge>
                      ))}
                    </div>
                  ) : null}

                  {isStaff ? (
                    <Button
                      size="sm"
                      variant={debrief ? "outline" : "default"}
                      className="gap-1"
                      onClick={() => openDraft(program.id, debrief)}
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
              <div className="grid grid-cols-2 gap-3">
                <Field label="Début réel">
                  <Input
                    type="time"
                    value={draft.actual_start}
                    onChange={(e) => setDraft({ ...draft, actual_start: e.target.value })}
                  />
                </Field>
                <Field label="Fin réelle">
                  <Input
                    type="time"
                    value={draft.actual_end}
                    onChange={(e) => setDraft({ ...draft, actual_end: e.target.value })}
                  />
                </Field>
              </div>

              <Field label="Réalisation">
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(COMPLETION_LABEL).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setDraft({ ...draft, completion: key })}
                      className={
                        draft.completion === key
                          ? "rounded-lg bg-icc-violet px-3 py-1.5 text-xs font-bold text-white"
                          : "rounded-lg border border-input px-3 py-1.5 text-xs"
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </Field>

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

              <Field label="Présence réelle">
                {draft.presences.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Aucun membre affecté à ce programme.</p>
                ) : (
                  <div className="space-y-2">
                    {draft.presences.map((p, index) => (
                      <div key={p.member_id} className="rounded-xl border border-border p-2">
                        <p className="text-xs font-bold">{memberName(p.member_id)}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {Object.entries(PRESENCE_LABEL).map(([key, label]) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => {
                                const next = [...draft.presences];
                                next[index] = { ...p, presence: key };
                                setDraft({ ...draft, presences: next });
                              }}
                              className={
                                p.presence === key
                                  ? "rounded-md bg-icc-violet px-2 py-1 text-[10px] font-bold text-white"
                                  : "rounded-md border border-input px-2 py-1 text-[10px]"
                              }
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        <Input
                          className="mt-1.5 h-8 text-xs"
                          placeholder="Remarque (facultatif)"
                          value={p.note}
                          onChange={(e) => {
                            const next = [...draft.presences];
                            next[index] = { ...p, note: e.target.value };
                            setDraft({ ...draft, presences: next });
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
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
              <Field label="Difficultés rencontrées">
                <Textarea
                  rows={2}
                  value={draft.difficulties}
                  onChange={(e) => setDraft({ ...draft, difficulties: e.target.value })}
                />
              </Field>
              <Field label="Besoins pour la prochaine fois">
                <Textarea
                  rows={2}
                  value={draft.needs}
                  onChange={(e) => setDraft({ ...draft, needs: e.target.value })}
                />
              </Field>

              <Field label="Incident éventuel">
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDraft({ ...draft, incident_type: "", incident_detail: "" })}
                    className={
                      draft.incident_type === ""
                        ? "rounded-lg bg-icc-violet px-3 py-1.5 text-xs font-bold text-white"
                        : "rounded-lg border border-input px-3 py-1.5 text-xs"
                    }
                  >
                    Aucun
                  </button>
                  {INCIDENT_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setDraft({ ...draft, incident_type: type })}
                      className={
                        draft.incident_type === type
                          ? "rounded-lg bg-icc-violet px-3 py-1.5 text-xs font-bold text-white"
                          : "rounded-lg border border-input px-3 py-1.5 text-xs"
                      }
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </Field>
              {draft.incident_type ? (
                <Field label="Détail de l'incident">
                  <Textarea
                    rows={2}
                    value={draft.incident_detail}
                    onChange={(e) => setDraft({ ...draft, incident_detail: e.target.value })}
                  />
                </Field>
              ) : null}

              <Field label="Remarques de présence">
                <Textarea
                  rows={2}
                  value={draft.attendance_note}
                  onChange={(e) => setDraft({ ...draft, attendance_note: e.target.value })}
                />
              </Field>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.to_direction}
                  onChange={(e) => setDraft({ ...draft, to_direction: e.target.checked })}
                />
                À remonter à la Direction
              </label>
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
