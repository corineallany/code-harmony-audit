import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Send, ShieldCheck, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell, EmptyState } from "@/components/AppShell";
import { Field } from "@/components/admin/form-kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentRole } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getEvaluationFacts, type EvaluationFacts } from "@/lib/evaluation-context";
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
import { evaluationsQuery, formatDateTime, logAction, membersQuery } from "@/lib/icc";

export const Route = createFileRoute("/_authenticated/evaluations")({
  head: () => ({
    meta: [
      { title: "Évaluations — COM ICC Le Mans" },
      { name: "description", content: "Évaluations humaines appuyées par des repères factuels, la formation et des objectifs de progression." },
    ],
  }),
  component: Evaluations,
});

const db = () => supabase as any;

type ObjectiveDraft = {
  id: string;
  label: string;
  due_date: string;
  coach_member_id: string;
};

type ObjectiveRow = ObjectiveDraft & {
  evaluation_id: string;
  subject_member_id: string;
  status: "todo" | "in_progress" | "done" | "cancelled";
  completed_at: string | null;
  created_at: string;
};

type Draft = {
  id: string | null;
  subject_member_id: string;
  kind: EvaluationKind;
  period_label: string;
  period_start: string;
  period_end: string;
  scores: Scores;
  comment: string;
  strengths: string;
  improvements: string;
  objectives: ObjectiveDraft[];
  anonymous: boolean;
};

function yearBounds() {
  const year = new Date().getFullYear();
  return { label: String(year), start: `${year}-01-01`, end: `${year}-12-31` };
}

function emptyDraft(kind: EvaluationKind): Draft {
  const bounds = yearBounds();
  return {
    id: null,
    subject_member_id: "",
    kind,
    period_label: bounds.label,
    period_start: bounds.start,
    period_end: bounds.end,
    scores: {},
    comment: "",
    strengths: "",
    improvements: "",
    objectives: [],
    anonymous: kind === "leadership",
  };
}

const STATUS_TONE: Record<EvaluationStatus, string> = {
  draft: "bg-slate-100 text-slate-900",
  submitted: "bg-amber-100 text-amber-900",
  revision: "bg-rose-100 text-rose-900",
  validated: "bg-emerald-100 text-emerald-900",
};
const OBJECTIVE_LABEL: Record<string, string> = {
  todo: "À faire",
  in_progress: "En cours",
  done: "Atteint",
  cancelled: "Abandonné",
};

function trend(current?: number, previous?: number) {
  if (!current || !previous) return null;
  const delta = Math.round((current - previous) * 10) / 10;
  return delta === 0 ? "=" : delta > 0 ? `↑ +${delta}` : `↓ ${delta}`;
}

