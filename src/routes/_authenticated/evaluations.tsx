import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Send, ShieldCheck, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell, EmptyState } from "@/components/AppShell";
import { Field } from "@/components/admin/form-kit";
import { useCurrentRole } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { evaluationsQuery, formatDateTime, logAction, membersQuery } from "@/lib/icc";
import {
  asScores,
  averageScore,
  EVAL_CRITERIA,
  EVAL_KIND_LABEL,
  EVAL_STATUS_LABEL,
  type EvaluationKind,
  type EvaluationStatus,
  type Scores,
} from "@/lib/evaluations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/evaluations")({
  head: () => ({
    meta: [
      { title: "Évaluations — COM ICC Le Mans" },
      {
        name: "description",
        content:
          "Circuit d'évaluation du pôle Communication : critères opérationnels, rôle de référent et leadership, avec validation par la direction.",
      },
      { property: "og:title", content: "Évaluations — COM ICC Le Mans" },
      {
        property: "og:description",
        content: "Rédaction, soumission, révision et validation des évaluations selon les droits.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Evaluations,
});

type Draft = {
  id: string | null;
  subject_member_id: string;
  kind: EvaluationKind;
  period_label: string;
  scores: Scores;
  comment: string;
  strengths: string;
  improvements: string;
  anonymous: boolean;
};

function emptyDraft(kind: EvaluationKind): Draft {
  return {
    id: null,
    subject_member_id: "",
    kind,
    period_label: String(new Date().getFullYear()),
    scores: {},
    comment: "",
    strengths: "",
    improvements: "",
    anonymous: kind === "leadership",
  };
}

const STATUS_TONE: Record<EvaluationStatus, string> = {
  draft: "bg-slate-100 text-slate-900",
  submitted: "bg-amber-100 text-amber-900",
  revision: "bg-rose-100 text-rose-900",
  validated: "bg-emerald-100 text-emerald-900",
};

function Evaluations() {
  const evaluations = useQuery(evaluationsQuery);
  const members = useQuery(membersQuery);
  const queryClient = useQueryClient();
  const { member, userId, isStaff, isAdmin } = useCurrentRole();
  const [draft, setDraft] = useState<Draft | null>(null);

  const memberName = new Map((members.data?.members ?? []).map((m) => [m.id, m.full_name]));
  const rows = evaluations.data ?? [];

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["evaluations"] });
  }

  const save = useMutation({
    mutationFn: async ({ value, submit }: { value: Draft; submit: boolean }) => {
      if (!value.subject_member_id) throw new Error("Choisis la personne évaluée.");
      if (!userId) throw new Error("Session expirée.");
      const payload = {
        subject_member_id: value.subject_member_id,
        evaluator_member_id: member?.id ?? null,
        evaluator_user_id: userId,
        kind: value.kind,
        period_label: value.period_label.trim() || null,
        scores: value.scores,
        comment: value.comment.trim() || null,
        strengths: value.strengths.trim() || null,
        improvements: value.improvements.trim() || null,
        anonymous: value.anonymous,
        status: submit ? "submitted" : "draft",
        submitted_at: submit ? new Date().toISOString() : null,
      };
      if (value.id) {
        const { error } = await supabase.from("evaluations").update(payload).eq("id", value.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .from("evaluations")
          .insert({ ...payload, initial_scores: value.scores });
        if (error) throw new Error(error.message);
      }
      await logAction({
        action: submit ? "evaluation_soumise" : "evaluation_enregistree",
        entity: "evaluation",
        entityId: value.id ?? value.subject_member_id,
        detail: `${EVAL_KIND_LABEL[value.kind]} — ${memberName.get(value.subject_member_id) ?? ""}`,
        actorName: member?.full_name,
      });
    },
    onSuccess: (_data, variables) => {
      toast.success(variables.submit ? "Évaluation soumise au Responsable" : "Brouillon enregistré");
      setDraft(null);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const decide = useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: EvaluationStatus; note?: string }) => {
      const { error } = await supabase
        .from("evaluations")
        .update({
          status,
          revision_note: note ?? null,
          validated_at: status === "validated" ? new Date().toISOString() : null,
          validated_by: status === "validated" ? (userId ?? null) : null,
        })
        .eq("id", id);
      if (error) throw new Error(error.message);
      await logAction({
        action: status === "validated" ? "evaluation_validee" : "evaluation_revision_demandee",
        entity: "evaluation",
        entityId: id,
        actorName: member?.full_name,
      });
    },
    onSuccess: () => {
      toast.success("Évaluation mise à jour");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const criteria = draft ? EVAL_CRITERIA[draft.kind] : [];

  return (
    <AppShell
      title="Évaluations"
      subtitle="Le Référent rédige, le Responsable valide ; l’équipier découvre après validation"
      actions={
        <>
          {isStaff ? (
            <Button size="sm" className="gap-1" onClick={() => setDraft(emptyDraft("operational"))}>
              <Plus className="size-4" /> Nouvelle évaluation
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => setDraft(emptyDraft("leadership"))}
          >
            Évaluer un responsable
          </Button>
        </>
      }
    >
      {evaluations.isLoading ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="Aucune évaluation accessible"
          description="Les évaluations restent invisibles à la personne évaluée jusqu'à leur validation finale."
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {rows.map((row) => {
            const scores = asScores(row.scores);
            const average = averageScore(scores);
            const kind = row.kind as EvaluationKind;
            const status = row.status as EvaluationStatus;
            const isMine = row.evaluator_user_id === userId;
            return (
              <Card key={row.id}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <CardTitle className="text-base">
                      {memberName.get(row.subject_member_id) ?? row.subject_member_id}
                    </CardTitle>
                    <Badge variant="secondary" className={STATUS_TONE[status] ?? ""}>
                      {EVAL_STATUS_LABEL[status] ?? status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {EVAL_KIND_LABEL[kind] ?? kind} · {row.period_label ?? "période libre"} ·{" "}
                    {row.anonymous
                      ? "Retour confidentiel"
                      : `par ${row.evaluator_member_id ? (memberName.get(row.evaluator_member_id) ?? "—") : "—"}`}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {average !== null ? (
                    <p className="text-sm">
                      Moyenne : <span className="font-black text-icc-violet">{average} / 5</span>
                    </p>
                  ) : null}
                  <ul className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                    {(EVAL_CRITERIA[kind] ?? []).map((c) =>
                      scores[c.id] ? (
                        <li key={c.id}>
                          {c.label} : <span className="font-bold text-foreground">{scores[c.id]}/5</span>
                        </li>
                      ) : null,
                    )}
                  </ul>
                  {row.strengths ? (
                    <p className="text-sm">
                      <span className="font-bold">Points forts :</span> {row.strengths}
                    </p>
                  ) : null}
                  {row.improvements ? (
                    <p className="text-sm">
                      <span className="font-bold">Axes de progression :</span> {row.improvements}
                    </p>
                  ) : null}
                  {row.comment ? <p className="text-sm text-muted-foreground">{row.comment}</p> : null}
                  {row.revision_note ? (
                    <p className="text-sm text-rose-700">Révision demandée : {row.revision_note}</p>
                  ) : null}
                  {row.validated_at ? (
                    <p className="text-xs text-muted-foreground">
                      Validée le {formatDateTime(row.validated_at)}
                    </p>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    {isMine && (status === "draft" || status === "revision") ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setDraft({
                            id: row.id,
                            subject_member_id: row.subject_member_id,
                            kind,
                            period_label: row.period_label ?? "",
                            scores,
                            comment: row.comment ?? "",
                            strengths: row.strengths ?? "",
                            improvements: row.improvements ?? "",
                            anonymous: row.anonymous,
                          })
                        }
                      >
                        Reprendre
                      </Button>
                    ) : null}
                    {isAdmin && status === "submitted" ? (
                      <>
                        <Button
                          size="sm"
                          className="gap-1"
                          disabled={decide.isPending}
                          onClick={() => decide.mutate({ id: row.id, status: "validated" })}
                        >
                          <ShieldCheck className="size-4" /> Valider
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          disabled={decide.isPending}
                          onClick={() =>
                            decide.mutate({
                              id: row.id,
                              status: "revision",
                              note: "Merci de compléter puis de soumettre à nouveau.",
                            })
                          }
                        >
                          <Undo2 className="size-4" /> Demander une révision
                        </Button>
                      </>
                    ) : null}
                    {isAdmin && status === "validated" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={decide.isPending}
                        onClick={() => decide.mutate({ id: row.id, status: "submitted" })}
                      >
                        Rouvrir
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!draft} onOpenChange={(open) => (open ? null : setDraft(null))}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Reprendre l’évaluation" : "Nouvelle évaluation"}</DialogTitle>
          </DialogHeader>
          {draft ? (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Personne évaluée">
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={draft.subject_member_id}
                    onChange={(e) => setDraft({ ...draft, subject_member_id: e.target.value })}
                  >
                    <option value="">Choisir…</option>
                    {(members.data?.members ?? [])
                      .filter((m) => m.status === "active" && m.id !== member?.id)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.full_name}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Type d’évaluation">
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={draft.kind}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        kind: e.target.value as EvaluationKind,
                        scores: {},
                        anonymous: e.target.value === "leadership",
                      })
                    }
                  >
                    {isStaff ? <option value="operational">Travail opérationnel</option> : null}
                    {isStaff ? <option value="referent">Rôle de Référent</option> : null}
                    <option value="leadership">Leadership / Responsable</option>
                  </select>
                </Field>
              </div>
              <Field label="Période">
                <Input
                  value={draft.period_label}
                  onChange={(e) => setDraft({ ...draft, period_label: e.target.value })}
                />
              </Field>

              <div className="space-y-2 rounded-xl border border-border p-3">
                <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                  {EVAL_KIND_LABEL[draft.kind]}
                </p>
                {criteria.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-3">
                    <span className="text-sm">{c.label}</span>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setDraft({ ...draft, scores: { ...draft.scores, [c.id]: n } })}
                          className={
                            draft.scores[c.id] === n
                              ? "size-7 rounded-md bg-icc-violet text-xs font-bold text-white"
                              : "size-7 rounded-md border border-input text-xs"
                          }
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <Field label="Points forts">
                <Textarea
                  rows={2}
                  value={draft.strengths}
                  onChange={(e) => setDraft({ ...draft, strengths: e.target.value })}
                />
              </Field>
              <Field label="Axes de progression">
                <Textarea
                  rows={2}
                  value={draft.improvements}
                  onChange={(e) => setDraft({ ...draft, improvements: e.target.value })}
                />
              </Field>
              <Field label="Commentaire qualitatif">
                <Textarea
                  rows={3}
                  value={draft.comment}
                  onChange={(e) => setDraft({ ...draft, comment: e.target.value })}
                />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.anonymous}
                  onChange={(e) => setDraft({ ...draft, anonymous: e.target.checked })}
                />
                Retour confidentiel (identité de l’évaluateur masquée dans la restitution)
              </label>
            </div>
          ) : null}
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Annuler
            </Button>
            <Button
              variant="outline"
              disabled={save.isPending}
              onClick={() => draft && save.mutate({ value: draft, submit: false })}
            >
              Enregistrer le brouillon
            </Button>
            <Button
              className="gap-1"
              disabled={save.isPending}
              onClick={() => draft && save.mutate({ value: draft, submit: true })}
            >
              <Send className="size-4" /> {save.isPending ? "Synchronisation…" : "Soumettre"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
