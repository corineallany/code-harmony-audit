import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { AppShell, EmptyState } from "@/components/AppShell";
import { auditQuery, formatDateTime } from "@/lib/icc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/historique")({
  head: () => ({
    meta: [
      { title: "Historique — COM ICC Le Mans" },
      {
        name: "description",
        content:
          "Journal des actions du pôle Communication : auteur, date, entité concernée et détail de chaque modification.",
      },
      { property: "og:title", content: "Historique — COM ICC Le Mans" },
      {
        property: "og:description",
        content: "Traçabilité complète des créations, modifications, validations et archivages.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Historique,
});

const ENTITY_LABEL: Record<string, string> = {
  program: "Programme",
  program_model: "Modèle",
  member: "Membre",
  pole: "Pôle",
  solicitation: "Sollicitation",
  task: "Tâche",
  evaluation: "Évaluation",
  program_debrief: "Post-service",
  member_availability: "Indisponibilité",
};

function Historique() {
  const audit = useQuery(auditQuery);
  const [term, setTerm] = useState("");
  const [entity, setEntity] = useState("");

  const rows = useMemo(() => {
    const q = term.trim().toLowerCase();
    return (audit.data ?? []).filter((row) => {
      if (entity && row.entity !== entity) return false;
      if (!q) return true;
      return `${row.action} ${row.detail ?? ""} ${row.actor_name ?? ""}`.toLowerCase().includes(q);
    });
  }, [audit.data, term, entity]);

  const entities = [...new Set((audit.data ?? []).map((r) => r.entity).filter(Boolean))] as string[];

  return (
    <AppShell title="Historique" subtitle="Qui a fait quoi, quand — journal unique de l’application">
      <div className="flex flex-wrap gap-2">
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Filtrer par action, détail ou auteur"
          className="max-w-xs"
        />
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={entity}
          onChange={(e) => setEntity(e.target.value)}
        >
          <option value="">Toutes les entités</option>
          {entities.map((value) => (
            <option key={value} value={value}>
              {ENTITY_LABEL[value] ?? value}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 space-y-2">
        {audit.isLoading ? (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)
        ) : rows.length === 0 ? (
          <EmptyState title="Aucune entrée" description="Aucune action ne correspond à ces filtres." />
        ) : (
          rows.map((row) => (
            <Card key={row.id}>
              <CardContent className="flex flex-wrap items-start justify-between gap-2 p-4">
                <div>
                  <p className="font-bold">{row.action.replace(/_/g, " ")}</p>
                  {row.detail ? <p className="text-sm text-muted-foreground">{row.detail}</p> : null}
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDateTime(row.occurred_at)} · {row.actor_name ?? "Auteur inconnu"}
                  </p>
                </div>
                {row.entity ? (
                  <Badge variant="secondary">{ENTITY_LABEL[row.entity] ?? row.entity}</Badge>
                ) : null}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </AppShell>
  );
}