function FactsPanel({ facts, kind }: { facts: EvaluationFacts; kind: EvaluationKind }) {
  const f = facts;
  const internal = f.training.filter((t) => t.kind === "internal" && t.status !== "completed");
  return (
    <div className="space-y-3 rounded-xl border border-violet-200 bg-violet-50/40 p-3">
      <div>
        <p className="text-xs font-black uppercase tracking-wide text-icc-violet">Repères de la période</p>
        <p className="mt-1 text-xs text-muted-foreground">Informations factuelles uniquement : elles ne calculent et ne modifient aucune note.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Fact label="Activité" value={`${f.activity.assigned} programmes affectés · ${f.activity.attended} présences · ${f.activity.late} retard(s) · ${f.activity.absent} absence(s)`} />
        <Fact label="Engagement" value={`${f.engagement.reinforcements} renfort(s) · ${f.engagement.replacements} remplacement(s) effectué(s)`} />
        <Fact label="Fiabilité" value={`${f.reliability.presenceRate ?? "—"}% de présence · réponses : ${f.reliability.responsesAnswered}/${f.reliability.responsesTotal}`} />
        <Fact label="Post-service" value={`${f.postService.incidentsExplicitlyLinked} incident(s) explicitement associé(s) · ${f.postService.positiveProgramNotes} débrief(s) positif(s) sur des programmes suivis · ${f.postService.improvementProgramNotes} axe(s) d’amélioration sur des programmes suivis`} />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Fact label="Fonction actuelle" value={`${f.currentFunction.poles.length ? f.currentFunction.poles.join(" · ") : "Aucun pôle"}${f.currentFunction.referentPoles.length ? ` · Référent : ${f.currentFunction.referentPoles.join(", ")}` : ""}`} />
        <Fact label="Compétence(s) en acquisition" value={internal.length ? internal.map((t) => `${t.poleName} — ${t.name} ${t.progress}%`).join(" · ") : "Aucune formation interne en cours"} />
      </div>
      {f.training.length ? (
        <div className="space-y-1 rounded-lg bg-background/70 p-2 text-xs">
          <b>Formation</b>
          {f.training.map((t) => <p key={`${t.pathId}-${t.startedAt}`}>{t.poleName} — {t.name} : {t.progress}% {t.status === "completed" ? "· validée" : "· en cours"}</p>)}
        </div>
      ) : null}
      {kind === "referent" && f.referent ? (
        <div className="rounded-lg bg-background/70 p-2 text-xs">
          <b>Repères Référent</b>
          <p className="mt-1">{f.referent.programsInPoles} programme(s) dans ses pôles · couverture actuelle des besoins : {f.referent.coverageRate ?? "—"}% · {f.referent.replacementsManaged} remplacement(s) constaté(s) · {f.referent.peopleInTraining} personne(s) accompagnée(s) en formation · {f.referent.skillsValidated} compétence(s)/parcours validé(s) sur la période</p>
        </div>
      ) : null}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-background/70 p-2 text-xs"><b>{label}</b><p className="mt-1 text-muted-foreground">{value}</p></div>;
}

function Evaluations() {
  const evaluations = useQuery(evaluationsQuery);
  const members = useQuery(membersQuery);
  const objectives = useQuery({
    queryKey: ["evaluation-objectives"],
    queryFn: async () => {
      const { data, error } = await db().from("evaluation_objectives").select("*").order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as ObjectiveRow[];
    },
  });
  const queryClient = useQueryClient();
  const { member, userId, isStaff, isAdmin } = useCurrentRole();
  const [draft, setDraft] = useState<Draft | null>(null);

  const memberName = new Map((members.data?.members ?? []).map((m) => [m.id, m.full_name]));
  const rows = evaluations.data ?? [];
  const evalById = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);

  const facts = useQuery({
    queryKey: ["evaluation-facts", draft?.subject_member_id, draft?.period_start, draft?.period_end],
    enabled: !!draft?.subject_member_id && !!draft?.period_start && !!draft?.period_end && isStaff,
    queryFn: () => getEvaluationFacts(draft!.subject_member_id, draft!.period_start, draft!.period_end),
  });

  const previousEvaluation = draft
    ? rows.find((row) => row.subject_member_id === draft.subject_member_id && row.kind === draft.kind && row.status === "validated" && row.id !== draft.id)
    : undefined;
  const previousScores = previousEvaluation ? asScores(previousEvaluation.scores) : {};
  const previousObjectives = draft
    ? (objectives.data ?? []).filter((o) => {
        if (o.subject_member_id !== draft.subject_member_id || o.evaluation_id === draft.id) return false;
        const origin = evalById.get(o.evaluation_id);
        return origin?.status === "validated";
      })
    : [];
  const objectiveDone = previousObjectives.filter((o) => o.status === "done").length;

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["evaluations"] });
    queryClient.invalidateQueries({ queryKey: ["evaluation-objectives"] });
  }

  const updateObjective = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ObjectiveRow["status"] }) => {
      const { error } = await db().from("evaluation_objectives").update({
        status,
        completed_at: status === "done" ? new Date().toISOString() : null,
      }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["evaluation-objectives"] }),
    onError: (error: Error) => toast.error(error.message),
  });

  const save = useMutation({
    mutationFn: async ({ value, submit }: { value: Draft; submit: boolean }) => {
      if (!value.subject_member_id) throw new Error("Choisis la personne évaluée.");
      if (!userId) throw new Error("Session expirée.");
      if (value.period_start && value.period_end && value.period_start > value.period_end) throw new Error("La date de début doit précéder la date de fin.");

      const context = isStaff && value.period_start && value.period_end
        ? await getEvaluationFacts(value.subject_member_id, value.period_start, value.period_end)
        : null;
      const payload = {
        subject_member_id: value.subject_member_id,
        evaluator_member_id: member?.id ?? null,
        evaluator_user_id: userId,
        kind: value.kind,
        period_label: value.period_label.trim() || null,
        period_start: value.period_start || null,
        period_end: value.period_end || null,
        scores: value.scores,
        comment: value.comment.trim() || null,
        strengths: value.strengths.trim() || null,
        improvements: value.improvements.trim() || null,
        anonymous: value.anonymous,
        fact_snapshot: context ?? {},
        training_snapshot: context?.training ?? [],
        status: submit ? "submitted" : "draft",
        submitted_at: submit ? new Date().toISOString() : null,
      };

      let evaluationId = value.id;
      if (value.id) {
        const { error } = await db().from("evaluations").update(payload).eq("id", value.id);
        if (error) throw new Error(error.message);
      } else {
        const { data, error } = await db().from("evaluations").insert({ ...payload, initial_scores: value.scores }).select("id").single();
        if (error) throw new Error(error.message);
        evaluationId = data.id;
      }

      if (evaluationId && isStaff && value.kind !== "leadership") {
        const { error: deleteError } = await db().from("evaluation_objectives").delete().eq("evaluation_id", evaluationId);
        if (deleteError) throw new Error(deleteError.message);
        const objectiveRows = value.objectives.filter((o) => o.label.trim()).map((o) => ({
          id: o.id,
          evaluation_id: evaluationId,
          subject_member_id: value.subject_member_id,
          label: o.label.trim(),
          due_date: o.due_date || null,
          coach_member_id: o.coach_member_id || null,
          status: "todo",
        }));
        if (objectiveRows.length) {
          const { error } = await db().from("evaluation_objectives").insert(objectiveRows);
          if (error) throw new Error(error.message);
        }
      }

      await logAction({
        action: submit ? "evaluation_soumise" : "evaluation_enregistree",
        entity: "evaluation",
        entityId: evaluationId ?? value.subject_member_id,
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
      const { error } = await db().from("evaluations").update({
        status,
        revision_note: note ?? null,
        validated_at: status === "validated" ? new Date().toISOString() : null,
        validated_by: status === "validated" ? (userId ?? null) : null,
      }).eq("id", id);
      if (error) throw new Error(error.message);
      await logAction({
        action: status === "validated" ? "evaluation_validee" : "evaluation_revision_demandee",
        entity: "evaluation",
        entityId: id,
        actorName: member?.full_name,
      });
    },
    onSuccess: () => { toast.success("Évaluation mise à jour"); refresh(); },
    onError: (error: Error) => toast.error(error.message),
  });

  const criteria = draft ? EVAL_CRITERIA[draft.kind] : [];

  function openExisting(row: any, scores: Scores, kind: EvaluationKind) {
    const rowObjectives = (objectives.data ?? []).filter((o) => o.evaluation_id === row.id);
    const bounds = yearBounds();
    setDraft({
      id: row.id,
      subject_member_id: row.subject_member_id,
      kind,
      period_label: row.period_label ?? "",
      period_start: row.period_start ?? bounds.start,
      period_end: row.period_end ?? bounds.end,
      scores,
      comment: row.comment ?? "",
      strengths: row.strengths ?? "",
      improvements: row.improvements ?? "",
      objectives: rowObjectives.map((o) => ({ id: o.id, label: o.label, due_date: o.due_date ?? "", coach_member_id: o.coach_member_id ?? "" })),
      anonymous: row.anonymous,
    });
  }

  return (
    <AppShell
      title="Évaluations"
      subtitle="Évaluer avec des faits, sans notation automatique : progression, compétences et objectifs dans le temps"
      actions={<>
        {isStaff ? <Button size="sm" className="gap-1" onClick={() => setDraft(emptyDraft("operational"))}><Plus className="size-4" /> Nouvelle évaluation</Button> : null}
        <Button size="sm" variant="outline" onClick={() => setDraft(emptyDraft("leadership"))}>Évaluer un responsable</Button>
      </>}
    >
      {evaluations.isLoading ? (
        <div className="grid gap-3 lg:grid-cols-2"><Skeleton className="h-40 rounded-2xl" /><Skeleton className="h-40 rounded-2xl" /></div>
      ) : rows.length === 0 ? (
        <EmptyState title="Aucune évaluation accessible" description="Les évaluations restent invisibles à la personne évaluée jusqu'à leur validation finale." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {rows.map((row) => {
            const r = row as any;
            const scores = asScores(row.scores);
            const average = averageScore(scores);
            const kind = row.kind as EvaluationKind;
            const status = row.status as EvaluationStatus;
            const isMine = row.evaluator_user_id === userId;
            const rowObjectives = (objectives.data ?? []).filter((o) => o.evaluation_id === row.id);
            return (
              <Card key={row.id}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <CardTitle className="text-base">{memberName.get(row.subject_member_id) ?? row.subject_member_id}</CardTitle>
                    <Badge variant="secondary" className={STATUS_TONE[status] ?? ""}>{EVAL_STATUS_LABEL[status] ?? status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {EVAL_KIND_LABEL[kind] ?? kind} · {row.period_label ?? "période libre"}{r.period_start && r.period_end ? ` · ${new Date(`${r.period_start}T12:00:00`).toLocaleDateString("fr-FR")} → ${new Date(`${r.period_end}T12:00:00`).toLocaleDateString("fr-FR")}` : ""} · {row.anonymous ? "Retour confidentiel" : `par ${row.evaluator_member_id ? (memberName.get(row.evaluator_member_id) ?? "—") : "—"}`}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {average !== null ? <p className="text-sm">Moyenne : <span className="font-black text-icc-violet">{average} / 5</span></p> : null}
                  <ul className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                    {(EVAL_CRITERIA[kind] ?? []).map((c) => scores[c.id] ? <li key={c.id}>{c.label} : <span className="font-bold text-foreground">{scores[c.id]}/5</span></li> : null)}
                  </ul>
                  {row.strengths ? <p className="text-sm"><span className="font-bold">Points forts :</span> {row.strengths}</p> : null}
                  {row.improvements ? <p className="text-sm"><span className="font-bold">Axes de progression :</span> {row.improvements}</p> : null}
                  {rowObjectives.length ? <div className="rounded-lg bg-muted/50 p-2 text-sm"><b>Objectifs prochaine période</b>{rowObjectives.map((o) => <p key={o.id} className="mt-1 text-xs">• {o.label} · {OBJECTIVE_LABEL[o.status]}{o.due_date ? ` · échéance ${new Date(`${o.due_date}T12:00:00`).toLocaleDateString("fr-FR")}` : ""}</p>)}</div> : null}
                  {row.comment ? <p className="text-sm text-muted-foreground">{row.comment}</p> : null}
                  {row.revision_note ? <p className="text-sm text-rose-700">Révision demandée : {row.revision_note}</p> : null}
                  {row.validated_at ? <p className="text-xs text-muted-foreground">Validée le {formatDateTime(row.validated_at)}</p> : null}
                  <div className="flex flex-wrap gap-2">
                    {isMine && (status === "draft" || status === "revision") ? <Button size="sm" variant="outline" onClick={() => openExisting(r, scores, kind)}>Reprendre</Button> : null}
                    {isAdmin && status === "submitted" ? <>
                      <Button size="sm" className="gap-1" disabled={decide.isPending} onClick={() => decide.mutate({ id: row.id, status: "validated" })}><ShieldCheck className="size-4" /> Valider</Button>
                      <Button size="sm" variant="outline" className="gap-1" disabled={decide.isPending} onClick={() => decide.mutate({ id: row.id, status: "revision", note: "Merci de compléter puis de soumettre à nouveau." })}><Undo2 className="size-4" /> Demander une révision</Button>
                    </> : null}
                    {isAdmin && status === "validated" ? <Button size="sm" variant="ghost" disabled={decide.isPending} onClick={() => decide.mutate({ id: row.id, status: "submitted" })}>Rouvrir</Button> : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!draft} onOpenChange={(open) => (open ? null : setDraft(null))}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader><DialogTitle>{draft?.id ? "Reprendre l’évaluation" : "Nouvelle évaluation"}</DialogTitle></DialogHeader>
          {draft ? <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Personne évaluée">
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.subject_member_id} onChange={(e) => setDraft({ ...draft, subject_member_id: e.target.value })}>
                  <option value="">Choisir…</option>
                  {(members.data?.members ?? []).filter((m) => m.status === "active" && m.id !== member?.id).map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                </select>
              </Field>
              <Field label="Type d’évaluation">
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as EvaluationKind, scores: {}, objectives: e.target.value === "leadership" ? [] : draft.objectives, anonymous: e.target.value === "leadership" })}>
                  {isStaff ? <option value="operational">Travail opérationnel</option> : null}
                  {isStaff ? <option value="referent">Rôle de Référent</option> : null}
                  <option value="leadership">Leadership / Responsable</option>
                </select>
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Période"><Input value={draft.period_label} onChange={(e) => setDraft({ ...draft, period_label: e.target.value })} /></Field>
              <Field label="Du"><Input type="date" value={draft.period_start} onChange={(e) => setDraft({ ...draft, period_start: e.target.value })} /></Field>
              <Field label="Au"><Input type="date" value={draft.period_end} onChange={(e) => setDraft({ ...draft, period_end: e.target.value })} /></Field>
            </div>

            {isStaff && draft.subject_member_id ? facts.isLoading ? <div className="rounded-xl border p-3 text-sm text-muted-foreground">Chargement des repères de période…</div> : facts.data ? <FactsPanel facts={facts.data} kind={draft.kind} /> : null : null}

            {previousEvaluation ? <div className="space-y-2 rounded-xl border p-3">
              <div><p className="text-xs font-black uppercase tracking-wide text-muted-foreground">Progression depuis la précédente évaluation</p><p className="text-xs text-muted-foreground">Comparaison informative des mêmes critères — aucune note n’est recalculée.</p></div>
              <div className="grid gap-1 sm:grid-cols-2">{criteria.map((c) => draft.scores[c.id] && previousScores[c.id] ? <p key={c.id} className="text-xs">{c.label} : <b>{previousScores[c.id]} → {draft.scores[c.id]}</b> <span className="font-bold text-icc-violet">{trend(draft.scores[c.id], previousScores[c.id])}</span></p> : null)}</div>
            </div> : null}

            {isStaff && draft.kind !== "leadership" && previousObjectives.length ? <div className="space-y-2 rounded-xl border p-3">
              <div><p className="text-xs font-black uppercase tracking-wide text-muted-foreground">Objectifs précédents : {objectiveDone}/{previousObjectives.length} atteints</p><p className="text-xs text-muted-foreground">Leur état peut être actualisé ici avant de définir les objectifs suivants.</p></div>
              {previousObjectives.map((o) => <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 p-2 text-sm"><span>{o.label}</span><select className="h-8 rounded-md border bg-background px-2 text-xs" value={o.status} onChange={(e) => updateObjective.mutate({ id: o.id, status: e.target.value as ObjectiveRow["status"] })}><option value="todo">À faire</option><option value="in_progress">En cours</option><option value="done">Atteint</option><option value="cancelled">Abandonné</option></select></div>)}
            </div> : null}

            <div className="space-y-2 rounded-xl border border-border p-3">
              <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">{EVAL_KIND_LABEL[draft.kind]}</p>
              {criteria.map((c) => <div key={c.id} className="flex flex-wrap items-center justify-between gap-3"><span className="text-sm">{c.label}</span><div className="flex gap-1">{[1,2,3,4,5].map((n) => <button key={n} type="button" onClick={() => setDraft({ ...draft, scores: { ...draft.scores, [c.id]: n } })} className={draft.scores[c.id] === n ? "size-7 rounded-md bg-icc-violet text-xs font-bold text-white" : "size-7 rounded-md border border-input text-xs"}>{n}</button>)}</div></div>)}
            </div>

            <Field label="Points forts"><Textarea rows={2} value={draft.strengths} onChange={(e) => setDraft({ ...draft, strengths: e.target.value })} /></Field>
            <Field label="Axes de progression"><Textarea rows={2} value={draft.improvements} onChange={(e) => setDraft({ ...draft, improvements: e.target.value })} /></Field>

            {isStaff && draft.kind !== "leadership" ? <div className="space-y-2 rounded-xl border p-3">
              <div className="flex items-center justify-between gap-2"><div><p className="text-xs font-black uppercase tracking-wide text-muted-foreground">Objectifs pour la prochaine période</p><p className="text-xs text-muted-foreground">Objectif concret, échéance et accompagnateur éventuel.</p></div><Button type="button" size="sm" variant="outline" onClick={() => setDraft({ ...draft, objectives: [...draft.objectives, { id: crypto.randomUUID(), label: "", due_date: "", coach_member_id: "" }] })}><Plus className="size-4" /> Ajouter</Button></div>
              {draft.objectives.map((o, index) => <div key={o.id} className="grid gap-2 rounded-lg bg-muted/40 p-2 sm:grid-cols-[1fr_150px_190px_auto]"><Input placeholder="Ex. Être autonome sur le montage d’un format court" value={o.label} onChange={(e) => setDraft({ ...draft, objectives: draft.objectives.map((x, i) => i === index ? { ...x, label: e.target.value } : x) })} /><Input type="date" value={o.due_date} onChange={(e) => setDraft({ ...draft, objectives: draft.objectives.map((x, i) => i === index ? { ...x, due_date: e.target.value } : x) })} /><select className="h-10 rounded-md border border-input bg-background px-2 text-sm" value={o.coach_member_id} onChange={(e) => setDraft({ ...draft, objectives: draft.objectives.map((x, i) => i === index ? { ...x, coach_member_id: e.target.value } : x) })}><option value="">Accompagnateur facultatif</option>{(members.data?.members ?? []).filter((m) => m.status === "active").map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}</select><Button type="button" size="icon" variant="ghost" onClick={() => setDraft({ ...draft, objectives: draft.objectives.filter((_, i) => i !== index) })}><Trash2 className="size-4" /></Button></div>)}
            </div> : null}

            <Field label="Commentaire qualitatif"><Textarea rows={3} value={draft.comment} onChange={(e) => setDraft({ ...draft, comment: e.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.anonymous} onChange={(e) => setDraft({ ...draft, anonymous: e.target.checked })} />Retour confidentiel (identité de l’évaluateur masquée dans la restitution)</label>
          </div> : null}
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDraft(null)}>Annuler</Button>
            <Button variant="outline" disabled={save.isPending} onClick={() => draft && save.mutate({ value: draft, submit: false })}>Enregistrer le brouillon</Button>
            <Button className="gap-1" disabled={save.isPending} onClick={() => draft && save.mutate({ value: draft, submit: true })}><Send className="size-4" /> {save.isPending ? "Synchronisation…" : "Soumettre"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
