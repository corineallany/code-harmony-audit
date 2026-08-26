import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { AppShell, EmptyState } from "@/components/AppShell";
import { formatDate, logAction, membersQuery, polesQuery, programsQuery, solicitationsQuery, STATUS_LABEL } from "@/lib/icc";
import { useCurrentRole } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/sollicitations")({ component: Sollicitations });

type Recipient = { id: string; solicitation_id: string; member_id: string; response: string; reserve: string | null; refusal_reason: string | null; responded_at: string | null };
type Target = { id: string; solicitation_id: string; target_type: "member" | "pole" | "all"; target_id: string | null; target_name: string; need: string | null };
type MapRow = { solicitation_id: string; member_id: string; target_id: string };
type TargetDraft = { key: string; type: "member" | "pole" | "all"; ids: string[]; need: string };
type FormState = { id: string | null; nature: "reinforcement" | "replacement"; requester_member_id: string; program_id: string; event_name: string; event_date: string; response_deadline: string; message: string; targets: TargetDraft[] };

const RLABEL: Record<string, string> = { pending: "En attente", accepted: "Accepté", partial: "Accepté partiellement", refused: "Refusé" };
const NLABEL: Record<string, string> = { reinforcement: "Renfort ponctuel", replacement: "Remplacement", renfort: "Renfort ponctuel", remplacement: "Remplacement" };
const uid = (prefix = "s") => `${prefix}${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
const newTarget = (): TargetDraft => ({ key: uid("t"), type: "member", ids: [], need: "" });
const blankForm = (requester = ""): FormState => ({ id: null, nature: "reinforcement", requester_member_id: requester, program_id: "", event_name: "", event_date: "", response_deadline: "", message: "", targets: [newTarget()] });
const todayIso = () => new Date().toISOString().slice(0, 10);

function Sollicitations() {
  const solicitations = useQuery(solicitationsQuery);
  const members = useQuery(membersQuery);
  const poles = useQuery(polesQuery);
  const programs = useQuery(programsQuery);
  const { isStaff, isAdmin, member, userId } = useCurrentRole();
  const qc = useQueryClient();

  const recipients = useQuery({ queryKey: ["solicitation-recipients"], queryFn: async () => { const { data, error } = await (supabase as any).from("solicitation_recipients").select("*"); if (error) throw error; return data as Recipient[]; } });
  const targets = useQuery({ queryKey: ["solicitation-targets"], queryFn: async () => { const { data, error } = await (supabase as any).from("solicitation_targets").select("*"); if (error) throw error; return data as Target[]; } });
  const recipientTargets = useQuery({ queryKey: ["solicitation-recipient-targets"], queryFn: async () => { const { data, error } = await (supabase as any).from("solicitation_recipient_targets").select("*"); if (error) throw error; return data as MapRow[]; } });

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [nature, setNature] = useState("all");
  const [program, setProgram] = useState("all");
  const [sort, setSort] = useState("recent");
  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState<any | null>(null);
  const [form, setForm] = useState<FormState>(() => blankForm(member?.id ?? ""));

  const allMembers = members.data?.members ?? [];
  const activeMembers = allMembers.filter((m: any) => m.status === "active" && !m.archived);
  const links = members.data?.links ?? [];
  const activePoles = (poles.data ?? []).filter((p) => !p.archived);
  const allActivePrograms = (programs.data ?? []).filter((p) => !p.archived && !p.deleted);
  const selectablePrograms = allActivePrograms.filter((p: any) => !!p.start_date && p.start_date >= todayIso() && p.status !== "cancelled");

  const rows = useMemo(() => {
    let data = (solicitations.data ?? []).filter((s: any) => !s.archived);
    const needle = search.trim().toLowerCase();
    if (needle) data = data.filter((s: any) => `${s.event_name ?? ""} ${s.requester ?? ""} ${s.message ?? ""} ${s.target_name ?? ""}`.toLowerCase().includes(needle));
    if (status !== "all") data = data.filter((s: any) => s.status === status);
    if (nature !== "all") data = data.filter((s: any) => (s.nature === nature || NLABEL[s.nature ?? ""] === NLABEL[nature]));
    if (program !== "all") data = data.filter((s: any) => s.program_id === program);
    return [...data].sort((a: any, b: any) => sort === "old" ? String(a.event_date ?? a.created_at).localeCompare(String(b.event_date ?? b.created_at)) : String(b.event_date ?? b.created_at).localeCompare(String(a.event_date ?? a.created_at)));
  }, [solicitations.data, search, status, nature, program, sort]);

  const recs = (id: string) => (recipients.data ?? []).filter((r) => r.solicitation_id === id);
  const tgts = (id: string) => (targets.data ?? []).filter((t) => t.solicitation_id === id);
  const maps = (id: string) => (recipientTargets.data ?? []).filter((m) => m.solicitation_id === id);
  const memberName = (id: string | null | undefined) => allMembers.find((m: any) => m.id === id)?.full_name ?? "—";
  const programName = (id: string | null | undefined) => allActivePrograms.find((p: any) => p.id === id)?.title ?? "—";
  const creatorName = (s: any) => allMembers.find((m: any) => m.auth_user_id && m.auth_user_id === s.created_by)?.full_name ?? s.requester ?? "—";
  const selectedProgram = selectablePrograms.find((p: any) => p.id === form.program_id) ?? allActivePrograms.find((p: any) => p.id === form.program_id);
  const effectiveProgramDate = selectedProgram?.start_date ?? "";

  function deadlineText(date?: string | null) {
    if (!date) return "—";
    const t = todayIso();
    if (date < t) return `Échéance dépassée · ${formatDate(date)}`;
    if (date === t) return `À répondre aujourd'hui · ${formatDate(date)}`;
    return `Réponse attendue avant le ${formatDate(date)}`;
  }

  function aggregate(rs: Recipient[]) {
    if (!rs.length || rs.every((r) => r.response === "pending")) return "pending";
    if (rs.every((r) => r.response === "accepted")) return "accepted";
    if (rs.every((r) => r.response === "refused")) return "refused";
    if (rs.some((r) => r.response === "pending")) return "pending";
    return "partial";
  }

  function resolveTargetMembers(t: TargetDraft) {
    if (t.type === "all") return activeMembers.map((m: any) => m.id);
    if (t.type === "member") return t.ids;
    return activeMembers.filter((m: any) => t.ids.some((poleId) => links.some((l: any) => l.member_id === m.id && l.pole_id === poleId))).map((m: any) => m.id);
  }

  function targetDisplay(t: TargetDraft) {
    if (t.type === "all") return "Toute la COM";
    if (t.type === "member") return t.ids.map((id) => memberName(id)).join(", ");
    return t.ids.map((id) => activePoles.find((p: any) => p.id === id)?.name ?? "Pôle").join(", ");
  }

  function openNew() { setForm(blankForm(member?.id ?? "")); setFormOpen(true); }

  function openEdit(s: any) {
    const st = tgts(s.id);
    const draftTargets: TargetDraft[] = st.length ? st.reduce((acc: TargetDraft[], t) => {
      const same = acc.find((x) => x.type === t.target_type && x.need === (t.need ?? ""));
      if (same && t.target_type !== "all" && t.target_id) same.ids.push(t.target_id);
      else acc.push({ key: uid("t"), type: t.target_type, ids: t.target_id ? [t.target_id] : [], need: t.need ?? "" });
      return acc;
    }, []) : [{ key: uid("t"), type: s.target_type === "poles" ? "pole" : s.target_type === "all" ? "all" : "member", ids: [], need: s.message ?? "" }];
    setForm({ id: s.id, nature: (s.nature === "replacement" || s.nature === "remplacement") ? "replacement" : "reinforcement", requester_member_id: s.requester_member_id ?? member?.id ?? "", program_id: s.program_id ?? "", event_name: s.event_name ?? "", event_date: s.event_date ?? "", response_deadline: s.response_deadline ?? "", message: s.message ?? "", targets: draftTargets });
    setFormOpen(true);
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!form.requester_member_id) throw new Error("Choisis la personne à l'origine du besoin.");
      if (!form.program_id) throw new Error("Choisis le programme concerné.");
      const p = selectablePrograms.find((x: any) => x.id === form.program_id) ?? allActivePrograms.find((x: any) => x.id === form.program_id);
      if (!p?.start_date) throw new Error("Le programme sélectionné doit avoir une date valide.");
      if (p.start_date < todayIso()) throw new Error("Une sollicitation ponctuelle ne peut être créée que pour un programme à venir.");
      if (!form.response_deadline) throw new Error("La date limite de réponse est obligatoire.");
      const eventDate = p.start_date;
      if (form.response_deadline < todayIso()) throw new Error("La date limite de réponse ne peut pas être dans le passé.");
      if (form.response_deadline > eventDate) throw new Error("La date limite de réponse doit être au plus tard à la date du programme.");
      const usableTargets = form.targets.filter((t) => t.type === "all" || t.ids.length > 0);
      if (!usableTargets.length) throw new Error("Ajoute au moins une cible : personne, pôle ou Toute la COM.");
      const id = form.id ?? uid();
      const requester = allMembers.find((m: any) => m.id === form.requester_member_id);
      const payload: any = {
        nature: form.nature,
        requester_member_id: form.requester_member_id,
        requester: requester?.full_name ?? null,
        program_id: p.id,
        event_name: p.title,
        event_date: eventDate,
        response_deadline: form.response_deadline,
        message: form.message.trim() || null,
        target_type: "mixed",
        target_name: usableTargets.map(targetDisplay).filter(Boolean).join(" · "),
        updated_at: new Date().toISOString(),
      };
      if (!form.id) Object.assign(payload, { id, status: "pending", created_by: userId ?? null });
      const write = (supabase as any).from("solicitations");
      const result = form.id ? await write.update(payload).eq("id", id) : await write.insert(payload);
      if (result.error) throw result.error;

      const existingRecipients = recs(id);
      const targetRows: Target[] = [];
      const memberTargetMap = new Map<string, string[]>();
      await (supabase as any).from("solicitation_recipient_targets").delete().eq("solicitation_id", id);
      await (supabase as any).from("solicitation_targets").delete().eq("solicitation_id", id);

      for (const t of usableTargets) {
        const entityIds = t.type === "all" ? [null] : t.ids;
        for (const entityId of entityIds) {
          const targetId = uid("st");
          const name = t.type === "all" ? "Toute la COM" : t.type === "member" ? memberName(entityId) : activePoles.find((p: any) => p.id === entityId)?.name ?? "Pôle";
          targetRows.push({ id: targetId, solicitation_id: id, target_type: t.type, target_id: entityId, target_name: name, need: t.need.trim() || null });
          const targetMembers = t.type === "all" ? resolveTargetMembers(t) : t.type === "member" ? [entityId as string] : activeMembers.filter((m: any) => links.some((l: any) => l.member_id === m.id && l.pole_id === entityId)).map((m: any) => m.id);
          targetMembers.forEach((memberId) => memberTargetMap.set(memberId, [...(memberTargetMap.get(memberId) ?? []), targetId]));
        }
      }
      const tr = await (supabase as any).from("solicitation_targets").insert(targetRows); if (tr.error) throw tr.error;
      const newMemberIds = [...memberTargetMap.keys()];
      const oldIds = existingRecipients.map((r) => r.member_id);
      const removed = oldIds.filter((x) => !newMemberIds.includes(x));
      if (removed.length) await (supabase as any).from("solicitation_recipients").delete().eq("solicitation_id", id).in("member_id", removed);
      const added = newMemberIds.filter((x) => !oldIds.includes(x));
      if (added.length) { const rr = await (supabase as any).from("solicitation_recipients").insert(added.map((member_id) => ({ solicitation_id: id, member_id, response: "pending" }))); if (rr.error) throw rr.error; }
      const mapRows = [...memberTargetMap.entries()].flatMap(([member_id, targetIds]) => targetIds.map((target_id) => ({ solicitation_id: id, member_id, target_id })));
      if (mapRows.length) { const mr = await (supabase as any).from("solicitation_recipient_targets").insert(mapRows); if (mr.error) throw mr.error; }
      await logAction({ action: form.id ? "sollicitation_modifiee" : "sollicitation_creee", entity: "solicitation", entityId: id, detail: `${payload.event_name} · échéance ${form.response_deadline}`, actorName: member?.full_name });
    },
    onSuccess: async () => {
      toast.success(form.id ? "Sollicitation modifiée" : "Sollicitation créée et envoyée"); setFormOpen(false);
      await Promise.all([qc.invalidateQueries({ queryKey: ["solicitations"] }), qc.invalidateQueries({ queryKey: ["solicitation-recipients"] }), qc.invalidateQueries({ queryKey: ["solicitation-targets"] }), qc.invalidateQueries({ queryKey: ["solicitation-recipient-targets"] })]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function applyOperationalEffect(s: any, r: Recipient) {
    if (!s.program_id) return;
    const memberId = r.member_id;
    if (s.nature === "replacement" || s.nature === "remplacement") {
      const replacedId = s.requester_member_id;
      if (!replacedId || replacedId === memberId) return;
      const { data: assignments } = await (supabase as any).from("program_assignments").select("id").eq("program_id", s.program_id);
      const assignmentIds = (assignments ?? []).map((a: any) => a.id);
      if (assignmentIds.length) {
        const { data: oldLinks } = await (supabase as any).from("program_assignment_members").select("assignment_id,member_id").in("assignment_id", assignmentIds).eq("member_id", replacedId);
        for (const link of oldLinks ?? []) {
          const { data: exists } = await (supabase as any).from("program_assignment_members").select("assignment_id").eq("assignment_id", link.assignment_id).eq("member_id", memberId).maybeSingle();
          if (!exists) await (supabase as any).from("program_assignment_members").insert({ assignment_id: link.assignment_id, member_id: memberId });
        }
        await (supabase as any).from("program_assignment_members").delete().in("assignment_id", assignmentIds).eq("member_id", replacedId);
      }
      await (supabase as any).from("program_member_responses").upsert({ program_id: s.program_id, member_id: memberId, status: "available", reason: `Remplacement accepté pour ${memberName(replacedId)}` }, { onConflict: "program_id,member_id" });
      return;
    }
    await (supabase as any).from("program_member_responses").upsert({ program_id: s.program_id, member_id: memberId, status: "available", reason: "Renfort ponctuel accepté" }, { onConflict: "program_id,member_id" });
    const memberTargetIds = maps(s.id).filter((x) => x.member_id === memberId).map((x) => x.target_id);
    const poleTarget = tgts(s.id).find((t) => memberTargetIds.includes(t.id) && t.target_type === "pole" && t.target_id);
    const fallbackPole = links.find((l: any) => l.member_id === memberId)?.pole_id;
    const poleId = poleTarget?.target_id ?? fallbackPole;
    if (!poleId) return;
    const { data: existingAssignment } = await (supabase as any).from("program_assignments").select("id").eq("program_id", s.program_id).eq("pole_id", poleId).maybeSingle();
    let assignmentId = existingAssignment?.id;
    if (!assignmentId) { assignmentId = uid("pa"); await (supabase as any).from("program_assignments").insert({ id: assignmentId, program_id: s.program_id, pole_id: poleId, tasks: poleTarget?.need ?? "Renfort ponctuel" }); }
    const { data: exists } = await (supabase as any).from("program_assignment_members").select("assignment_id").eq("assignment_id", assignmentId).eq("member_id", memberId).maybeSingle();
    if (!exists) await (supabase as any).from("program_assignment_members").insert({ assignment_id: assignmentId, member_id: memberId });
  }

  const answer = useMutation({
    mutationFn: async ({ s, r, response, note }: { s: any; r: Recipient; response: string; note?: string }) => {
      const patch: any = { response, responded_at: new Date().toISOString(), updated_at: new Date().toISOString(), reserve: response === "partial" ? note || null : null, refusal_reason: response === "refused" ? note || null : null };
      const { error } = await (supabase as any).from("solicitation_recipients").update(patch).eq("id", r.id); if (error) throw error;
      const next = recs(r.solicitation_id).map((x) => x.id === r.id ? { ...x, ...patch } : x);
      await (supabase as any).from("solicitations").update({ status: aggregate(next), decision_at: new Date().toISOString() }).eq("id", r.solicitation_id);
      if (response === "accepted") await applyOperationalEffect(s, r);
      await logAction({ action: "reponse_sollicitation", entity: "solicitation", entityId: s.id, detail: `${memberName(r.member_id)} : ${RLABEL[response]}`, actorName: member?.full_name });
    },
    onSuccess: async () => { toast.success("Réponse enregistrée"); await Promise.all([qc.invalidateQueries({ queryKey: ["solicitation-recipients"] }), qc.invalidateQueries({ queryKey: ["solicitations"] }), qc.invalidateQueries({ queryKey: ["programs"] })]); },
    onError: (e: Error) => toast.error(e.message),
  });

  const extendDeadline = useMutation({
    mutationFn: async ({ s, date }: { s: any; date: string }) => {
      const programDate = s.program_id ? (programs.data ?? []).find((p: any) => p.id === s.program_id)?.start_date : s.event_date;
      if (!date) throw new Error("Choisis une nouvelle date limite.");
      if (date < todayIso()) throw new Error("La nouvelle échéance ne peut pas être dans le passé.");
      if (programDate && programDate < todayIso()) throw new Error("Le programme a déjà eu lieu : l'échéance ne peut plus être prolongée.");
      if (programDate && date > programDate) throw new Error("L'échéance ne peut pas dépasser la date du programme.");
      if (s.response_deadline && date <= s.response_deadline) throw new Error("La nouvelle date doit prolonger l'échéance actuelle.");
      const { error } = await (supabase as any).from("solicitations").update({ response_deadline: date, updated_at: new Date().toISOString() }).eq("id", s.id); if (error) throw error;
      await logAction({ action: "echeance_sollicitation_prolongee", entity: "solicitation", entityId: s.id, detail: `Nouvelle échéance : ${date}`, actorName: member?.full_name });
    },
    onSuccess: async () => { toast.success("Date limite prolongée"); await qc.invalidateQueries({ queryKey: ["solicitations"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancel = useMutation({ mutationFn: async ({ s, note }: { s: any; note: string }) => { const { error } = await (supabase as any).from("solicitations").update({ status: "cancelled", cancellation_note: note || null, cancelled_at: new Date().toISOString(), cancelled_by: member?.full_name ?? null }).eq("id", s.id); if (error) throw error; await logAction({ action: "sollicitation_annulee", entity: "solicitation", entityId: s.id, detail: note || s.event_name, actorName: member?.full_name }); }, onSuccess: async () => { toast.success("Sollicitation annulée"); setDetail(null); await qc.invalidateQueries({ queryKey: ["solicitations"] }); }, onError: (e: Error) => toast.error(e.message) });
  const archive = useMutation({ mutationFn: async (s: any) => { const { error } = await (supabase as any).from("solicitations").update({ archived: true, archived_at: new Date().toISOString() }).eq("id", s.id); if (error) throw error; }, onSuccess: async () => { toast.success("Sollicitation archivée"); setDetail(null); await qc.invalidateQueries({ queryKey: ["solicitations"] }); } });

  function respond(s: any, r: Recipient, response: string) {
    let note = "";
    if (response === "partial") note = window.prompt("Indique ta réserve :") ?? "";
    if (response === "refused") note = window.prompt("Indique le motif du refus :") ?? "";
    if ((response === "partial" || response === "refused") && !note.trim()) return;
    answer.mutate({ s, r, response, note });
  }
  function needsForRecipient(sid: string, memberId: string) { const ids = maps(sid).filter((x) => x.member_id === memberId).map((x) => x.target_id); return tgts(sid).filter((t) => ids.includes(t.id) && t.need).map((t) => `${t.target_name} : ${t.need}`); }

  return (
    <AppShell title="Sollicitations ponctuelles" subtitle="Renforts ponctuels et remplacements">
      <div className="space-y-4">
        <div className="flex justify-end">{isStaff ? <Button onClick={openNew}>+ Nouvelle sollicitation</Button> : null}</div>
        <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6"><Input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} /><Filter value={status} set={setStatus} all="Tous les statuts" items={[["pending", "En attente"], ["accepted", "Acceptée"], ["partial", "Réponses mixtes"], ["refused", "Refusée"], ["cancelled", "Annulée"]]} /><Filter value={nature} set={setNature} all="Toutes les natures" items={[["reinforcement", "Renfort ponctuel"], ["replacement", "Remplacement"]]} /><Filter value={program} set={setProgram} all="Tous les programmes" items={allActivePrograms.map((p: any) => [p.id, p.title])} /><Filter value={sort} set={setSort} all="Tri" items={[["recent", "Plus récentes"], ["old", "Plus anciennes"]]} /></div>
        {!rows.length ? <EmptyState title="Aucune sollicitation" /> : <div className="space-y-4">{rows.map((s: any) => { const rs = recs(s.id); const agg = s.status === "cancelled" ? "cancelled" : (aggregate(rs) ?? s.status); return <Card key={s.id} className="cursor-pointer transition hover:border-icc-violet/40" onClick={() => setDetail(s)}><CardHeader><div className="flex flex-wrap justify-between gap-2"><div><CardTitle className="text-lg">{programName(s.program_id)}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{NLABEL[s.nature ?? ""] ?? "Sollicitation ponctuelle"} · {formatDate(s.event_date)}</p></div><Badge variant={agg === "pending" ? "outline" : "secondary"}>{agg === "partial" ? "Réponses mixtes" : STATUS_LABEL[agg] ?? RLABEL[agg] ?? agg}</Badge></div></CardHeader><CardContent className="space-y-2 text-sm"><p><b>{s.nature === "replacement" ? "Personne remplacée" : "Demandeur"} :</b> {memberName(s.requester_member_id) || s.requester || "—"}</p><p><b>Date limite :</b> <span className={s.response_deadline && s.response_deadline < todayIso() ? "font-bold text-red-600" : ""}>{deadlineText(s.response_deadline)}</span></p><p><b>Cibles :</b> {tgts(s.id).length ? tgts(s.id).map((t) => t.target_name).join(" · ") : s.target_name || "—"}</p><p className="text-muted-foreground">{rs.length} personne(s) sollicitée(s) · cliquer pour ouvrir la fiche complète</p></CardContent></Card>; })}</div>}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}><DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto"><DialogHeader><DialogTitle>{form.id ? "Modifier la sollicitation" : "Nouvelle sollicitation ponctuelle"}</DialogTitle></DialogHeader><div className="space-y-5"><div className="grid gap-3 md:grid-cols-2"><Field label="Nature"><Filter value={form.nature} set={(v) => setForm({ ...form, nature: v as FormState["nature"] })} all="Nature" items={[["reinforcement", "Renfort ponctuel"], ["replacement", "Remplacement"]]} /></Field><Field label={form.nature === "replacement" ? "Personne à remplacer / à l'origine du besoin" : "Personne à l'origine du besoin"}><Filter value={form.requester_member_id || "none"} set={(v) => setForm({ ...form, requester_member_id: v === "none" ? "" : v })} all="Choisir" items={activeMembers.map((m: any) => [m.id, m.full_name])} /></Field><Field label="Programme lié *"><Select value={form.program_id || undefined} onValueChange={(pid) => { const p = selectablePrograms.find((x: any) => x.id === pid); setForm({ ...form, program_id: pid, event_name: p?.title ?? "", event_date: p?.start_date ?? "", response_deadline: p?.response_deadline ?? "" }); }}><SelectTrigger><SelectValue placeholder="Sélectionner un programme" /></SelectTrigger><SelectContent>{selectablePrograms.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.title} · {formatDate(p.start_date)}</SelectItem>)}</SelectContent></Select>{selectablePrograms.length === 0 ? <span className="block text-[11px] text-red-600">Aucun programme à venir disponible.</span> : null}</Field><Info label="Date du programme" value={selectedProgram?.start_date ? formatDate(selectedProgram.start_date) : "Sélectionne d'abord un programme"} /><Field label="Date limite de réponse *"><Input type="date" min={todayIso()} max={effectiveProgramDate || undefined} value={form.response_deadline} onChange={(e) => setForm({ ...form, response_deadline: e.target.value })} /><span className="block text-[11px] text-muted-foreground">Obligatoire. Elle peut être prolongée plus tard, sans dépasser la date du programme.</span></Field></div><Field label="Contexte général / précision"><Textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></Field>
        <section className="space-y-3"><div className="flex items-center justify-between gap-2"><div><h3 className="font-black text-icc-violet">Cibles et besoins</h3><p className="text-xs text-muted-foreground">Tu peux cumuler personnes, pôles et Toute la COM. Chaque bloc peut avoir son besoin propre.</p></div><Button type="button" size="sm" variant="outline" onClick={() => setForm({ ...form, targets: [...form.targets, newTarget()] })}>+ Ajouter une cible</Button></div>{form.targets.map((t, index) => <div key={t.key} className="rounded-2xl border p-4"><div className="flex items-start justify-between gap-3"><b>Cible {index + 1}</b>{form.targets.length > 1 ? <Button type="button" size="sm" variant="ghost" onClick={() => setForm({ ...form, targets: form.targets.filter((x) => x.key !== t.key) })}>Retirer</Button> : null}</div><div className="mt-3 grid gap-3 md:grid-cols-2"><Field label="Type de cible"><Filter value={t.type} set={(v) => setForm({ ...form, targets: form.targets.map((x) => x.key === t.key ? { ...x, type: v as TargetDraft["type"], ids: [] } : x) })} all="Type" items={[["member", "Une ou plusieurs personnes"], ["pole", "Un ou plusieurs pôles"], ["all", "Toute la COM"]]} /></Field><Field label="Besoin spécifique"><Input placeholder="Ex. prise de photos, renfort montage…" value={t.need} onChange={(e) => setForm({ ...form, targets: form.targets.map((x) => x.key === t.key ? { ...x, need: e.target.value } : x) })} /></Field></div>{t.type === "member" ? <Checks items={activeMembers.map((m: any) => [m.id, m.full_name])} values={t.ids} set={(ids) => setForm({ ...form, targets: form.targets.map((x) => x.key === t.key ? { ...x, ids } : x) })} /> : null}{t.type === "pole" ? <Checks items={activePoles.map((p: any) => [p.id, p.name])} values={t.ids} set={(ids) => setForm({ ...form, targets: form.targets.map((x) => x.key === t.key ? { ...x, ids } : x) })} /> : null}{t.type === "all" ? <p className="mt-3 rounded-xl bg-muted/50 p-3 text-sm">Tous les membres actifs de la COM seront enregistrés individuellement comme destinataires.</p> : null}</div>)}</section></div><DialogFooter><Button variant="ghost" onClick={() => setFormOpen(false)}>Annuler</Button><Button disabled={save.isPending || !form.program_id} onClick={() => save.mutate()}>{form.id ? "Enregistrer les modifications" : "Créer et envoyer"}</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}><DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">{detail ? <><DialogHeader><DialogTitle>{programName(detail.program_id)}</DialogTitle></DialogHeader><div className="space-y-5"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Info label="Nature" value={NLABEL[detail.nature] ?? "Sollicitation ponctuelle"} /><Info label="Date" value={formatDate(detail.event_date)} /><Info label="Programme" value={programName(detail.program_id)} /><Info label="Date limite" value={deadlineText(detail.response_deadline)} /><Info label="Statut" value={detail.status === "partial" ? "Réponses mixtes" : STATUS_LABEL[detail.status] ?? detail.status} /></div>
        <div className="rounded-2xl border p-4"><h3 className="font-black text-icc-violet">Origine de la demande</h3><div className="mt-3 grid gap-3 sm:grid-cols-2"><Info label={detail.nature === "replacement" ? "Personne remplacée" : "Personne à l'origine du besoin"} value={memberName(detail.requester_member_id) || detail.requester || "—"} /><Info label="Demande saisie par" value={creatorName(detail)} /></div>{detail.message ? <div className="mt-3 rounded-xl bg-muted/40 p-3 text-sm"><b>Contexte général</b><p className="mt-1">{detail.message}</p></div> : null}</div>
        <div className="rounded-2xl border p-4"><h3 className="font-black text-icc-violet">Cibles et besoins</h3><div className="mt-3 space-y-2">{tgts(detail.id).length ? tgts(detail.id).map((t) => <div key={t.id} className="rounded-xl bg-muted/40 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><b>{t.target_name}</b><Badge variant="outline">{t.target_type === "member" ? "Personne" : t.target_type === "pole" ? "Pôle" : "Toute la COM"}</Badge></div><p className="mt-1 text-sm">{t.need || "Besoin non précisé"}</p></div>) : <p className="text-sm text-muted-foreground">{detail.target_name || "—"}</p>}</div></div>
        <div className="rounded-2xl border p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-black text-icc-violet">Réponses individuelles</h3><span className="text-sm text-muted-foreground">{recs(detail.id).length} personne(s)</span></div><div className="mt-3 grid gap-3 md:grid-cols-2">{recs(detail.id).map((r) => { const needs = needsForRecipient(detail.id, r.member_id); return <div key={r.id} className="rounded-xl border p-3 text-sm"><div className="flex flex-wrap items-start justify-between gap-2"><b>{memberName(r.member_id)}</b><Badge variant={r.response === "pending" ? "outline" : "secondary"}>{RLABEL[r.response] ?? r.response}</Badge></div>{needs.length ? <div className="mt-2 text-xs text-muted-foreground">{needs.map((n) => <p key={n}>• {n}</p>)}</div> : null}{r.reserve ? <p className="mt-2"><b>Réserve :</b> {r.reserve}</p> : null}{r.refusal_reason ? <p className="mt-2"><b>Motif :</b> {r.refusal_reason}</p> : null}{member?.id === r.member_id && r.response === "pending" && detail.status !== "cancelled" ? <div className="mt-3 flex flex-wrap gap-1"><Button size="sm" onClick={() => respond(detail, r, "accepted")}>Accepter</Button><Button size="sm" variant="outline" onClick={() => respond(detail, r, "partial")}>Accepter partiellement</Button><Button size="sm" variant="outline" onClick={() => respond(detail, r, "refused")}>Refuser</Button></div> : null}</div>; })}</div></div>
        {detail.status === "cancelled" ? <div className="rounded-2xl border p-4"><h3 className="font-black text-icc-violet">Annulation</h3><p className="mt-2 text-sm">{detail.cancellation_note || "Aucun motif renseigné."}</p>{detail.cancelled_by ? <p className="mt-1 text-xs text-muted-foreground">Annulée par {detail.cancelled_by}</p> : null}</div> : null}
        {isStaff ? <div className="rounded-2xl border p-4"><h3 className="font-black text-icc-violet">Actions</h3><div className="mt-3 flex flex-wrap gap-2">{detail.status !== "cancelled" ? <Button size="sm" variant="outline" onClick={() => { setDetail(null); openEdit(detail); }}>Modifier</Button> : null}{detail.status !== "cancelled" && detail.event_date >= todayIso() ? <Button size="sm" variant="outline" onClick={() => { const max = (programs.data ?? []).find((p: any) => p.id === detail.program_id)?.start_date; const date = window.prompt(`Nouvelle date limite${max ? ` (au plus tard ${formatDate(max)})` : ""} :`, detail.response_deadline ?? "") ?? ""; if (date) extendDeadline.mutate({ s: detail, date }); }}>Prolonger le délai</Button> : null}{detail.status !== "cancelled" ? <Button size="sm" variant="outline" onClick={() => { const note = window.prompt("Motif de l'annulation (facultatif) :") ?? ""; if (window.confirm("Confirmer l'annulation de cette sollicitation ?")) cancel.mutate({ s: detail, note }); }}>Annuler la demande</Button> : null}{isAdmin ? <Button size="sm" variant="ghost" onClick={() => { if (window.confirm("Archiver cette sollicitation ?")) archive.mutate(detail); }}>Archiver</Button> : null}</div><p className="mt-2 text-xs text-muted-foreground">Le délai peut être prolongé tant que la date du programme n'est pas passée, sans jamais la dépasser. Modifier permet aussi d'ajouter ou retirer des cibles si le besoin évolue.</p></div> : null}
      </div></> : null}</DialogContent></Dialog>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="space-y-1"><span className="text-xs font-semibold text-muted-foreground">{label}</span>{children}</label>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-muted/40 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{value}</p></div>; }
function Filter({ value, set, all, items }: { value: string; set: (v: string) => void; all: string; items: string[][] }) { return <Select value={value} onValueChange={set}><SelectTrigger><SelectValue placeholder={all} /></SelectTrigger><SelectContent>{value === "all" || !items.some((i) => i[0] === "all") ? <SelectItem value="all">{all}</SelectItem> : null}{items.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>; }
function Checks({ items, values, set }: { items: string[][]; values: string[]; set: (v: string[]) => void }) { return <div className="mt-3 max-h-52 space-y-1 overflow-y-auto rounded-xl border p-2">{items.map(([id, label]) => <label key={id} className="flex items-center gap-2 rounded-lg p-2 hover:bg-muted"><Checkbox checked={values.includes(id)} onCheckedChange={(c) => set(c ? [...values, id] : values.filter((x) => x !== id))} />{label}</label>)}</div>; }