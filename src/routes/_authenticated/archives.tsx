import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArchiveRestore, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell, EmptyState } from "@/components/AppShell";
import { useCurrentRole } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, logAction, polesQuery, programModelsQuery } from "@/lib/icc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/archives")({
  head: () => ({ meta: [{ title: "Archives & corbeille — COM ICC Le Mans" }] }),
  component: Archives,
});

type Entry = {
  key: string;
  id: string;
  table: "programs" | "solicitations" | "poles" | "program_models";
  label: string;
  detail: string;
  state: "archived" | "deleted";
};

const TABLE_LABEL: Record<Entry["table"], string> = {
  programs: "Programme",
  solicitations: "Sollicitation",
  poles: "Pôle",
  program_models: "Modèle",
};

function Archives() {
  const programs = useQuery({
    queryKey: ["archives-programs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("programs").select("*").or("archived.eq.true,deleted.eq.true").order("start_date");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
  const solicitations = useQuery({
    queryKey: ["archives-solicitations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("solicitations").select("*").or("archived.eq.true,deleted.eq.true").order("event_date");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
  const poles = useQuery(polesQuery);
  const models = useQuery(programModelsQuery);
  const queryClient = useQueryClient();
  const { member, isStaff, isAdmin } = useCurrentRole();

  const entries: Entry[] = [
    ...(programs.data ?? []).map((p) => ({
      key: `programs-${p.id}`,
      id: p.id,
      table: "programs" as const,
      label: p.title,
      detail: formatDate(p.start_date),
      state: p.deleted ? "deleted" as const : "archived" as const,
    })),
    ...(solicitations.data ?? []).map((s) => ({
      key: `solicitations-${s.id}`,
      id: s.id,
      table: "solicitations" as const,
      label: s.event_name ?? "Sollicitation",
      detail: `${s.requester ?? "Demandeur inconnu"} · ${formatDate(s.event_date)}`,
      state: s.deleted ? "deleted" as const : "archived" as const,
    })),
    ...(poles.data ?? []).filter((p) => p.archived).map((p) => ({
      key: `poles-${p.id}`,
      id: p.id,
      table: "poles" as const,
      label: p.name,
      detail: p.pole_group ?? "Pôle archivé",
      state: "archived" as const,
    })),
    ...(models.data ?? []).filter((m) => m.archived).map((m) => ({
      key: `program_models-${m.id}`,
      id: m.id,
      table: "program_models" as const,
      label: m.name,
      detail: m.program_type ?? "Modèle archivé",
      state: "archived" as const,
    })),
  ];

  function refreshAll() {
    for (const key of ["programs", "solicitations", "poles", "program-models", "archives-programs", "archives-solicitations"]) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  }

  const restore = useMutation({
    mutationFn: async (entry: Entry) => {
      const { error } =
        entry.table === "programs"
          ? await supabase.from("programs").update({ archived: false, deleted: false }).eq("id", entry.id)
          : entry.table === "solicitations"
            ? await supabase.from("solicitations").update({ archived: false, deleted: false }).eq("id", entry.id)
            : entry.table === "poles"
              ? await supabase.from("poles").update({ archived: false }).eq("id", entry.id)
              : await supabase.from("program_models").update({ archived: false }).eq("id", entry.id);
      if (error) throw new Error(error.message);
      await logAction({ action: "element_restaure", entity: entry.table, entityId: entry.id, detail: entry.label, actorName: member?.full_name });
    },
    onSuccess: () => { toast.success("Élément restauré"); refreshAll(); },
    onError: (error: Error) => toast.error(error.message),
  });

  const moveToTrash = useMutation({
    mutationFn: async (entry: Entry) => {
      if (entry.table !== "programs" && entry.table !== "solicitations") throw new Error("Cet élément ne possède pas de corbeille intermédiaire.");
      const { error } = await supabase.from(entry.table).update({ archived: true, deleted: true }).eq("id", entry.id);
      if (error) throw new Error(error.message);
      await logAction({ action: "element_corbeille", entity: entry.table, entityId: entry.id, detail: entry.label, actorName: member?.full_name });
    },
    onSuccess: () => { toast.success("Élément placé dans la corbeille"); refreshAll(); },
    onError: (error: Error) => toast.error(error.message),
  });

  const purge = useMutation({
    mutationFn: async (entry: Entry) => {
      const { error } = await supabase.from(entry.table).delete().eq("id", entry.id);
      if (error) throw new Error(error.message);
      await logAction({ action: "element_supprime_definitivement", entity: entry.table, entityId: entry.id, detail: entry.label, actorName: member?.full_name });
    },
    onSuccess: () => { toast.success("Suppression définitive effectuée"); refreshAll(); },
    onError: (error: Error) => toast.error(error.message),
  });

  const loading = programs.isLoading || solicitations.isLoading || poles.isLoading || models.isLoading;

  return (
    <AppShell title="Archives & corbeille" subtitle="Cycle unique : Actif → Archivé → Corbeille → Suppression définitive">
      {loading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : entries.length === 0 ? (
        <EmptyState title="Aucun élément archivé" description="Les éléments archivés ou placés dans la corbeille apparaîtront ici." />
      ) : (
        <Card>
          <CardHeader><CardTitle className="text-base">{entries.length} élément(s) conservé(s)</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {entries.map((entry) => (
              <div key={entry.key} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3">
                <div>
                  <p className="font-bold">{entry.label}</p>
                  <p className="text-xs text-muted-foreground">{entry.detail}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{TABLE_LABEL[entry.table]}</Badge>
                  <Badge variant={entry.state === "deleted" ? "destructive" : "outline"}>{entry.state === "deleted" ? "Corbeille" : "Archivé"}</Badge>
                  {isStaff ? (
                    <Button size="sm" variant="outline" className="gap-1" disabled={restore.isPending} onClick={() => restore.mutate(entry)}>
                      <ArchiveRestore className="size-4" /> Restaurer
                    </Button>
                  ) : null}
                  {isStaff && entry.state === "archived" && (entry.table === "programs" || entry.table === "solicitations") ? (
                    <Button size="sm" variant="ghost" className="gap-1 text-destructive" disabled={moveToTrash.isPending} onClick={() => {
                      if (window.confirm(`Placer « ${entry.label} » dans la corbeille ? Il restera restaurable.`)) moveToTrash.mutate(entry);
                    }}>
                      <Trash2 className="size-4" /> Corbeille
                    </Button>
                  ) : null}
                  {isAdmin && entry.state === "deleted" ? (
                    <Button size="sm" variant="ghost" className="gap-1 text-destructive" disabled={purge.isPending} onClick={() => {
                      if (window.confirm(`Supprimer définitivement « ${entry.label} » ? Cette action est irréversible.`)) purge.mutate(entry);
                    }}>
                      <Undo2 className="size-4" /> Supprimer définitivement
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}
