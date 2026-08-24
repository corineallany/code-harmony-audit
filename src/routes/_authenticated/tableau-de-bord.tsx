import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { AppShell, EmptyState } from "@/components/AppShell";
import { formatDate, membersQuery, polesQuery, programsQuery, solicitationsQuery } from "@/lib/icc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/tableau-de-bord")({
  head: () => ({
    meta: [
      { title: "Tableau de bord — COM ICC Le Mans" },
      {
        name: "description",
        content: "Vue d'ensemble du pôle Communication : prochains programmes, sollicitations en attente et effectifs.",
      },
      { property: "og:title", content: "Tableau de bord — COM ICC Le Mans" },
      { property: "og:description", content: "Programmes à venir, sollicitations en attente et effectifs du pôle." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const programs = useQuery(programsQuery);
  const solicitations = useQuery(solicitationsQuery);
  const members = useQuery(membersQuery);
  const poles = useQuery(polesQuery);

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = (programs.data ?? []).filter((p) => (p.start_date ?? "9999") >= today).slice(0, 5);
  const pending = (solicitations.data ?? []).filter((s) => s.status === "pending");
  const loading = programs.isLoading || solicitations.isLoading || members.isLoading;

  const stats = [
    { label: "Programmes à venir", value: upcoming.length, to: "/programmes" },
    { label: "Sollicitations en attente", value: pending.length, to: "/sollicitations" },
    { label: "Équipiers actifs", value: (members.data?.members ?? []).filter((m) => m.status === "active").length, to: "/trombinoscope" },
    { label: "Pôles", value: (poles.data ?? []).filter((p) => !p.archived).length, to: "/poles" },
  ];

  return (
    <AppShell title="Tableau de bord" subtitle="Vue d’ensemble du pôle Communication">
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <Link key={s.label} to={s.to}>
              <Card className="h-full transition-colors hover:border-primary/50">
                <CardContent className="p-5">
                  <p className="font-display text-3xl font-semibold">{s.value}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Prochains programmes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcoming.length === 0 ? (
              <EmptyState title="Aucun programme à venir" />
            ) : (
              upcoming.map((p) => (
                <div key={p.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{p.title}</p>
                    <Badge variant="secondary">{p.assignments.length} pôle(s)</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{formatDate(p.start_date)}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sollicitations en attente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pending.length === 0 ? (
              <EmptyState title="Aucune sollicitation en attente" />
            ) : (
              pending.slice(0, 6).map((s) => (
                <div key={s.id} className="rounded-lg border border-border p-3">
                  <p className="font-medium">{s.event_name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {s.requester ?? "Demandeur inconnu"} · {formatDate(s.event_date)}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
