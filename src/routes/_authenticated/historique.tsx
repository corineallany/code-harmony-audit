import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell, EmptyState } from "@/components/AppShell";
import { auditQuery, formatDateTime, membersQuery } from "@/lib/icc";
import { useCurrentRole } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  const members = useQuery(membersQuery);
  const qc = useQueryClient();
  const { role, isTechAdmin } = useCurrentRole();
  const [term, setTerm] = useState("");
  const [entity, setEntity] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const canDeleteHistory = role === "responsable" || role === "adjoint" || isTechAdmin;
  const actorByAuthId = useMemo(
    () => new Map((members.data?.members ?? []).filter((m) => m.auth_user_id).map((m) => [m.auth_user_id!, m])),
    [members.data?.members],
  );

  const rows = useMemo(() => {
    const q = term.trim().toLowerCase();
    return (audit.data ?? []).filter((row) => {
      if (entity && row.entity !== entity) return false;
      if (!q) return true;
      const actor = row.actor_id ? actorByAuthId.get(row.actor_id)?.full_name : null;
      return `${row.action} ${row.detail ?? ""} ${actor ?? row.actor_name ?? ""}`.toLowerCase().includes(q);
    });
  }, [audit.data, term, entity, actorByAuthId]);

  const entities = [...new Set((audit.data ?? []).map((r) => r.entity).filter(Boolean))] as string[];
  const allVisibleSelected = rows.length > 0 && rows.every((row) => selected.has(row.id));

  const remove = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!canDeleteHistory) throw new Error("Suppression réservée à la Direction et à l’Administrateur technique.");
      if (!ids.length) return;
      const { error } = await supabase.from("audit_log").delete().in("id", ids);
      if (error) throw new Error(error.message);
    },
    onSuccess: async (_data, ids) => {
      setSelected((current) => {
        const next = new Set(current);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      await qc.invalidateQueries({ queryKey: ["audit-log"] });
      toast.success(ids.length > 1 ? `${ids.length} entrées supprimées` : "Entrée supprimée");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function toggleAllVisible() {
    setSelected((current) => {
      const next = new Set(current);
      if (allVisibleSelected) rows.forEach((row) => next.delete(row.id));
      else rows.forEach((row) => next.add(row.id));
      return next;
    });
  }

  function deleteMany(ids: string[]) {
    if (!ids.length) return;
    const wording = ids.length > 1 ? `Supprimer définitivement ${ids.length} entrées de l’historique ?` : "Supprimer définitivement cette entrée de l’historique ?";
    if (window.confirm(wording)) remove.mutate(ids);
  }

  return (
    <AppShell title="Historique" subtitle="Qui a fait quoi, quand — journal unique de l’application">
      <div className="flex flex-wrap items-center gap-2">
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

        {canDeleteHistory && rows.length ? (
          <>
            <Button type="button" variant="outline" size="sm" onClick={toggleAllVisible}>
              {allVisibleSelected ? "Tout désélectionner" : "Tout sélectionner"}
            </Button>
            {selected.size ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={remove.isPending}
                onClick={() => deleteMany([...selected])}
              >
                <Trash2 className="mr-1 size-4" />
                Supprimer la sélection ({selected.size})
              </Button>
            ) : null}
          </>
        ) : null}
      </div>

      {canDeleteHistory ? (
        <p className="mt-2 text-xs text-muted-foreground">
          La suppression de l’historique est réservée à la Direction et à l’Administrateur technique. Elle est définitive.
        </p>
      ) : null}

      <div className="mt-4 space-y-2">
        {audit.isLoading || members.isLoading ? (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)
        ) : rows.length === 0 ? (
          <EmptyState title="Aucune entrée" description="Aucune action ne correspond à ces filtres." />
        ) : (
          rows.map((row) => {
            const actor = row.actor_id ? actorByAuthId.get(row.actor_id) : null;
            return (
              <Card key={row.id}>
                <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    {canDeleteHistory ? (
                      <Checkbox
                        className="mt-1"
                        checked={selected.has(row.id)}
                        onCheckedChange={(checked) =>
                          setSelected((current) => {
                            const next = new Set(current);
                            if (checked === true) next.add(row.id);
                            else next.delete(row.id);
                            return next;
                          })
                        }
                        aria-label={`Sélectionner ${row.action}`}
                      />
                    ) : null}
                    <div className="min-w-0">
                      <p className="font-bold">{row.action.replace(/_/g, " ")}</p>
                      {row.detail ? <p className="text-sm text-muted-foreground">{row.detail}</p> : null}
                      <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                        <span>{formatDateTime(row.occurred_at)} ·</span>
                        {actor ? (
                          <Link
                            to="/membre/$id"
                            params={{ id: actor.id }}
                            className="font-semibold text-icc-violet hover:underline"
                          >
                            {actor.full_name}
                          </Link>
                        ) : (
                          <span>{row.actor_name ?? "Auteur inconnu"}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {row.entity ? <Badge variant="secondary">{ENTITY_LABEL[row.entity] ?? row.entity}</Badge> : null}
                    {canDeleteHistory ? (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        disabled={remove.isPending}
                        onClick={() => deleteMany([row.id])}
                        aria-label="Supprimer cette entrée"
                        title="Supprimer cette entrée"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </AppShell>
  );
}
