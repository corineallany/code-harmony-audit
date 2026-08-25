import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { AppShell, EmptyState } from "@/components/AppShell";
import { ROLE_LABEL, useCurrentRole } from "@/hooks/useAuth";
import { membersQuery, polesQuery } from "@/lib/icc";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/trombinoscope")({
  head: () => ({ meta: [{ title: "Trombinoscope — COM ICC Le Mans" }] }),
  component: Trombinoscope,
});

const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

function memberState(m: any) {
  if (m.status === "archived") return "archived";
  if (m.status === "inactive") return "inactive";
  if (m.status === "active" && m.training_start && !m.training_done) return "training";
  return "active";
}

function stateLabel(m: any) {
  const state = memberState(m);
  if (state === "training") return "En formation";
  if (state === "inactive") return "Inactif";
  if (state === "archived") return "Archivé";
  return "Actif";
}

function birthdayLabel(m: any) {
  if (!m.birthday_day || !m.birthday_month) return null;
  return `${m.birthday_day} ${MONTHS[m.birthday_month - 1]?.toLowerCase() ?? ""}`;
}

function daysUntilBirthday(m: any) {
  if (!m.birthday_day || !m.birthday_month) return 999;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(now.getFullYear(), m.birthday_month - 1, m.birthday_day);
  if (next < today) next = new Date(now.getFullYear() + 1, m.birthday_month - 1, m.birthday_day);
  return Math.round((next.getTime() - today.getTime()) / 86400000);
}

