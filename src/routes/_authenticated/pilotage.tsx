import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { AppShell, EmptyState } from "@/components/AppShell";
import { useConflicts } from "@/components/ConflictsPanel";
import { useCurrentRole } from "@/hooks/useAuth";
import {
  availabilityQuery,
  formatDate,
  membersQuery,
  polesQuery,
  programsQuery,
  solicitationsQuery,
  tasksQuery,
  TASK_STATUS_LABEL,
} from "@/lib/icc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/pilotage")({
  head: () => ({
    meta: [
      { title: "Pilotage — COM ICC Le Mans" },
      {
        name: "description",
        content:
          "Indicateurs du pôle Communication ICC Le Mans : taux de réponse, charge par pôle, tâches, conflits et disponibilités.",
      },
      { property: "og:title", content: "Pilotage — COM ICC Le Mans" },
      { property: "og:description", content: "Indicateurs de suivi et priorités du pôle Communication." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Pilotage,
});

function Kpi({ value, label, hint }: { value: string | number; label: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="font-display text-2xl font-semibold text-icc-violet">{value}</p>
        <p className="mt-0.5 text-xs font-semibold">{label}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function Pilotage() {
  const { isStaff, loading: roleLoading } = useCurrentRole();
  const programs = useQuery(programsQuery);
  const poles = useQuery(polesQuery);
  const members = useQuery(membersQuery);
  const tasks = useQuery(tasksQuery);
  const solicitations = useQuery(solicitationsQuery);
  const availability = useQuery(availabilityQuery);
  const { conflicts } = useConflicts();

  const today = new Date().toISOString().slice(0, 10);

  const stats = useMemo(() => {
    const rows = programs.data ?? [];
    const upcoming = rows.filter((p) => (p.start_date ?? "") >= today);
    const solicited = upcoming.reduce(
      (acc, p) => acc + new Set(p.assignments.flatMap((a) => a.memberIds)).size,
      0,
    );
    const answered = upcoming.reduce(
      (acc, p) => acc + p.responses.filter((r) => r.status !== "pending").length,
      0,
    );
    const perPole = new Map<string, number>();
    for (const p of upcoming) {
      for (const a of p.assignments) {
        perPole.set(a.pole_id, (perPole.get(a.pole_id) ?? 0) + Math.max(a.memberIds.length, 1));
      }
    }
    return {
      upcoming,
      responseRate: solicited > 0 ? Math.round((answered / solicited) * 100) : 0,
      solicited,
      answered,
      perPole,
    };
  }, [programs.data, today]);

  const taskCounts = useMemo(() => {
    const counts: Record<string, number> = { todo: 0, doing: 0, done: 0 };
    for (const t of tasks.data ?? []) counts[t.status] = (counts[t.status] ?? 0) + 1;
    return counts;
  }, [tasks.data]);

  const pendingAvailability = (availability.data ?? []).filter((a) => a.status === "pending").length;
  const pendingSolicitations = (solicitations.data ?? []).filter((s) => s.status === "pending").length;
  const activeMembers = (members.data?.members ?? []).filter((m) => m.active !== false).length;

  if (roleLoading || programs.isLoading) {
    return (
      <AppShell title="Pilotage">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </AppShell>
    );
  }

  if (!isStaff) {
    return (
      <AppShell title="Pilotage">
        <EmptyState
          title="Accès réservé"
          description="Le pilotage est réservé à la responsable, aux adjoints, aux référents et à l'administrateur technique."
        />
      </AppShell>
    );
  }

  const maxCharge = Math.max(1, ...[...stats.perPole.values()]);

  return (
    <AppShell title="Pilotage" subtitle="Indicateurs consolidés, calculés en temps réel">
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi value={stats.upcoming.length} label="Programmes à venir" hint="À partir d’aujourd’hui" />
          <Kpi
            value={`${stats.responseRate}%`}
            label="Taux de réponse"
            hint={`${stats.answered} réponse(s) sur ${stats.solicited} sollicitation(s)`}
          />
          <Kpi value={conflicts.length} label="Conflits détectés" hint="Chevauchements et couverture" />
          <Kpi value={activeMembers} label="Équipiers actifs" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi value={taskCounts["todo"] ?? 0} label={TASK_STATUS_LABEL["todo"] ?? "À faire"} />
          <Kpi value={taskCounts["doing"] ?? 0} label={TASK_STATUS_LABEL["doing"] ?? "En cours"} />
          <Kpi value={pendingAvailability} label="Disponibilités à valider" />
          <Kpi value={pendingSolicitations} label="Sollicitations en attente" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Charge par pôle (programmes à venir)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(poles.data ?? []).length === 0 ? (
                <EmptyState title="Aucun pôle" />
              ) : (
                (poles.data ?? []).map((pole) => {
                  const value = stats.perPole.get(pole.id) ?? 0;
                  return (
                    <div key={pole.id}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{pole.name}</span>
                        <span className="text-muted-foreground">{value} affectation(s)</span>
                      </div>
                      <Progress value={(value / maxCharge) * 100} className="mt-1 h-2" />
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Prochains programmes</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.upcoming.length === 0 ? (
                <EmptyState title="Aucun programme à venir" />
              ) : (
                <ul className="divide-y divide-border">
                  {stats.upcoming.slice(0, 8).map((p) => {
                    const solicitedCount = new Set(p.assignments.flatMap((a) => a.memberIds)).size;
                    const answeredCount = p.responses.filter((r) => r.status !== "pending").length;
                    return (
                      <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                        <div>
                          <p className="font-medium">{p.title}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(p.start_date)}</p>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {answeredCount}/{solicitedCount} réponse(s)
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
