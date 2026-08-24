import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AppShell, EmptyState } from "@/components/AppShell";
import { auditQuery, formatDateTime } from "@/lib/icc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/pilotage")({
  head: () => ({
    meta: [
      { title: "Pilotage — COM ICC Le Mans" },
      {
        name: "description",
        content: "Journal d'activité du pôle Communication : traçabilité des décisions et des enregistrements.",
      },
      { property: "og:title", content: "Pilotage — COM ICC Le Mans" },
      { property: "og:description", content: "Journal unique d'activité et de traçabilité du pôle." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Pilotage,
});

function Pilotage() {
  const audit = useQuery(auditQuery);

  return (
    <AppShell title="Pilotage" subtitle="Journal d’activité unique">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">100 dernières actions</CardTitle>
        </CardHeader>
        <CardContent>
          {audit.isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : (audit.data ?? []).length === 0 ? (
            <EmptyState title="Journal vide" />
          ) : (
            <ul className="divide-y divide-border">
              {(audit.data ?? []).map((entry) => (
                <li key={entry.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium">{entry.action}</p>
                    {entry.detail ? <p className="text-sm text-muted-foreground">{entry.detail}</p> : null}
                  </div>
                  <p className="text-xs text-muted-foreground sm:text-right">
                    {entry.actor_name ? `${entry.actor_name} · ` : ""}
                    {formatDateTime(entry.occurred_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