function Trombinoscope() {
  const members = useQuery(membersQuery);
  const poles = useQuery(polesQuery);
  const { isAdmin } = useCurrentRole();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [role, setRole] = useState("all");
  const [pole, setPole] = useState("all");
  const [sort, setSort] = useState("name");

  const poleName = useMemo(() => new Map((poles.data ?? []).map((p) => [p.id, p.name])), [poles.data]);
  const activePoles = useMemo(() => (poles.data ?? []).filter((p) => !p.archived), [poles.data]);

  const rows = useMemo(() => {
    const links = members.data?.links ?? [];
    const needle = search.trim().toLowerCase();
    const list = (members.data?.members ?? []).map((raw) => {
      const m = raw as any;
      const memberPoles = links.filter((l) => l.member_id === m.id).map((l) => ({ id: l.pole_id, name: poleName.get(l.pole_id) ?? "Pôle", referent: l.is_referent }));
      return { ...m, poles: memberPoles };
    }).filter((m) => {
      if (m.status === "archived") return status === "archived";
      const matchesText = !needle || [m.full_name, m.login_email, m.affiliations].some((v) => v?.toLowerCase().includes(needle));
      const matchesStatus = status === "all" || memberState(m) === status;
      const matchesRole = role === "all" || m.base_role === role || (role === "referent" && m.poles.some((p: any) => p.referent));
      const matchesPole = pole === "all" || m.poles.some((p: any) => p.id === pole);
      return matchesText && matchesStatus && matchesRole && matchesPole;
    });

    list.sort((a, b) => {
      if (sort === "arrival-new") return ((b.arrival_year ?? 0) * 12 + (b.arrival_month ?? 0)) - ((a.arrival_year ?? 0) * 12 + (a.arrival_month ?? 0));
      if (sort === "arrival-old") return ((a.arrival_year ?? 9999) * 12 + (a.arrival_month ?? 12)) - ((b.arrival_year ?? 9999) * 12 + (b.arrival_month ?? 12));
      if (sort === "birthday") return daysUntilBirthday(a) - daysUntilBirthday(b);
      return a.full_name.localeCompare(b.full_name, "fr");
    });
    return list;
  }, [members.data, poleName, search, status, role, pole, sort]);

  const upcoming = useMemo(() => rows.filter((m) => m.status !== "archived" && daysUntilBirthday(m) <= 7), [rows]);

  return (
    <AppShell
      title="Trombinoscope"
      subtitle={`${rows.length} membre(s)`}
      actions={isAdmin ? <Button asChild size="sm"><Link to="/membre/$id" params={{ id: "nouveau" }}>+ Ajouter un membre</Link></Button> : undefined}
    >
      {upcoming.length > 0 ? (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm">
          <b>🎂 Anniversaire à venir</b>
          <p className="mt-1 text-muted-foreground">{upcoming.map((m) => `${m.full_name} · ${birthdayLabel(m)}${daysUntilBirthday(m) === 0 ? " · aujourd’hui" : ` · J-${daysUntilBirthday(m)}`}`).join(" • ")}</p>
        </div>
      ) : null}

      <div className="mb-5 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
        <Input placeholder="Rechercher un membre…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Filter value={status} onChange={setStatus} items={[["all","Tous les statuts"],["active","Actif"],["training","En formation"],["inactive","Inactif"],["archived","Archivé"]]} />
        <Filter value={role} onChange={setRole} items={[["all","Tous les rôles"],["responsable","Responsable"],["adjoint","Adjoint"],["referent","Référent"],["equipier","Équipier"],["admin_technique","Admin technique"]]} />
        <Filter value={pole} onChange={setPole} items={[["all","Tous les pôles"], ...activePoles.map((p) => [p.id, p.name])]} />
        <Filter value={sort} onChange={setSort} items={[["name","Nom A–Z"],["arrival-new","Intégration récente"],["arrival-old","Ancienneté"],["birthday","Anniversaire proche"]]} />
      </div>

      {members.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[0,1,2,3,4,5].map((i) => <Skeleton key={i} className="h-44 rounded-xl" />)}</div>
      ) : rows.length === 0 ? <EmptyState title="Aucun membre trouvé" /> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((m) => {
            const state = memberState(m);
            const arrival = m.arrival_year ? `${m.arrival_month ? `${MONTHS[m.arrival_month - 1]} ` : ""}${m.arrival_year}` : null;
            const referentPoles = m.poles.filter((p: any) => p.referent);
            return (
              <Link key={m.id} to="/membre/$id" params={{ id: m.id }} className="block">
                <Card className={`h-full transition hover:border-icc-violet/50 hover:shadow-sm ${state === "archived" ? "opacity-50" : state === "inactive" ? "opacity-70" : ""}`}>
                  <CardContent className="p-4">
                    <div className="flex gap-3">
                      <Avatar className="size-16 shrink-0">
                        {m.photo_url ? <AvatarImage src={m.photo_url} alt={m.full_name} /> : null}
                        <AvatarFallback>{initials(m.full_name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="truncate font-black text-icc-violet">{m.full_name}</p>
                          <Badge variant={state === "active" ? "default" : "secondary"}>{stateLabel(m)}</Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-1">
                          {m.base_role !== "equipier" && m.base_role !== "referent" ? <Badge variant="outline">{ROLE_LABEL[m.base_role] ?? m.base_role}</Badge> : null}
                          {m.is_icc ? <Badge variant="outline">✨ ICC</Badge> : null}
                          {m.is_ejp ? <Badge variant="outline">⭐ EJP</Badge> : null}
                          {referentPoles.length ? <><Badge variant="outline">🏅 Référent</Badge><strong className="text-xs">{referentPoles.map((p: any) => p.name).join(" · ")}</strong></> : null}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                      {arrival ? <p>📍 Intégration : {arrival}</p> : null}
                      {birthdayLabel(m) ? <p>🎂 Anniversaire : {birthdayLabel(m)}</p> : null}
                      {state === "training" ? <p>🎓 Formation : {m.training_start ? new Date(m.training_start).toLocaleDateString("fr-FR") : "en cours"}{m.training_end_planned ? ` → prévue au ${new Date(m.training_end_planned).toLocaleDateString("fr-FR")}` : ""}</p> : null}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1">
                      {m.poles.length === 0 ? <span className="text-xs text-muted-foreground">Sans pôle</span> : m.poles.map((p: any) => (
                        <Badge key={p.id} variant="secondary" className="text-[0.7rem]">{p.name}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

function Filter({ value, onChange, items }: { value: string; onChange: (v: string) => void; items: string[][] }) {
  return <Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{items.map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>;
}
