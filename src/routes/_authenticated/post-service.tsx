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
  polesQuery,
  PRESENCE_LABEL,
  programsQuery,
  RESPONSE_LABEL,
  tasksQuery,
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
      { name: "description", content: "Comptes rendus post-service : réalisation, présence réelle, incidents multiples et suites." },
    ],
  }),
  component: PostService,
});

type PresenceDraft = { member_id: string; presence: string; note: string };
type IncidentDraft = {
  type: string;
  detail: string;
  impact: "mineur" | "modere" | "important" | "critique";
  action: string;
  affected_member_id: string;
  follow_up: boolean;
  task_title: string;
};
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
  incidents: IncidentDraft[];
  presences: PresenceDraft[];
};

const INCIDENT_JSON_PREFIX = "__ICC_INCIDENTS_V2__";
const IMPACT_LABEL: Record<string, string> = { mineur: "Mineur", modere: "Modéré", important: "Important", critique: "Critique" };
const presentLike = new Set(["present", "retard", "partiel", "renfort"]);

function blankIncident(type: string): IncidentDraft {
  return { type, detail: "", impact: "mineur", action: "", affected_member_id: "", follow_up: false, task_title: "" };
}
function encodeIncidents(items: IncidentDraft[]) {
  if (!items.length) return null;
  return `${INCIDENT_JSON_PREFIX}${JSON.stringify(items)}`;
}
function decodeIncidents(type?: string | null, detail?: string | null): IncidentDraft[] {
  if (detail?.startsWith(INCIDENT_JSON_PREFIX)) {
    try {
      const parsed = JSON.parse(detail.slice(INCIDENT_JSON_PREFIX.length));
      if (Array.isArray(parsed)) return parsed.map((x) => ({ ...blankIncident(String(x.type ?? "Autre")), ...x }));
    } catch { /* ancien format conservé ci-dessous */ }
  }
  return type ? [{ ...blankIncident(type), detail: detail ?? "" }] : [];
}

