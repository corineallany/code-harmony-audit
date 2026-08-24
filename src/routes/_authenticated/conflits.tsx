import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { ConflictsPanel, useConflicts } from "@/components/ConflictsPanel";
import { Card, CardContent } from "@/components/ui/card";
import { CONFLICT_LABEL } from "@/lib/conflicts";

export const Route = createFileRoute("/_authenticated/conflits")({
  head: () => ({
    meta: [
      { title: "Conflits de planning — COM ICC Le Mans" },
      {
        name: "description",
        content:
          "Moteur de détection des conflits du pôle Communication : chevauchements de créneaux, indisponibilités et couverture incomplète.",
      },
      { property: "og:title", content: "Conflits de planning — COM ICC Le Mans" },
      {
        property: "og:description",
        content: "Détection automatique des chevauchements, absences et affectations manquantes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Conflits,
});

function Conflits() {
  const { conflicts } = useConflicts();

  const counts = new Map<string, number>();
  for (const conflict of conflicts) counts.set(conflict.kind, (counts.get(conflict.kind) ?? 0) + 1);

  return (
    <AppShell title="Conflits" subtitle="Moteur unique de détection, calcul en temps réel">
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Object.entries(CONFLICT_LABEL).map(([kind, label]) => (
            <Card key={kind}>
              <CardContent className="p-4">
                <p className="font-display text-2xl font-semibold">{counts.get(kind) ?? 0}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <ConflictsPanel />
      </div>
    </AppShell>
  );
}
