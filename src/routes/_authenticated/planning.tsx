import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { AppShell, EmptyState } from "@/components/AppShell";
import { formatDate, polesQuery, programsQuery, solicitationsQuery, STATUS_LABEL } from "@/lib/icc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/planning")({
  head: () => ({
    meta: [
      { title: "Planning — COM ICC Le Mans" },
      {
        name: "description",
        content: "Planning unifié du pôle Communication : programmes et sollicitations classés par mois.",
      },
      { property: "og:title", content: "Planning — COM ICC Le Mans" },
      { property: "og:description", content: "Programmes et sollicitations du pôle Communication, mois par mois." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Planning,
});

type Entry = {
  id: string;
  kind: "program" | "solicitation";
  title: string;
  date: string | null;
  status: string;
  detail: string;
};

function Planning() {
  const programs = useQuery(programsQuery);
  const solicitations = useQuery(solicitationsQuery);
  const poles = useQuery(polesQuery);

  const poleName = useMemo(
    () => new Map((poles.data ?? []).map((p) => [p.id, p.name])),
    [poles.data],
  );

  const months = useMemo(() => {
    const entries: Entry[] = [
      ...(programs.data ?? []).map((p) => ({
        id: `p-${p.id}`,
        kind: "program" as const,
        title: p.title,
        date: p.start_date,
        status: p.status,
        detail:
          p.assignments
            .map((a) => poleName.get(a.pole_id))
            .filter(Boolean)
            .join(" · ") || "Aucun pôle affecté",
      })),
      ...(solicitations.data ?? []).map((s) => ({
        id: `s-${s.id}`,
        kind: "solicitation" as const,
        title: s.event_name ?? "Sollicitation",
        date: s.event_date,
        status: s.status,
        detail: s.requester ?? "Demandeur inconnu",
      })),
    ].sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"));

    const grouped = new Map<string, Entry[]>();
    for (const entry of entries) {
      const key = entry.date
        ? new Date(`${entry.date}T12:00:00`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
        : "Sans date";
      grouped.set(key, [...(grouped.get(key) ?? []), entry]);
    }
    return [...grouped.entries()];
  }, [programs.data, solicitations.data, poleName]);

  if (programs.isLoading || solicitations.isLoading) {
    return (
      <AppShell title="Planning">
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Planning" subtitle="Programmes et sollicitations, source unique">
      {isStaff ? (
        <div className="mb-6">
          <ConflictsPanel limit={4} />
        </div>
      ) : null}
      {months.length === 0 ? (
        <EmptyState title="Planning vide" description="Aucun programme ni sollicitation enregistré." />
      ) : (
        <div className="space-y-8">

          {months.map(([month, entries]) => (
            <section key={month}>
              <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                {month}
              </h2>
              <div className="space-y-3">
                {entries.map((entry) => (
                  <Card key={entry.id}>
                    <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant={entry.kind === "program" ? "default" : "outline"}>
                            {entry.kind === "program" ? "Programme" : "Sollicitation"}
                          </Badge>
                          <p className="font-medium">{entry.title}</p>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{entry.detail}</p>
                      </div>
                      <div className="text-sm sm:text-right">
                        <p className="font-medium">{formatDate(entry.date)}</p>
                        <p className="text-muted-foreground">{STATUS_LABEL[entry.status] ?? entry.status}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </AppShell>
  );
}
