import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { useCurrentRole } from "@/hooks/useAuth";
import { membersQuery, programsQuery, solicitationsQuery } from "@/lib/icc";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

function daysUntilBirthday(member: any) {
  if (!member.birthday_day || !member.birthday_month) return 999;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(now.getFullYear(), member.birthday_month - 1, member.birthday_day);
  if (next < today) next = new Date(now.getFullYear() + 1, member.birthday_month - 1, member.birthday_day);
  return Math.round((next.getTime() - today.getTime()) / 86400000);
}

function deadlineLabel(date?: string | null) {
  if (!date) return "Sans échéance";
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(`${date}T00:00:00`);
  const days = Math.ceil((d.getTime() - today.getTime()) / 86400000);
  if (days < 0) return `En retard de ${Math.abs(days)} j`;
  if (days === 0) return "À répondre aujourd’hui";
  return `À répondre avant le ${d.toLocaleDateString("fr-FR")}`;
}

/** Tableau de bord personnel de l'accueil, indicateurs de l'application d'origine. */
export function HomeDashboard() {
  const { member, userId } = useCurrentRole();
  const programs = useQuery(programsQuery);
  const solicitations = useQuery(solicitationsQuery);
  const members = useQuery(membersQuery);
  const recipients = useQuery({ queryKey:["home-solicitation-recipients", member?.id], queryFn: async () => { if (!member?.id) return []; const { data, error } = await (supabase as any).from("solicitation_recipients").select("*").eq("member_id", member.id); if (error) throw error; return data ?? []; }, enabled: !!member?.id });

  const memberId = member?.id ?? null;
  const allPrograms = programs.data ?? [];
  const mine = memberId ? allPrograms.filter((p) => p.assignments.some((a) => a.memberIds.includes(memberId))) : [];
  const allSolicitations = (solicitations.data ?? []).filter((s:any) => !s.archived);
  const recipientBySolicitation = new Map((recipients.data ?? []).map((r:any) => [r.solicitation_id, r]));
  const toAnswer = allSolicitations.filter((s:any) => s.status !== "cancelled" && recipientBySolicitation.get(s.id)?.response === "pending");
  const myRequests = allSolicitations.filter((s:any) => s.created_by === userId || s.requester_member_id === memberId);
  const myPendingResponses = memberId ? mine.filter((p) => p.responses.some((r) => r.member_id === memberId && r.status === "pending") || !p.responses.some((r) => r.member_id === memberId)) : [];
  const pendingCount = toAnswer.length + myPendingResponses.length;
  const today = new Date().toISOString().slice(0, 10);
  const myServices = mine.filter((p) => (p.start_date ?? "9999") >= today);
  const allMembers = members.data?.members ?? [];
  const training = allMembers.filter((m) => m.status === "active" && !!m.training_start && !m.training_done);
  const active = allMembers.filter((m) => m.status === "active");
  const birthdays = allMembers.filter((m:any) => m.status !== "archived" && daysUntilBirthday(m) <= 7);

  const cards = [
    { icon: "🔔", value: pendingCount, label: "À traiter", to: "/sollicitations" },
    { icon: "✅", value: myServices.length, label: "Mes services", to: "/mon-planning" },
    { icon: "🎓", value: training.length, label: "Membres en formation", to: "/trombinoscope" },
    { icon: "👥", value: active.length, label: "Membres actifs maintenant", to: "/trombinoscope" },
    { icon: "🎂", value: birthdays.length, label: "Anniversaires dans les 7 jours", to: "/trombinoscope" },
  ];

  return (
    <section className="mt-6 rounded-3xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-black text-icc-violet">Tableau de bord</h2><p className="text-xs text-muted-foreground">Tes informations et services personnels.</p></div>
        <Link to="/mon-planning" className="rounded-lg bg-icc-violet px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-icc-violet-hover">📅 Mon planning</Link>
      </div>
      {birthdays.length > 0 ? <Link to="/trombinoscope" className="mt-3 block rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs"><b>🎂 À prévoir :</b> {birthdays.map((m:any) => `${m.full_name}${daysUntilBirthday(m)===0?" aujourd’hui":` dans ${daysUntilBirthday(m)} j`}`).join(" • ")}</Link> : null}
      <div className="mt-3.5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{cards.map((card) => <Link key={card.label} to={card.to} className="rounded-2xl border border-border p-4 text-left transition-colors hover:border-icc-violet/40"><span className="text-base">{card.icon}</span><b className="mt-1 block text-2xl text-icc-violet">{card.value}</b><small className="text-muted-foreground">{card.label}</small></Link>)}</div>

      <div className="mt-5 rounded-2xl border border-border p-4">
        <div className="flex items-center justify-between gap-2"><div><h3 className="font-black text-icc-violet">Mes sollicitations</h3><p className="text-xs text-muted-foreground">Demandes à traiter et suivi de tes demandes.</p></div><Link to="/sollicitations" className="text-xs font-bold text-icc-violet">Tout voir →</Link></div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div><div className="mb-2 flex items-center justify-between"><b className="text-sm">À répondre</b><Badge variant="outline">{toAnswer.length}</Badge></div><div className="space-y-2">{toAnswer.slice(0,4).map((s:any) => <Link key={s.id} to="/sollicitations" className="block rounded-xl bg-muted/40 p-3 text-sm hover:bg-muted"><div className="flex justify-between gap-2"><b>{s.event_name || "Sollicitation ponctuelle"}</b><span className="text-xs text-muted-foreground">{deadlineLabel(s.response_deadline)}</span></div><p className="mt-1 text-xs text-muted-foreground">{s.nature === "replacement" ? "Remplacement" : "Renfort ponctuel"}</p></Link>)}{!toAnswer.length ? <p className="rounded-xl bg-muted/30 p-3 text-xs text-muted-foreground">Aucune sollicitation à répondre.</p> : null}</div></div>
          <div><div className="mb-2 flex items-center justify-between"><b className="text-sm">Mes demandes</b><Badge variant="outline">{myRequests.length}</Badge></div><div className="space-y-2">{myRequests.slice(0,4).map((s:any) => <Link key={s.id} to="/sollicitations" className="block rounded-xl bg-muted/40 p-3 text-sm hover:bg-muted"><div className="flex justify-between gap-2"><b>{s.event_name || "Sollicitation ponctuelle"}</b><span className="text-xs text-muted-foreground">{deadlineLabel(s.response_deadline)}</span></div><p className="mt-1 text-xs text-muted-foreground">Statut : {s.status === "pending" ? "En attente" : s.status}</p></Link>)}{!myRequests.length ? <p className="rounded-xl bg-muted/30 p-3 text-xs text-muted-foreground">Aucune demande émise.</p> : null}</div></div>
        </div>
      </div>
    </section>
  );
}
