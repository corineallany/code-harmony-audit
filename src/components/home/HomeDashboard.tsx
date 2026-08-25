import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { useCurrentRole } from "@/hooks/useAuth";
import { membersQuery, programsQuery, solicitationsQuery } from "@/lib/icc";

function daysUntilBirthday(member: any) {
  if (!member.birthday_day || !member.birthday_month) return 999;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(now.getFullYear(), member.birthday_month - 1, member.birthday_day);
  if (next < today) next = new Date(now.getFullYear() + 1, member.birthday_month - 1, member.birthday_day);
  return Math.round((next.getTime() - today.getTime()) / 86400000);
}

/** Tableau de bord personnel de l'accueil, indicateurs de l'application d'origine. */
export function HomeDashboard() {
  const { member } = useCurrentRole();
  const programs = useQuery(programsQuery);
  const solicitations = useQuery(solicitationsQuery);
  const members = useQuery(membersQuery);

  const memberId = member?.id ?? null;
  const allPrograms = programs.data ?? [];
  const mine = memberId ? allPrograms.filter((p) => p.assignments.some((a) => a.memberIds.includes(memberId))) : [];
  const pendingSolicitations = (solicitations.data ?? []).filter((s) => s.status === "pending");
  const myPendingResponses = memberId ? mine.filter((p) => p.responses.some((r) => r.member_id === memberId && r.status === "pending") || !p.responses.some((r) => r.member_id === memberId)) : [];
  const pendingCount = pendingSolicitations.length + myPendingResponses.length;
  const today = new Date().toISOString().slice(0, 10);
  const myServices = mine.filter((p) => (p.start_date ?? "9999") >= today);
  const allMembers = members.data?.members ?? [];
  const training = allMembers.filter((m) => m.status === "active" && !!m.training_start && !m.training_done);
  const active = allMembers.filter((m) => m.status === "active");
  const birthdays = allMembers.filter((m:any) => m.status !== "archived" && daysUntilBirthday(m) <= 7);

  const cards = [
    { icon: "🔔", value: pendingCount, label: "Sollicitations et programmes en attente", to: "/sollicitations" },
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
    </section>
  );
}