function PostService() {
  const programs = useQuery(programsQuery);
  const debriefs = useQuery(debriefsQuery);
  const attendance = useQuery(attendanceQuery);
  const membersData = useQuery(membersQuery);
  const poles = useQuery(polesQuery);
  const tasks = useQuery(tasksQuery);
  const queryClient = useQueryClient();
  const { member, userId, isStaff } = useCurrentRole();
  const [draft, setDraft] = useState<Draft | null>(null);

  const memberName = (id: string) => membersData.data?.members.find((m) => m.id === id)?.full_name ?? "Membre";
  const poleName = (id: string) => poles.data?.find((p) => p.id === id)?.name ?? "Pôle";
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
        incident_type: value.incidents.length === 1 ? value.incidents[0].type : value.incidents.length > 1 ? "Multiple" : null,
        incident_detail: encodeIncidents(value.incidents),
      };
      if (value.id) {
        const { error } = await supabase.from("program_debriefs").update(payload).eq("id", value.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("program_debriefs").insert(payload);
        if (error) throw new Error(error.message);
      }

      const { error: delError } = await supabase.from("program_attendance").delete().eq("program_id", value.program_id);
      if (delError) throw new Error(delError.message);
      const rows = value.presences.filter((p) => p.presence).map((p) => ({
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

      const existingTitles = new Set((tasks.data ?? []).filter((t) => t.program_id === value.program_id).map((t) => t.title.trim().toLowerCase()));
      const followUps = value.incidents
        .filter((i) => i.follow_up)
        .map((i) => (i.task_title.trim() || `Suivi incident ${i.type}`).trim())
        .filter((title) => !existingTitles.has(title.toLowerCase()));
      if (followUps.length) {
        const { error } = await supabase.from("tasks").insert(followUps.map((title) => ({ title, program_id: value.program_id, status: "todo", priority: "haute" })));
        if (error) throw new Error(error.message);
      }

      await logAction({
        action: value.id ? "post_service_modifie" : "post_service_cree",
        entity: "program_debrief",
        entityId: value.program_id,
        detail: `${value.incidents.length} incident(s) · ${value.completion}`,
        actorName: member?.full_name,
      });
    },
    onSuccess: () => {
      toast.success("Compte rendu enregistré");
      setDraft(null);
      queryClient.invalidateQueries({ queryKey: ["program-debriefs"] });
      queryClient.invalidateQueries({ queryKey: ["program-attendance"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function openDraft(programId: string, debrief: ProgramDebrief | undefined) {
    const program = past.find((p) => p.id === programId);
    const assigned = Array.from(new Set((program?.assignments ?? []).flatMap((a) => a.memberIds)));
    const rows = (attendance.data ?? []).filter((a) => a.program_id === programId);
    const presences: PresenceDraft[] = assigned.map((id) => {
      const row = rows.find((r) => r.member_id === id);
      return { member_id: id, presence: row?.presence ?? "present", note: row?.note ?? "" };
    });
    for (const row of rows) if (!presences.some((p) => p.member_id === row.member_id)) presences.push({ member_id: row.member_id, presence: row.presence, note: row.note ?? "" });
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
      incidents: decodeIncidents(debrief?.incident_type, debrief?.incident_detail),
      presences,
    });
  }

  function toggleIncident(type: string) {
    if (!draft) return;
    const exists = draft.incidents.some((i) => i.type === type);
    setDraft({ ...draft, incidents: exists ? draft.incidents.filter((i) => i.type !== type) : [...draft.incidents, blankIncident(type)] });
  }
  function patchIncident(type: string, patch: Partial<IncidentDraft>) {
    if (!draft) return;
    setDraft({ ...draft, incidents: draft.incidents.map((i) => i.type === type ? { ...i, ...patch } : i) });
  }

  const loading = programs.isLoading || debriefs.isLoading;

  return <AppShell title="Post-service" subtitle="Débrief des programmes réalisés, rattaché au programme">
    {loading ? <div className="space-y-3">{[0,1,2].map((i)=><Skeleton key={i} className="h-32 rounded-2xl" />)}</div> : past.length === 0 ? <EmptyState title="Aucun programme passé" description="Le débrief s'ouvre après la date du programme." /> : <div className="space-y-3">
      {past.map((program) => {
        const debrief = byProgram.get(program.id);
        const counts = program.responses.reduce<Record<string, number>>((acc, r) => { acc[r.status] = (acc[r.status] ?? 0) + 1; return acc; }, {});
        const rows = (attendance.data ?? []).filter((a) => a.program_id === program.id);
        const planned = program.assignments.reduce((n, a: any) => n + (Number(a.required_count) > 0 ? Number(a.required_count) : a.memberIds.length), 0);
        const actual = rows.filter((r) => presentLike.has(r.presence)).length;
        const incidents = debrief ? decodeIncidents(debrief.incident_type, debrief.incident_detail) : [];
        return <Card key={program.id}>
          <CardHeader className="pb-2"><div className="flex flex-wrap items-start justify-between gap-2"><div><CardTitle className="text-base">{program.title}</CardTitle><p className="text-xs text-muted-foreground">{formatDate(program.start_date)}</p></div><div className="flex flex-wrap gap-1.5">{Object.entries(counts).map(([status,count])=><Badge key={status} variant="outline">{RESPONSE_LABEL[status as keyof typeof RESPONSE_LABEL] ?? status} : {count}</Badge>)}{debrief?.to_direction?<Badge>Remonté à la Direction</Badge>:null}{debrief?.rating?<Badge variant="secondary">{debrief.rating}/5</Badge>:<Badge variant="secondary">Débrief manquant</Badge>}</div></div></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-3"><div className="rounded-lg bg-muted p-2 text-sm"><b>Prévu</b><p>{planned} personne(s)</p></div><div className="rounded-lg bg-muted p-2 text-sm"><b>Réel</b><p>{rows.length ? `${actual} présent(s) / ${rows.length} relevé(s)` : "À renseigner"}</p></div><div className="rounded-lg bg-muted p-2 text-sm"><b>Incidents</b><p>{incidents.length}</p></div></div>
            {debrief ? <div className="space-y-1.5 text-sm"><p className="text-xs text-muted-foreground">{COMPLETION_LABEL[debrief.completion] ?? debrief.completion}{debrief.actual_start || debrief.actual_end ? ` · Horaires réels ${debrief.actual_start ?? "?"} → ${debrief.actual_end ?? "?"}` : ""}</p>{debrief.summary?<p>{debrief.summary}</p>:null}{debrief.went_well?<p><span className="font-bold text-emerald-700">A bien fonctionné :</span> {debrief.went_well}</p>:null}{debrief.to_improve?<p><span className="font-bold text-amber-700">À améliorer :</span> {debrief.to_improve}</p>:null}{debrief.difficulties?<p><b>Difficultés :</b> {debrief.difficulties}</p>:null}{debrief.needs?<p><b>Besoins :</b> {debrief.needs}</p>:null}{incidents.map((i)=><div key={i.type} className="rounded-lg border border-destructive/30 bg-destructive/5 p-2"><p className="font-bold text-destructive">Incident {i.type} · {IMPACT_LABEL[i.impact]}</p><p>{i.detail || "—"}</p>{i.action?<p className="text-xs text-muted-foreground">Action sur place : {i.action}</p>:null}{i.affected_member_id?<p className="text-xs text-muted-foreground">Personne concernée : {memberName(i.affected_member_id)}</p>:null}{i.follow_up?<Badge variant="outline" className="mt-1">Suivi à faire</Badge>:null}</div>)}{debrief.attendance_note?<p className="text-muted-foreground">Présence : {debrief.attendance_note}</p>:null}</div>:<p className="text-sm text-muted-foreground">Aucun compte rendu pour ce programme.</p>}
            {program.assignments.length?<div className="space-y-1">{program.assignments.map((a:any)=>{const wanted=Number(a.required_count)>0?Number(a.required_count):a.memberIds.length;const poleRows=rows.filter((r)=>a.memberIds.includes(r.member_id));const real=poleRows.filter((r)=>presentLike.has(r.presence)).length;return <div key={a.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs"><b>{poleName(a.pole_id)}</b><span>{wanted} prévu(s) → {poleRows.length?`${real} présent(s)`:"réel à renseigner"}</span></div>})}</div>:null}
            {rows.length?<div className="flex flex-wrap gap-1.5">{rows.map((r)=><Badge key={r.id} variant="outline">{memberName(r.member_id)} · {PRESENCE_LABEL[r.presence] ?? r.presence}</Badge>)}</div>:null}
            {isStaff?<Button size="sm" variant={debrief?"outline":"default"} className="gap-1" onClick={()=>openDraft(program.id,debrief)}>{debrief?<><Pencil className="size-4"/> Modifier le débrief</>:<><Plus className="size-4"/> Rédiger le débrief</>}</Button>:null}
          </CardContent>
        </Card>;
      })}
    </div>}

    <Dialog open={!!draft} onOpenChange={(open)=>(open?null:setDraft(null))}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Compte rendu post-service</DialogTitle></DialogHeader>
        {draft?<div className="space-y-4">
          <div className="grid grid-cols-2 gap-3"><Field label="Début réel"><Input type="time" value={draft.actual_start} onChange={(e)=>setDraft({...draft,actual_start:e.target.value})}/></Field><Field label="Fin réelle"><Input type="time" value={draft.actual_end} onChange={(e)=>setDraft({...draft,actual_end:e.target.value})}/></Field></div>
          <Field label="Réalisation"><div className="flex flex-wrap gap-1.5">{Object.entries(COMPLETION_LABEL).map(([key,label])=><button key={key} type="button" onClick={()=>setDraft({...draft,completion:key})} className={draft.completion===key?"rounded-lg bg-icc-violet px-3 py-1.5 text-xs font-bold text-white":"rounded-lg border border-input px-3 py-1.5 text-xs"}>{label}</button>)}</div></Field>
          <Field label="Note globale"><div className="flex gap-1">{[1,2,3,4,5].map((n)=><button key={n} type="button" onClick={()=>setDraft({...draft,rating:n})} className={draft.rating===n?"size-8 rounded-md bg-icc-violet text-sm font-bold text-white":"size-8 rounded-md border border-input text-sm"}>{n}</button>)}</div></Field>
          <Field label="Présence réelle">{draft.presences.length===0?<p className="text-xs text-muted-foreground">Aucun membre affecté à ce programme.</p>:<div className="space-y-2">{draft.presences.map((p,index)=><div key={p.member_id} className="rounded-xl border p-2"><p className="text-xs font-bold">{memberName(p.member_id)}</p><div className="mt-1.5 flex flex-wrap gap-1">{Object.entries(PRESENCE_LABEL).map(([key,label])=><button key={key} type="button" onClick={()=>{const next=[...draft.presences];next[index]={...p,presence:key};setDraft({...draft,presences:next})}} className={p.presence===key?"rounded-md bg-icc-violet px-2 py-1 text-[10px] font-bold text-white":"rounded-md border border-input px-2 py-1 text-[10px]"}>{label}</button>)}</div><Input className="mt-1.5 h-8 text-xs" placeholder="Remarque (facultatif)" value={p.note} onChange={(e)=>{const next=[...draft.presences];next[index]={...p,note:e.target.value};setDraft({...draft,presences:next})}}/></div>)}</div>}</Field>
          <Field label="Synthèse"><Textarea rows={3} value={draft.summary} onChange={(e)=>setDraft({...draft,summary:e.target.value})}/></Field>
          <Field label="Ce qui a bien fonctionné"><Textarea rows={2} value={draft.went_well} onChange={(e)=>setDraft({...draft,went_well:e.target.value})}/></Field>
          <Field label="À améliorer"><Textarea rows={2} value={draft.to_improve} onChange={(e)=>setDraft({...draft,to_improve:e.target.value})}/></Field>
          <Field label="Difficultés rencontrées"><Textarea rows={2} value={draft.difficulties} onChange={(e)=>setDraft({...draft,difficulties:e.target.value})}/></Field>
          <Field label="Besoins pour la prochaine fois"><Textarea rows={2} value={draft.needs} onChange={(e)=>setDraft({...draft,needs:e.target.value})}/></Field>

          <Field label="Incidents rencontrés (plusieurs choix possibles)"><div className="flex flex-wrap gap-1.5">{INCIDENT_TYPES.map((type)=><button key={type} type="button" onClick={()=>toggleIncident(type)} className={draft.incidents.some((i)=>i.type===type)?"rounded-lg bg-icc-violet px-3 py-1.5 text-xs font-bold text-white":"rounded-lg border border-input px-3 py-1.5 text-xs"}>{draft.incidents.some((i)=>i.type===type)?"✓ ":""}{type}</button>)}</div>{draft.incidents.length===0?<p className="mt-2 text-xs text-muted-foreground">Aucun incident déclaré.</p>:null}</Field>
          {draft.incidents.map((incident)=><div key={incident.type} className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3"><div className="flex items-center justify-between"><b className="text-sm text-destructive">⚠ {incident.type}</b><Button type="button" variant="ghost" size="sm" onClick={()=>toggleIncident(incident.type)}>Retirer</Button></div><Field label={`Description — ${incident.type}`}><Textarea rows={2} value={incident.detail} onChange={(e)=>patchIncident(incident.type,{detail:e.target.value})}/></Field><Field label="Impact"><div className="flex flex-wrap gap-1.5">{Object.entries(IMPACT_LABEL).map(([key,label])=><button key={key} type="button" onClick={()=>patchIncident(incident.type,{impact:key as IncidentDraft["impact"]})} className={incident.impact===key?"rounded-lg bg-icc-violet px-2.5 py-1 text-xs font-bold text-white":"rounded-lg border px-2.5 py-1 text-xs"}>{label}</button>)}</div></Field><Field label="Action prise sur place"><Textarea rows={2} value={incident.action} onChange={(e)=>patchIncident(incident.type,{action:e.target.value})}/></Field>{incident.type==="Retard-absence"||incident.type==="Communication"?<Field label="Personne concernée (facultatif)"><select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={incident.affected_member_id} onChange={(e)=>patchIncident(incident.type,{affected_member_id:e.target.value})}><option value="">— Non renseignée —</option>{draft.presences.map((p)=><option key={p.member_id} value={p.member_id}>{memberName(p.member_id)}</option>)}</select></Field>:null}<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={incident.follow_up} onChange={(e)=>patchIncident(incident.type,{follow_up:e.target.checked})}/>Créer / conserver une action de suivi</label>{incident.follow_up?<Field label="Tâche de suivi"><Input placeholder={`Suivi incident ${incident.type}`} value={incident.task_title} onChange={(e)=>patchIncident(incident.type,{task_title:e.target.value})}/></Field>:null}</div>)}

          <Field label="Remarques de présence"><Textarea rows={2} value={draft.attendance_note} onChange={(e)=>setDraft({...draft,attendance_note:e.target.value})}/></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.to_direction} onChange={(e)=>setDraft({...draft,to_direction:e.target.checked})}/>À remonter à la Direction</label>
        </div>:null}
        <DialogFooter><Button variant="ghost" onClick={()=>setDraft(null)}>Annuler</Button><Button disabled={save.isPending} onClick={()=>draft&&save.mutate(draft)}>{save.isPending?"Synchronisation…":"Enregistrer"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </AppShell>;
}
